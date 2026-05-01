## Release and Infrastructure

### Release flow

Protected branch flow:

`feature branches -> main -> pre-release -> release -> tag -> GitHub Release`

- `main`
  Active development
- `pre-release`
  Staging and review gate
- `release`
  Production branch used for tagging and releases

### Versioning

- Root version lives in `package.json`
- Plugin version also lives in `manifest.json`
- `versions.json` maps plugin versions to minimum Obsidian versions
- `bun run version` updates versioned release files

### Proxy and remote infra

- `true-recall-proxy` runs on ZimaBlade
- ZimaBlade alias: `ssh zimablade`
- Operational scripts for beta testers and proxy-related work should be treated as infra changes, not routine plugin edits

### AI provider model

- The product supports OpenRouter BYOK as well as True Recall Pro flows
- When changing AI behavior, inspect both domain logic in `packages/core/src/ai` and settings/UI surfaces in `packages/obsidian/src/settings`
