import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BETA_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

function fail(message: string): never {
	console.error(`Beta release aborted: ${message}`);
	process.exit(1);
}

function capture(command: string, args: string[]): string {
	return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function run(command: string, args: string[]): void {
	const result = spawnSync(command, args, { stdio: "inherit" });
	if (result.error) fail(result.error.message);
	if (result.status !== 0) {
		fail(
			`'${command} ${args.join(" ")}' exited with ${result.status ?? "no status"}`,
		);
	}
}

function usage(): void {
	console.log(`Usage: bun run release:beta -- <base-version> [--dry-run]

Examples:
  bun run release:beta -- 1.10.0 --dry-run
  bun run release:beta -- 1.10.0

The command must run from a clean, fully pushed pre-release branch. It fetches
remote tags, chooses the next 1.10.0-beta.N tag, runs tests and a production
build, then creates and pushes the tag. Pushing the tag publishes a GitHub
prerelease for BRAT through the release workflow.`);
}

function compareVersions(a: number[], b: number[]): number {
	for (let index = 0; index < 3; index++) {
		const difference = (a[index] ?? 0) - (b[index] ?? 0);
		if (difference !== 0) return difference;
	}
	return 0;
}

function parseVersion(version: string, label: string): number[] {
	const match = version.match(BETA_VERSION);
	if (!match) fail(`${label} '${version}' must use X.Y.Z format`);
	return match.slice(1).map(Number);
}

function nextBetaTag(baseVersion: string, tags: string[]): string {
	const escaped = baseVersion.replaceAll(".", "\\.");
	const pattern = new RegExp(`^${escaped}-beta\\.(\\d+)$`);
	let highest = 0;
	for (const tag of tags) {
		const match = tag.match(pattern);
		if (match) highest = Math.max(highest, Number(match[1]));
	}
	return `${baseVersion}-beta.${highest + 1}`;
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
	usage();
	process.exit(0);
}

const dryRun = args.includes("--dry-run");
const unsupportedFlags = args.filter(
	(argument) => argument.startsWith("-") && argument !== "--dry-run",
);
if (unsupportedFlags.length > 0) {
	fail(`unknown option ${unsupportedFlags.join(", ")}`);
}

const positional = args.filter((argument) => !argument.startsWith("-"));
if (positional.length !== 1) {
	usage();
	fail("provide exactly one stable base version");
}

const baseVersion = positional[0];
if (!baseVersion) fail("missing base version");
const baseParts = parseVersion(baseVersion, "Base version");
const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as {
	version?: unknown;
};
if (typeof manifest.version !== "string") {
	fail("manifest.json does not contain a string version");
}
const stableParts = parseVersion(manifest.version, "Manifest version");
// The manifest carries the version currently being prepared, so a beta for that
// same version is expected; only an older base is a mistake.
if (compareVersions(baseParts, stableParts) < 0) {
	fail(
		`beta base ${baseVersion} is older than manifest version ${manifest.version}`,
	);
}

const branch = capture("git", ["branch", "--show-current"]);
if (branch !== "pre-release") {
	fail(
		`current branch is '${branch || "detached HEAD"}', expected 'pre-release'`,
	);
}
if (capture("git", ["status", "--porcelain"])) {
	fail("working tree is not clean");
}

console.log("Fetching pre-release and release tags from origin...");
run("git", ["fetch", "origin", "--tags"]);

const head = capture("git", ["rev-parse", "HEAD"]);
const remoteHead = capture("git", ["rev-parse", "origin/pre-release"]);
if (head !== remoteHead) {
	fail("pre-release must be fully pushed and match origin/pre-release");
}

const tags = capture("git", ["tag", "--list"]).split("\n").filter(Boolean);
const tag = nextBetaTag(baseVersion, tags);

console.log(`Next beta tag: ${tag}`);
console.log(`Commit: ${head}`);
if (dryRun) {
	console.log("Dry run complete; no tag was created or pushed.");
	process.exit(0);
}

console.log("Running release verification...");
run("bun", ["run", "test"]);
run("bun", ["run", "build"]);
if (capture("git", ["status", "--porcelain"])) {
	fail("verification changed tracked files; review them before releasing");
}

run("git", ["tag", "-a", tag, "-m", `Beta release ${tag}`]);
run("git", ["push", "origin", tag]);
console.log(
	`Published ${tag}; GitHub Actions will create the BRAT prerelease.`,
);
