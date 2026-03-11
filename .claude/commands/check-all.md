Run all verification checks in sequence. Stop and report if any step fails.

1. Format: `pnpm format`
2. Type check: `pnpm tsc --noEmit`
3. Lint/format check: `pnpm check`
4. Run tests: `pnpm vitest run`

Report a summary of results for each step (pass/fail). If a step fails, show the relevant errors and do not proceed to the next step.
