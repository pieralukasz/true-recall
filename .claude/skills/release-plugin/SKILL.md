---
name: release-plugin
description: This skill should be used when the user asks to "release the plugin", "create a new version", "tag and publish", "do a release", "bump version", "publish new release", or mentions releasing, versioning, or tagging the Obsidian plugin. Guides through the full release workflow including pre-flight checks, version bumping, tagging, and pushing.
---

# Release Plugin

Orchestrate the full release workflow for the True Recall Obsidian plugin. The process ensures all checks pass before creating a versioned tag that triggers the GitHub Actions release pipeline.

## Pre-Flight Checks

Before starting, verify the codebase is release-ready:

1. **Clean working tree** - Run `git status`. All changes intended for this release must be committed. Uncommitted changes block the release.
2. **Build passes** - Run `npm run build`. A failing build means the release will fail in CI.
3. **Tests pass** - Run `npm test`. Do not release with failing tests.
4. **Lint passes** - Run `npm run lint`. Fix any lint errors before proceeding.
5. **On correct branch** - Verify the current branch is `main`. Releases should only be created from main.

If any check fails, stop and fix the issue before continuing. Do not skip checks.

## Version Selection

Ask the user which version bump type to apply:

| Type    | When to use                                    | Example         |
|---------|------------------------------------------------|-----------------|
| `patch` | Bug fixes, small tweaks, no new features       | 0.1.0 -> 0.1.1 |
| `major` | Breaking changes, major rewrites               | 0.1.0 -> 1.0.0 |
| `minor` | New features, non-breaking enhancements        | 0.1.0 -> 0.2.0 |

Read the current version from `manifest.json` and present it to the user alongside the computed next version for each bump type.

## Version Bump Process

The project uses npm's built-in versioning which triggers `version-bump.mjs` automatically:

```bash
npm version <patch|minor|major> --no-git-tag-version
```

The `--no-git-tag-version` flag is critical - it prevents npm from creating its own git tag, allowing manual control over the tag step.

After `npm version` runs, `version-bump.mjs` automatically updates:
- `manifest.json` - plugin version field
- `versions.json` - maps plugin version to minimum Obsidian app version

Verify all three files have the correct new version:
- `package.json`
- `manifest.json`
- `versions.json`

## Commit and Tag

1. Stage the version files:
   ```bash
   git add package.json manifest.json versions.json
   ```

2. Commit with a clear message:
   ```bash
   git commit -m "release: vX.Y.Z"
   ```
   IMPORTANT: Per CLAUDE.md - never add Claude as co-author.

3. Create an annotated tag matching the version:
   ```bash
   git tag -a X.Y.Z -m "X.Y.Z"
   ```
   The tag must NOT have a `v` prefix - Obsidian's community plugin system expects bare semver tags (e.g. `1.2.3`, not `v1.2.3`).

## Push

Push the commit and tag together:

```bash
git push origin main --follow-tags
```

This triggers the GitHub Actions workflow at `.github/workflows/release.yml` which:
1. Checks out the tagged commit
2. Runs `npm install && npm run build`
3. Creates a **draft** GitHub release with `main.js`, `manifest.json`, and `styles.css`

## Post-Release

After pushing, inform the user:
- The GitHub Actions workflow is building the release
- Link: `https://github.com/pieralukasz/true-recall/actions`
- Once the workflow completes, a **draft** release will appear at `https://github.com/pieralukasz/true-recall/releases`
- The user must manually edit the draft, add release notes, and click "Publish release"
- For the first public release, the plugin must also be submitted to the Obsidian community plugin directory

## Error Recovery

**Build fails in CI:**
The draft release will not be created. Fix the build locally, delete the tag, create a new one:
```bash
git tag -d X.Y.Z
git push origin :refs/tags/X.Y.Z
```
Then fix, commit, re-tag, and push again.

**Wrong version tagged:**
Delete the tag locally and remotely (same commands as above), revert the version bump commit, and start over.

**npm version fails:**
Check that `package.json` has a valid semver `version` field. The `version` script in package.json depends on `version-bump.mjs` existing at the project root.
