Run all verification checks in sequence. Stop and report if any step fails.

1. Auto-fix formatting: `pnpm format`
2. Type check: `pnpm tsc --noEmit`
3. Lint check (no auto-fix): `pnpm check`
4. Run tests: `pnpm vitest run`

Step 1 auto-fixes formatting so that steps 2–4 verify a clean state. Report a summary of results for each step (pass/fail). If a step fails, show the relevant errors and do not proceed to the next step.
