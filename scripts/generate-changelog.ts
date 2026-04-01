import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const CATEGORIES: Record<string, string> = {
	feat: "### Features",
	fix: "### Bug Fixes",
	refactor: "### Improvements",
	perf: "### Performance",
};

const SKIP_PREFIXES = [
	"chore",
	"ci",
	"docs",
	"test",
	"build",
	"style",
	"release",
];

const isPreview = process.argv.includes("--preview");

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version: string = pkg.version;

const tags = execSync("git tag --sort=-version:refname", { encoding: "utf8" })
	.trim()
	.split("\n")
	.filter(Boolean);

const previousTag = tags[0];
if (!previousTag) {
	console.error("No previous tag found");
	process.exit(1);
}

const range = `${previousTag}..HEAD`;
const rawLog = execSync(
	`git log --first-parent --oneline --no-merges ${range}`,
	{
		encoding: "utf8",
	},
).trim();

if (!rawLog) {
	console.log("No commits found in range", range);
	process.exit(0);
}

const commits = rawLog
	.split("\n")
	.map((line) => {
		const match = line.match(/^[a-f0-9]+ (\w+)(?:\(([^)]*)\))?: (.+)$/);
		if (!match) return null;
		const [, type, scope, message] = match;
		return {
			type: type.toLowerCase(),
			scope: scope ?? null,
			message: message.trim(),
		};
	})
	.filter(Boolean);

const grouped = new Map<string, string[]>();

for (const commit of commits) {
	if (!commit) continue;
	if (SKIP_PREFIXES.includes(commit.type)) continue;

	const header = CATEGORIES[commit.type];
	if (!header) continue;

	if (!grouped.has(header)) grouped.set(header, []);
	const desc = commit.scope
		? `**${commit.scope}:** ${commit.message}`
		: commit.message;
	grouped.get(header)?.push(`- ${desc}`);
}

if (grouped.size === 0) {
	console.log("No user-facing changes found in range", range);
	process.exit(0);
}

const today = new Date().toISOString().split("T")[0];
const lines = [`## ${version} (${today})`, ""];

for (const [header, items] of grouped) {
	lines.push(header, "");
	for (const item of items) lines.push(item);
	lines.push("");
}

const entry = lines.join("\n");
console.log(entry);

if (!isPreview) {
	const changelogPath = "CHANGELOG.md";
	let existing = "";
	if (existsSync(changelogPath)) {
		existing = readFileSync(changelogPath, "utf8");
	}

	const header = "# Changelog\n\n";
	const body = existing.startsWith("# Changelog")
		? existing.replace(/^# Changelog\n+/, "")
		: existing;

	writeFileSync(changelogPath, `${header}${entry}\n${body}`);
	console.log(`\nWritten to ${changelogPath}`);
}
