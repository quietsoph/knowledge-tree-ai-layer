import { afterEach, describe, expect, it, type Mock, vi } from "vitest";
import { z } from "zod/v4";

vi.mock("ai", () => ({
	generateText: vi.fn(),
	Output: {
		object: vi.fn(({ schema }: { schema: unknown }) => ({
			type: "object",
			schema,
		})),
	},
}));

vi.mock("@ai-sdk/deepseek", () => ({
	createDeepSeek: () => (id: string) => ({ modelId: id, provider: "deepseek" }),
}));
vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: () => (id: string) => ({ modelId: id, provider: "openai" }),
}));
vi.mock("@ai-sdk/xai", () => ({
	createXai: () => (id: string) => ({ modelId: id, provider: "xai" }),
}));
vi.mock("ai-sdk-ollama", () => ({
	createOllama: () => (id: string) => ({ modelId: id, provider: "ollama" }),
}));

vi.mock("../../config.js", () => ({
	modelRegistry: {
		"deepseek-v3": { provider: "deepseek", modelId: "deepseek-chat" },
		"gpt-4o-mini": { provider: "openai", modelId: "gpt-4o-mini" },
		"grok-4-fast": { provider: "xai", modelId: "grok-4-fast-reasoning" },
		"ollama-default": { provider: "ollama", modelId: "llama3.2" },
	},
	config: {
		defaultModel: "deepseek-v3",
		fallbackChains: {
			default: ["deepseek-v3", "gpt-4o-mini"],
			"high-context": ["grok-4-fast", "deepseek-v3"],
		},
		retry: { maxAttempts: 3, backoffBaseMs: 10 },
		cache: { enabled: false, ttlMs: 300_000, maxEntries: 100 },
		telemetry: { enabled: false },
	},
}));

import { generateText } from "ai";
import { LLMError } from "../errors.js";
import { _resetForTesting, callLLM } from "../llm.js";

const mockGenerateText = generateText as Mock;

const testSchema = z.object({ answer: z.string() });

function mockSuccess(output: unknown) {
	mockGenerateText.mockResolvedValueOnce({
		output,
		usage: { inputTokens: 10, outputTokens: 5 },
	});
}

function mockError(message: string) {
	mockGenerateText.mockRejectedValueOnce(new Error(message));
}

afterEach(() => {
	vi.clearAllMocks();
	_resetForTesting();
});

