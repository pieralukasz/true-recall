## Cross-Cutting Rules

### Code comments

- Do not add tautological comments that restate the code
- Add comments only for non-obvious business logic, edge cases, or sequencing constraints

### File operations

- Before editing or deleting documentation files, confirm with the user which docs should be preserved
- Never bulk-delete docs or planning files without explicit approval

### Git and commits

- Never add Claude as co-author or contributor in commit messages
- Respect the existing branch promotion flow: `feature -> main -> pre-release -> release`

### Build artifacts

- `styles.css` and `meta.json` use `skip-worktree`
- If a task requires committing them, temporarily remove `skip-worktree`, commit intentionally, then restore it

### Linting and formatting

- Biome is the default formatting and linting tool for this repo
- Existing ESLint disable comments still appear in code, but operationally this repo is verified with Biome plus build/test flow

### Architecture discipline

- Prefer small, local changes inside the relevant slice instead of spreading behavior across unrelated folders
- Reuse existing services and adapters before adding new abstractions
