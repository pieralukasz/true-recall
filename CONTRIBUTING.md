# Contributing to True Recall

Thanks for your interest in contributing! This project is source-available under a custom license — please read the [LICENSE](LICENSE) before contributing.

## Reporting Bugs

1. Check [existing issues](https://github.com/pieralukasz/true-recall/issues) to avoid duplicates
2. Use the **Bug Report** template when creating a new issue
3. Include your plugin version, Obsidian version, and OS
4. Paste any console errors (Ctrl/Cmd+Shift+I → Console)

## Suggesting Features

Use the **Feature Request** template. Describe the problem you're trying to solve, not just the solution you want.

## Pull Requests

1. **Open an issue first** to discuss the change before writing code
2. Fork the repo and create a branch from `main`
3. Make your changes
4. Ensure all checks pass:
   ```bash
   bun run lint
   bun run test
   bun run build
   ```
5. Open a PR against `main` using the PR template
6. Wait for review — all PRs require maintainer approval

### Branch Model

- **Contributors**: Always open PRs against `main`
- **Releases**: Maintainer promotes `main → pre-release → release` via internal PRs
- **Tags**: Only created on the `release` branch

### Code Standards

- TypeScript with strict mode
- Follow existing patterns in the codebase
- No tautological comments (see `CLAUDE.md` for details)
- Use `ep:` prefix for all Tailwind classes

## License

By submitting a contribution, you agree that your work falls under the same [source-available license](LICENSE) as the rest of the project. The maintainer may incorporate contributions under any license, including proprietary ones.
