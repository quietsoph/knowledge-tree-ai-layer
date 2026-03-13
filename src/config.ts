import "dotenv/config";

export interface ModelEntry {
	provider: string;
	modelId: string;
}

export type FallbackChainName = "default" | "high-context";

const isProduction = process.env["NODE_ENV"] === "production";

export const modelRegistry: Record<string, ModelEntry> = {
	"deepseek-v3": { provider: "deepseek", modelId: "deepseek-chat" },
	"gpt-4o-mini": { provider: "openai", modelId: "gpt-4o-mini" },
	"grok-4-fast": { provider: "xai", modelId: "grok-4-fast-reasoning" },
	"ollama-default": { provider: "ollama", modelId: "llama3.2" },
};

export const config = {
	defaultModel: isProduction ? "deepseek-v3" : "ollama-default",

	fallbackChains: {
		default: isProduction ? ["deepseek-v3", "gpt-4o-mini"] : ["ollama-default"],
		"high-context": isProduction
			? ["grok-4-fast", "deepseek-v3"]
			: ["ollama-default"],
	} satisfies Record<FallbackChainName, string[]>,

	retry: {
		maxAttempts: 3,
		backoffBaseMs: 1_000,
	},

	cache: {
		enabled: false,
		ttlMs: 300_000,
		maxEntries: 100,
	},

	telemetry: {
		enabled: process.env["TELEMETRY_ENABLED"] === "true",
	},
} as const;
