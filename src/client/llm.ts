import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import { generateText, type LanguageModel, Output } from "ai";
import { createOllama } from "ai-sdk-ollama";
import type { z } from "zod/v4";
import { config, type FallbackChainName, modelRegistry } from "../config.js";
import { generateCorrelationId } from "../utils/correlation.js";
import { createLogger } from "../utils/logger.js";
import { ResponseCache } from "./cache.js";
import { LLMError, ValidationRetryExhaustedError } from "./errors.js";

let responseCache = new ResponseCache(config.cache.maxEntries);

/** Reset module state — only for use in tests. */
export function _resetForTesting(): void {
	responseCache = new ResponseCache(config.cache.maxEntries);
}

type ProviderFactory = (modelId: string) => LanguageModel;

function lazyProvider(init: () => ProviderFactory): () => ProviderFactory {
	let instance: ProviderFactory | undefined;
	return () => {
		if (!instance) instance = init();
		return instance;
	};
}

const providerGetters: Record<string, () => ProviderFactory> = {
	deepseek: lazyProvider(() => createDeepSeek()),
	openai: lazyProvider(() => createOpenAI()),
	xai: lazyProvider(() => createXai()),
	ollama: lazyProvider(() => createOllama()),
};

function resolveModel(modelName: string): LanguageModel {
	const entry = modelRegistry[modelName];
	if (!entry) {
		throw new Error(`Unknown model: "${modelName}"`);
	}
	const getFactory = providerGetters[entry.provider];
	if (!getFactory) {
		throw new Error(`Unknown provider: "${entry.provider}"`);
	}
	return getFactory()(entry.modelId);
}

function isServerError(error: unknown): boolean {
	if (error instanceof Error) {
		if (
			/5\d{2}|server.?error|internal.?error|service.?unavailable/i.test(
				error.message,
			)
		)
			return true;
	}
	if (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		typeof (error as Record<string, unknown>)["status"] === "number"
	) {
		const status = (error as Record<string, unknown>)["status"] as number;
		if (status >= 500 && status < 600) return true;
	}
	return false;
}

function isRateLimitError(error: unknown): boolean {
	if (error instanceof Error) {
		if (/429|rate.?limit/i.test(error.message)) return true;
	}
	if (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		typeof (error as Record<string, unknown>)["status"] === "number"
	) {
		const status = (error as Record<string, unknown>)["status"] as number;
		if (status === 429) return true;
	}
	return false;
}

function isTokenLimitError(error: unknown): boolean {
	if (error instanceof Error) {
		return /context.?length|token.?limit|max.?tokens|too.?long/i.test(
			error.message,
		);
	}
	return false;
}

function isValidationError(error: unknown): boolean {
	if (error instanceof Error) {
		return /validation|parse|schema|output/i.test(error.message);
	}
	return false;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CallLLMParams<T> {
	operationName: string;
	modelId?: string | undefined;
	systemPrompt: string;
	userMessage: string | (() => string);
	schema: z.ZodType<T>;
	correlationId?: string | undefined;
	fallbackChain?: FallbackChainName | undefined;
	options?: {
		temperature?: number | undefined;
		maxRetries?: number | undefined;
		cache?: boolean | undefined;
		maxTokens?: number | undefined;
	};
}

interface ErrorContext {
	operationName: string;
	modelId: string;
	correlationId: string;
}

function wrapError(
	message: string,
	ctx: ErrorContext,
	cause: unknown,
): LLMError {
	return new LLMError(message, { ...ctx, cause });
}

/** Result of attempting a single model: either a value or an error to collect. */
type ModelAttemptResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: LLMError };

