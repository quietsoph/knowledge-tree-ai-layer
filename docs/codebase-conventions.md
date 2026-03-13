# Codebase Conventions

Detailed patterns and conventions for the AI layer. See [CLAUDE.md](../CLAUDE.md) for rules and commands.

## Core Principles

- **Separation of concerns** – each layer has a single responsibility.
- **Idempotency** – operations produce the same output for the same input.
- **Validation at boundaries** – all LLM outputs are validated against Zod schemas.
- **Observability by default** – every AI call logs tokens, latency, and outcome.
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
- Emits structured logs (JSON) and OpenTelemetry spans via `experimental_telemetry` (enabled by default — see [agentic-patterns.md](agentic-patterns.md) for telemetry principles).
- Optionally caches responses for idempotent, cheap operations (e.g., routing).

## Schemas (`src/schemas/`)

- Define all data shapes with Zod.
- **Include a `version` field** in top-level schemas — use `z.discriminatedUnion("version", ...)` to parse multiple versions.
- Provide migration functions in `version.ts` to upgrade older versions.
- Keep schemas **strict** – no passthrough.

**Example versioned schema (Zod v4):**

```ts
const TreeSchemaV1 = z.object({ version: z.literal(1), title: z.string() });
const TreeSchemaV2 = TreeSchemaV1.extend({ version: z.literal(2), newField: z.string() });
export const TreeSchema = z.discriminatedUnion("version", [TreeSchemaV1, TreeSchemaV2]);
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
- Pass correlation IDs from the API entry point through each operation call.

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

Pure functions, no AI calls. Planned modules:

- Content preservation – compare old/new chapters (block count + optional semantic similarity).
- Tree diffing – detailed diff of sections.
- Correlation IDs – generate and manage request-scoped IDs.
- Streaming helpers – SSE or WebSocket formatting.
- Eval harness – run prompts against labeled dataset and score outputs.

## Observability

- **Logging** – structured JSON via pino or similar. Minimum fields: timestamp, level, message, correlationId, operation.
- **Telemetry** – `experimental_telemetry` is enabled by default in the LLM client. Export spans via OTLP.
- **Metrics** – expose Prometheus metrics (request count, error rate, latency, token usage) at `/metrics`.

## Configuration (`src/config.ts`)

Central, environment-aware configuration. Expected shape:

```ts
export const config = {
  models: { default: "...", fallbackChain: [...] },
  retries: { maxAttempts: number, backoffBaseMs: number },
  features: { [flagName: string]: boolean },
  thresholds: { [metricName: string]: number },
  telemetry: { enabled: boolean, exporter: string },
};
```

## Testing Strategy

- **Unit tests** for utilities and pure functions.
- **Integration tests** for operations (mock LLM client to return controlled responses).
- **E2E tests** for pipelines (using real LLM calls on small fixtures, but with careful cost management).
- **Evaluation tests** – maintain a labeled dataset; run after prompt changes to detect regression.
- **Performance tests** – simulate concurrency and large inputs.
