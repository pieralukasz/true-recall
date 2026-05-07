## Commands and Verification

### Root commands

- `bun run dev`
  Development build with hot reload via `esbuild.config.mjs`
- `bun run build`
  Production build. Runs TypeScript typecheck first, then production bundle
- `bun run test`
  Runs Vitest across the repo
- `bun run test:watch`
  Runs Vitest in watch mode
- `bun run test:coverage`
  Runs coverage
- `bun run biome`
  Runs `biome check --write packages/`
- `bun run format`
  Runs `biome format --write packages/`
- `bun run changelog`
  Generates changelog
- `bun run cli:build`
  Compiles the standalone CLI binary from `cli/index.ts`

### Important command rules

- Always use `bun run test`, never bare `bun test`
- The repo currently does not expose a root `bun run lint` script; linting is done with Biome
- Post-edit hooks run `bash .claude/hooks/lint-check.sh`
- Stop hooks run `bash .claude/hooks/build-check.sh`

### Build behavior

- The Obsidian plugin bundle entrypoint is `packages/obsidian/src/main.ts`
- `esbuild.config.mjs` outputs `main.js` in the repo root
- Tailwind builds `packages/obsidian/src/styles.css` into root `styles.css`
- If `VAULT` is set, build artifacts are copied into the target vault plugin directory

### Package-level testing

- `packages/core/tests` covers core domain and persistence behavior
- `packages/obsidian/tests` covers plugin, editor, and UI behavior
- Prefer targeted tests when touching one package, then run root verification before finishing substantial work
