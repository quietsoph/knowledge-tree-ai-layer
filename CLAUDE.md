# CLAUDE.md

## Project Overview

The AI layer transforms raw notes into structured knowledge trees using LLMs.
Layers: LLM Client → Schemas → Prompts → Operations → Pipelines, plus Utilities and Observability.

## Commands

- **Run a script:** `pnpm tsx src/<file>.ts`
- **Type check:** `pnpm tsc --noEmit`
- **Lint/format check:** `pnpm check`
- **Lint/format fix:** `pnpm format`
- **Run tests:** `pnpm vitest` (or `pnpm vitest run` for single run)
- **Run single test:** `pnpm vitest <test-file-pattern>`
- **Install deps:** `pnpm install`

## Code Style

- Formatter: Biome with **tabs** for indentation, **double quotes** for JS/TS strings
- Linter: Biome with recommended rules
- Module system: ESM (`"type": "module"` in package.json, `"module": "nodenext"` in tsconfig)
- Strict TypeScript: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- Use `.js` extensions in import paths (required by nodenext module resolution)

## Key Dependencies

- `ai` (Vercel AI SDK) – LLM calls
- `zod` – schema validation
- `dotenv` – environment config
- `biome` – lint/format
- `vitest` – testing

## Rules

**Do:**

- All LLM calls go through `src/client/llm.ts` – never call the SDK directly
- Validate all LLM output against Zod schemas
- Version all schemas (include `version` field) and prompts (export versioned objects)
- Propagate correlation IDs through every layer
- Use model registry + config – never hardcode model names
- Keep operations idempotent and pure
- Compose operations only in pipelines – operations never call other operations

**Don't:**

- Skip schema validation on LLM responses
- Mix concerns – keep prompt text in `src/prompts/`, composition logic in `src/pipelines/`
- Over-retry – respect rate limits, use exponential backoff

## File Placement

| New code for...     | Put it in...      |
| ------------------- | ----------------- |
| LLM wrapper/retry   | `src/client/`     |
| Data shapes (Zod)   | `src/schemas/`    |
| Prompt text         | `src/prompts/`    |
| Single AI task      | `src/operations/` |
| Multi-step workflow | `src/pipelines/`  |
| Pure helpers        | `src/utils/`      |
| App config          | `src/config.ts`   |

## After Making Changes

1. `pnpm tsc --noEmit` – type check passes
2. `pnpm check` – lint/format clean
3. `pnpm vitest run` – tests pass

## Architecture

See [`docs/codebase-conventions.md`](docs/codebase-conventions.md) for codebase patterns and [`docs/agentic-patterns.md`](docs/agentic-patterns.md) for agentic design patterns.
