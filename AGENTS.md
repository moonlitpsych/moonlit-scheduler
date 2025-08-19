# Agent instructions

## Project intro

This is the Moonlit Scheduling Platform! This platform is designed to create the most incredibly seamless booking AND provider experience known to digital tools. A booking user can go through their experience on this tool knowing that Moonlit — the outpatient psychiatry clinic — will be able to accept their insurance, be available when the patient is available, and will provide all information needed for the patient to have a successful visit. The platform also provides login and calendar setting capacity for providers, who are MDs who need to be able to establish their profiles and set their schedules. All data moving through this app will be provided to our EHR, Athena, via an API. 


Follow these invariants to ensure the app runs identically from a clean slate.

## Golden Rules
1) **Never** run `npm install` in this repo; use `npm ci` for deterministic installs.
2) Respect the Node version from `.nvmrc` / `package.json:engines`. If not matched, instruct how to `nvm use` or use Volta.
3) If you add a dependency:
   - Prefer minimal deps.
   - Pin by adding to `package.json` (normal semver is OK since lockfile pins concrete versions).
   - Run `npm ci` to refresh `package-lock.json`.
   - Commit both file changes.
4) Do not delete or weaken existing tests unless explicitly instructed. Update or add tests alongside code changes.
5) All changes must keep `npm run check` and `npm run test:e2e` green.

## Fresh Start Procedure (always do this first)
- Run: `npm run fresh`
- If it fails, fix the cause with minimal changes and re-run until green.

## Testing Protocol
- Unit/integration: `npm test` (Vitest). Use jsdom environment for DOM.
- E2E: `npm run test:e2e` (Playwright) against `npm run preview`.

## Project Structure Expectations
- Source in `src/`.
- Tests in `tests/` with folders: `unit/`, `integration/`, `e2e/`.
- Mocks with MSW when network I/O is involved.
- Public assets in `public/`.

## Definition of Done for any change
- Code compiles: `npm run build`
- Static checks pass: `npm run check`
- E2E smoke passes: `npm run test:e2e`
- If new env vars are required, update `.env.example` with safe defaults and add a note in README.

## Performance & DX
- Prefer small, fast unit tests; keep e2e for smoke/regression.
- When touching build tooling, add/adjust a minimal test proving it works.

Follow these rules even when prior context is unavailable.