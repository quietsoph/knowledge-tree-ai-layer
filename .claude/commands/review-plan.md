Review the proposed feature or refactor against this checklist. For each item, assess the current plan and flag anything missing or unclear. Ask clarifying questions before proceeding with implementation.

## Checklist

1. **Identify the Core Pattern**: Which of the five agentic patterns does this use? Name it explicitly: Prompt Chaining, Routing, Parallelization, Orchestrator-Workers, or Generator-Critic. See `docs/agentic-patterns.md` for details.

2. **Define the Contract**: What is the Zod schema for the structured input and output? Draft or reference the schemas before writing logic.

3. **Choose the Right SDK Primitive**: `generateText` + `Output.object()` for structured data, `streamText` for long-running calls with incremental output, or tools for side-effecting actions? See `docs/agentic-patterns.md` SDK section.

4. **Plan for Observability**: Have I enabled telemetry? What unique identifiers (like `correlationId`) am I passing down to trace this request?

5. **Manage State**: Does this feature need to remember something across calls? If so, where will that state live (session, Redis, database)?

6. **Add a Quality Gate**: What semantic check can I add after the LLM call to ensure the output is not just valid, but correct?

7. **Plan for Evolution**: Is the schema versioned? How will I handle changes in the future?

## Instructions

- Walk through each item in order.
- For each item, state what the current plan is (or "not yet decided") and whether it looks correct.
- At the end, summarize any gaps or open questions that need resolving before implementation begins.
- Reference `docs/agentic-patterns.md` for design patterns, `docs/codebase-conventions.md` for codebase conventions, and `CLAUDE.md` rules when assessing.
