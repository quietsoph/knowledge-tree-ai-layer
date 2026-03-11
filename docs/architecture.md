# Architecture Guide

Detailed patterns and conventions for the AI layer. See [CLAUDE.md](../CLAUDE.md) for rules and commands.

## Core Principles

- **Separation of concerns** – each layer has a single responsibility.
- **Idempotency** – operations produce the same output for the same input.
- **Validation at boundaries** – all LLM outputs are validated against Zod schemas.
- **Version everything** – schemas and prompts are versioned to allow safe evolution.
- **Observability by default** – every AI call logs tokens, latency, and outcome; correlation IDs tie requests together.
- **Resilience** – retry with exponential backoff, model fallback chains, and circuit breakers.
- **Human-in-the-loop** – pipelines expose a propose/execute pattern for review.

## LLM Client (`src/client/llm.ts`)

**Single entry point for all LLM calls.**

- Takes `operationName`, `system`, `userMessage` (string or builder), Zod `schema`, optional `correlationId`, and `options`.
- Resolves model via registry; supports fallback chain (e.g., claude-3-opus → gpt-4).
- Implements retry logic:
  - Rate limit / 5xx: exponential backoff (up to 3 attempts).
  - Validation error: retry once with error appended.
  - Token limit: truncate prompt or fallback to cheaper model.
- Emits structured logs (JSON) and OpenTelemetry spans (via `experimental_telemetry`).
- Optionally caches responses for idempotent, cheap operations (e.g., routing).
- Always includes `correlationId` in logs/spans.

**Never call the SDK directly outside this module.**

## Schemas (`src/schemas/`)

- Define all data shapes with Zod.
- **Include a `version` field** in top-level schemas (e.g., `TreeSchema`).
- Provide migration functions in `version.ts` to upgrade older versions.
- Use discriminated unions for content blocks.
- Keep schemas **strict** – no passthrough.

**Example versioned schema:**

```ts
const TreeSchemaV1 = z.object({ title: z.string(), ... });
const TreeSchemaV2 = TreeSchemaV1.extend({ version: z.literal(2), newField: z.string() });
export const TreeSchema = z.union([TreeSchemaV1, TreeSchemaV2]).transform(...);
```

## Prompts (`src/prompts/`)

- One file per operation, exporting **versioned prompt objects**:
  ```ts
  export const initPrompts = {
    v1: { system: "...", userBuilder: (topic, notes) => `...` },
    v2: { system: "...", ... }
  };
  ```
- Include **few-shot examples** in complex prompts (analyze, merge).
- Keep prompt text in sync with schema expectations – test with the eval harness.
- The active version is controlled via feature flags in config.

## Operations (`src/operations/`)

- Each operation is a **pure, idempotent function** that:
  - Imports its prompt (from registry, using active version).
  - Imports its output schema.
  - Calls `callLLM` with the prompt, schema, and correlation ID.
  - May perform additional semantic checks (e.g., verify target section IDs exist).
  - Returns typed data.
- **Never call another operation directly** – composition happens in pipelines.

**Example skeleton:**

```ts
export async function analyze(chapter, notes, correlationId) {
  const prompt =
    prompts.analyze[config.features.useNewAnalyzePrompt ? "v2" : "v1"];
  const userMessage = prompt.userBuilder(chapter, notes);
  const plan = await callLLM({
    operationName: "analyze",
    system: prompt.system,
    userMessage,
    schema: MergePlanSchema,
    correlationId,
  });
  // optional semantic checks
  return plan;
}
```

## Pipelines (`src/pipelines/`)

- Compose operations into **workflows**.
- **Support streaming** for long operations – yield progress events.
- Handle **partial failures** gracefully – continue processing other chapters if one fails, return a report.
- Use correlation IDs generated at the API entry point and passed down.

**Example streaming pattern (generator):**

```ts
export async function* proposeMerge(tree, notes, correlationId) {
  yield { type: "routing-start" };
  const routingMap = await route(treeIndex, notes, correlationId);
  yield { type: "routing-result", routingMap };
  for (const chapter of routingMap) {
    yield { type: "analyze-start", chapterId: chapter.id };
    const plan = await analyze(chapter, notes, correlationId);
    yield { type: "analyze-result", chapterId: chapter.id, plan };
  }
  yield { type: "complete", plans: finalPlans };
}
```

## Utilities (`src/utils/`)

Pure functions, no AI calls:

- `content-preservation.ts` – compare old/new chapters (block count + optional semantic similarity).
- `tree-diff.ts` – detailed diff of sections.
- `correlation.ts` – generate and manage correlation IDs.
- `streaming.ts` – helpers for SSE or WebSocket formatting.
- `eval-harness.ts` – run prompts against labeled dataset and score outputs.

## Observability

- **Logging** – every module logs structured JSON (use a logger like pino). Minimum fields: timestamp, level, message, correlationId, operation.
- **Telemetry** – enable Vercel AI SDK's `experimental_telemetry` in the LLM client. Export spans via OTLP to a collector (e.g., SigNoz, LangSmith).
- **Metrics** – expose Prometheus metrics (request count, error rate, latency, token usage) at a `/metrics` endpoint.
- **Correlation IDs** – generated at the API gateway, propagated through all layers.

## Configuration (`src/config.ts`)

Central, environment-aware configuration:

```ts
export const config = {
  models: { default: 'claude-sonnet', fallbackChain: [...] },
  retries: { maxAttempts: 3, backoffBaseMs: 1000 },
  features: {
    useNewAnalyzePrompt: process.env.FEATURE_NEW_ANALYZE === 'true',
    enableStreaming: true,
  },
  thresholds: { contentPreservation: 1.0, chapterSplit: 8 },
  telemetry: { enabled: true, exporter: 'otlp' },
};
```

## Testing Strategy

- **Unit tests** for utilities and pure functions.
- **Integration tests** for operations (mock LLM client to return controlled responses).
- **E2E tests** for pipelines (using real LLM calls on small fixtures, but with careful cost management).
- **Evaluation tests** – maintain a labeled dataset; run after prompt changes to detect regression.
- **Performance tests** – simulate concurrency and large inputs.