describe("callLLM", () => {
	it("returns validated output on success", async () => {
		mockSuccess({ answer: "42" });

		const result = await callLLM({
			operationName: "test-op",
			modelId: "deepseek-v3",
			systemPrompt: "You are helpful.",
			userMessage: "What is the answer?",
			schema: testSchema,
		});

		expect(result).toEqual({ answer: "42" });
		expect(mockGenerateText).toHaveBeenCalledOnce();
	});

	it("accepts userMessage as a function", async () => {
		mockSuccess({ answer: "lazy" });

		const result = await callLLM({
			operationName: "test-op",
			modelId: "deepseek-v3",
			systemPrompt: "system",
			userMessage: () => "lazy message",
			schema: testSchema,
		});

		expect(result).toEqual({ answer: "lazy" });
		expect(mockGenerateText).toHaveBeenCalledWith(
			expect.objectContaining({ prompt: "lazy message" }),
		);
	});

	it("retries on 429 with backoff", async () => {
		mockError("429 rate limit exceeded");
		mockError("429 rate limit exceeded");
		mockSuccess({ answer: "ok" });

		const result = await callLLM({
			operationName: "test-op",
			modelId: "deepseek-v3",
			systemPrompt: "system",
			userMessage: "msg",
			schema: testSchema,
		});

		expect(result).toEqual({ answer: "ok" });
		expect(mockGenerateText).toHaveBeenCalledTimes(3);
	});

	it("retries once on validation error with hint", async () => {
		mockError("Output validation failed");
		mockSuccess({ answer: "fixed" });

		const result = await callLLM({
			operationName: "test-op",
			modelId: "deepseek-v3",
			systemPrompt: "system",
			userMessage: "msg",
			schema: testSchema,
		});

		expect(result).toEqual({ answer: "fixed" });
		expect(mockGenerateText).toHaveBeenCalledTimes(2);
		// Second call should have the validation hint appended
		const secondCall = mockGenerateText.mock.calls[1]?.[0];
		expect(secondCall?.prompt).toContain("Previous attempt failed validation");
	});

	it("handles validation error with maxRetries: 2", async () => {
		mockError("Output validation failed");
		mockSuccess({ answer: "fixed" });

		const result = await callLLM({
			operationName: "test-op",
			modelId: "deepseek-v3",
			systemPrompt: "system",
			userMessage: "msg",
			schema: testSchema,
			options: { maxRetries: 2 },
		});

		// With maxRetries: 2 and flag-based retry:
		// attempt 1 fails validation → sets flag, continues to attempt 2
		// attempt 2 succeeds with hint
		expect(result).toEqual({ answer: "fixed" });
		expect(mockGenerateText).toHaveBeenCalledTimes(2);
	});

	it("throws ValidationRetryExhaustedError after validation retry fails", async () => {
		mockError("Output validation failed");
		mockError("Output validation failed");

		await expect(
			callLLM({
				operationName: "test-op",
				modelId: "deepseek-v3",
				systemPrompt: "system",
				userMessage: "msg",
				schema: testSchema,
				options: { maxRetries: 2 },
			}),
		).rejects.toThrow(LLMError);
	});

	it("falls back to next model on token limit error", async () => {
		mockError("context length exceeded");
		mockSuccess({ answer: "fallback" });

		const result = await callLLM({
			operationName: "test-op",
			systemPrompt: "system",
			userMessage: "msg",
			schema: testSchema,
		});

		expect(result).toEqual({ answer: "fallback" });
		expect(mockGenerateText).toHaveBeenCalledTimes(2);
	});

	it("skips to next model on 5xx without retrying", async () => {
		mockError("500 internal server error");
		mockSuccess({ answer: "fallback-ok" });

		const result = await callLLM({
			operationName: "test-op",
			systemPrompt: "system",
			userMessage: "msg",
			schema: testSchema,
		});

		expect(result).toEqual({ answer: "fallback-ok" });
		// Should only call generateText twice: once for first model (5xx), once for fallback
		expect(mockGenerateText).toHaveBeenCalledTimes(2);
	});

	it("throws LLMError when all models exhausted", async () => {
		mockError("429 rate limit");
		mockError("429 rate limit");
		mockError("429 rate limit");
		mockError("429 rate limit");
		mockError("429 rate limit");
		mockError("429 rate limit");

		await expect(
			callLLM({
				operationName: "test-op",
				systemPrompt: "system",
				userMessage: "msg",
				schema: testSchema,
			}),
		).rejects.toThrow("All models exhausted");
	});

	it("throws on unknown model", async () => {
		await expect(
			callLLM({
				operationName: "test-op",
				modelId: "nonexistent-model",
				systemPrompt: "system",
				userMessage: "msg",
				schema: testSchema,
			}),
		).rejects.toThrow("All models exhausted");
	});

	it("returns cached result when cache is enabled", async () => {
		mockSuccess({ answer: "first" });

		const params = {
			operationName: "test-op",
			modelId: "deepseek-v3",
			systemPrompt: "system",
			userMessage: "msg",
			schema: testSchema,
			options: { cache: true },
		} as const;

		const first = await callLLM(params);
		const second = await callLLM(params);

		expect(first).toEqual({ answer: "first" });
		expect(second).toEqual({ answer: "first" });
		expect(mockGenerateText).toHaveBeenCalledOnce();
	});

	it("invalidates cached data that fails schema validation", async () => {
		mockSuccess({ answer: "valid" });

		const params = {
			operationName: "test-op",
			modelId: "deepseek-v3",
			systemPrompt: "system",
			userMessage: "msg",
			schema: testSchema,
			options: { cache: true },
		} as const;

		// First call populates the cache
		await callLLM(params);
		expect(mockGenerateText).toHaveBeenCalledOnce();

		// Now call with a different schema that won't match cached data
		const strictSchema = z.object({ answer: z.string(), extra: z.number() });
		mockSuccess({ answer: "new", extra: 42 });

		const result = await callLLM({
			...params,
			schema: strictSchema,
			options: { cache: true },
		});

		expect(result).toEqual({ answer: "new", extra: 42 });
		expect(mockGenerateText).toHaveBeenCalledTimes(2);
	});

	it("uses high-context fallback chain", async () => {
		mockSuccess({ answer: "grok" });

		const result = await callLLM({
			operationName: "test-op",
			systemPrompt: "system",
			userMessage: "msg",
			schema: testSchema,
			fallbackChain: "high-context",
		});

		expect(result).toEqual({ answer: "grok" });
		// Should use the first model in high-context chain (grok-4-fast)
		expect(mockGenerateText).toHaveBeenCalledWith(
			expect.objectContaining({
				model: expect.objectContaining({ provider: "xai" }),
			}),
		);
	});

	it("throws LLMError on non-retryable error", async () => {
		mockError("Invalid API key");

		await expect(
			callLLM({
				operationName: "test-op",
				modelId: "deepseek-v3",
				systemPrompt: "system",
				userMessage: "msg",
				schema: testSchema,
			}),
		).rejects.toThrow(LLMError);
	});
});
