# Agentic Design Patterns

Design-level guidance for choosing and combining patterns. See [codebase-conventions.md](codebase-conventions.md) for codebase-level conventions.

## Core Patterns

### Prompt Chaining

Sequential LLM calls where each step's output feeds the next, with quality gates between steps. Ideal for propose/execute pipelines where a plan is generated, reviewed, then applied.

**When to use:** Tasks that decompose into distinct sequential phases with clear intermediate outputs.

### Routing

Classify input first, then dispatch to a specialized handler. The classifier determines which downstream operation (or prompt variant) handles each piece of input.

**When to use:** Heterogeneous inputs that require different processing strategies (e.g., routing notes to the right chapter).

### Parallelization

Run independent LLM calls concurrently and aggregate results. Each call operates on a different slice of the input with no cross-dependencies.

**When to use:** Processing multiple note clusters against different chapters, or any batch where items don't depend on each other.

### Orchestrator-Workers

A central LLM dynamically plans subtasks, delegates them to worker calls, and synthesizes results. Unlike prompt chaining, the set of subtasks isn't fixed — the orchestrator decides at runtime.

**When to use:** Open-ended tasks where the number and type of subtasks can't be predetermined.

### Generator-Critic

A generation step followed by a critique step, looped until quality criteria are met. The critic evaluates against explicit rubrics and feeds corrections back to the generator.

**When to use:** Merge operations with content preservation checks, or any output that benefits from iterative refinement.

## SDK & Implementation Practices

- **Structured output:** Use `generateText()` + `Output.object({ schema })` — not `generateObject()`.
- **Streaming:** Use `streamText()` for long-running calls where incremental output improves UX (e.g., pipeline progress). Prefer `generateText()` when you need the full result before proceeding.
- **Tool calling:** Use tools for actions with side effects (DB queries, external APIs). Keep LLM output pure otherwise.
- **Multi-step workflows:** Use `maxSteps` for autonomous agents that decide when to stop. Use `stopWhen: stepCountIs(n)` for bounded loops with a known iteration limit.
- **Telemetry:** `experimental_telemetry` is opt-out in `llm.ts`, not opt-in per operation.
- **Semantic quality gates:** Go beyond schema validation — verify that referenced section IDs exist, check content preservation scores, validate structural invariants.
- **Context window management:** Summarize older sections rather than passing full history. Use embeddings for retrieval when context grows large.

## State Management & Scaling

- **Externalize long-lived state:** Use Redis or a database for anything that must survive across calls or processes. Don't rely on in-memory storage for multi-step pipelines.
- **Treat context as a resource:** Be mindful of token limits. Trim, summarize, or retrieve selectively rather than stuffing everything into the prompt.