async function executeWithRetries<T>(
	model: LanguageModel,
	modelName: string,
	params: CallLLMParams<T>,
	userMessage: string,
	ctx: ErrorContext,
	maxRetries: number,
	logger: ReturnType<typeof createLogger>,
): Promise<ModelAttemptResult<T>> {
	let validationRetried = false;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		const startTime = Date.now();

		try {
			const result = await generateText({
				model,
				output: Output.object({ schema: params.schema }),
				system: params.systemPrompt,
				prompt: validationRetried
					? `${userMessage}\n\n[Previous attempt failed validation. Please ensure your response strictly matches the required schema.]`
					: userMessage,
				experimental_telemetry: {
					isEnabled: config.telemetry.enabled,
					functionId: params.operationName,
					metadata: {
						correlationId: ctx.correlationId,
						attempt: String(attempt),
						modelName,
					},
				},
				...(params.options?.temperature !== undefined && {
					temperature: params.options.temperature,
				}),
				...(params.options?.maxTokens !== undefined && {
					maxTokens: params.options.maxTokens,
				}),
			});

			const latencyMs = Date.now() - startTime;
			logger.info({
				model: modelName,
				tokens: {
					input: result.usage.inputTokens,
					output: result.usage.outputTokens,
				},
				latencyMs,
				attempt,
				success: true,
			});

			const output = result.output;
			if (output === undefined) {
				throw new Error("Output validation failed: output is undefined");
			}

			return { ok: true, value: output };
		} catch (error) {
			const latencyMs = Date.now() - startTime;
			logger.error({
				model: modelName,
				error: error instanceof Error ? error.message : String(error),
				attempt,
				latencyMs,
			});

			if (isTokenLimitError(error)) {
				return {
					ok: false,
					error: wrapError(
						`Token limit exceeded on "${modelName}"`,
						ctx,
						error,
					),
				};
			}

			if (isServerError(error)) {
				return {
					ok: false,
					error: wrapError(`Server error on "${modelName}"`, ctx, error),
				};
			}

			if (isValidationError(error)) {
				if (!validationRetried) {
					validationRetried = true;
					continue;
				}
				return {
					ok: false,
					error: new ValidationRetryExhaustedError({ ...ctx, cause: error }),
				};
			}

			if (isRateLimitError(error)) {
				if (attempt < maxRetries) {
					const backoff = config.retry.backoffBaseMs * 2 ** (attempt - 1);
					await sleep(backoff);
					continue;
				}
				return {
					ok: false,
					error: wrapError(
						`Retries exhausted on "${modelName}" after ${maxRetries} attempts`,
						ctx,
						error,
					),
				};
			}

			// Non-retryable — fail fast (thrown, not returned)
			throw wrapError(
				error instanceof Error ? error.message : String(error),
				ctx,
				error,
			);
		}
	}

	// Loop ended without returning (e.g. validation retry exhausted maxRetries)
	return {
		ok: false,
		error: wrapError(
			`Attempts exhausted on "${modelName}" after ${maxRetries} attempts`,
			ctx,
			undefined,
		),
	};
}

export async function callLLM<T>(params: CallLLMParams<T>): Promise<T> {
	const correlationId = params.correlationId ?? generateCorrelationId();
	const logger = createLogger({
		operation: params.operationName,
		correlationId,
	});

	const userMessage =
		typeof params.userMessage === "function"
			? params.userMessage()
			: params.userMessage;

	const chainName = params.fallbackChain ?? "default";
	const chain = params.modelId
		? [params.modelId]
		: config.fallbackChains[chainName];

	const maxRetries = params.options?.maxRetries ?? config.retry.maxAttempts;
	const useCache = params.options?.cache ?? config.cache.enabled;
	const cacheKey = ResponseCache.buildKey(params.systemPrompt, userMessage);

	if (useCache) {
		const cached = responseCache.get(cacheKey);
		if (cached !== undefined) {
			const parsed = params.schema.safeParse(cached);
			if (parsed.success) {
				logger.info("Cache hit");
				return parsed.data;
			}
			responseCache.delete(cacheKey);
		}
	}

	const errors: Error[] = [];

	for (const modelName of chain) {
		const ctx: ErrorContext = {
			operationName: params.operationName,
			modelId: modelName,
			correlationId,
		};

		let model: LanguageModel;
		try {
			model = resolveModel(modelName);
		} catch (error) {
			errors.push(
				wrapError(`Failed to resolve model "${modelName}"`, ctx, error),
			);
			continue;
		}

		const result = await executeWithRetries(
			model,
			modelName,
			params,
			userMessage,
			ctx,
			maxRetries,
			logger,
		);

		if (result.ok) {
			if (useCache) {
				responseCache.set(cacheKey, result.value, config.cache.ttlMs);
			}
			return result.value;
		}

		errors.push(result.error);
	}

	throw new LLMError(
		`All models exhausted for "${params.operationName}". Tried: ${chain.join(", ")}`,
		{
			operationName: params.operationName,
			modelId: chain.join(", "),
			correlationId,
			cause: errors.length === 1 ? errors[0] : new AggregateError(errors),
		},
	);
}
