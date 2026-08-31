/** Evaluate JavaScript in the running Obsidian Android WebView over CDP. */

import { connectCdp } from "./cdp-client";

const expression = process.argv.slice(2).join(" ");
if (!expression)
	throw new Error("usage: bun e2e/mobile/eval.ts '<expression>'");

function findAdb(): string {
	if (process.env.ADB) return process.env.ADB;
	for (const candidate of [
		"adb",
		"/opt/homebrew/share/android-commandlinetools/platform-tools/adb",
		`${process.env.HOME}/Library/Android/sdk/platform-tools/adb`,
	]) {
		const result = Bun.spawnSync([candidate, "version"], { stderr: "ignore" });
		if (result.exitCode === 0) return candidate;
	}
	throw new Error("adb not found; set ADB env var");
}

const adb = findAdb();
const pidResult = Bun.spawnSync([adb, "shell", "pidof", "md.obsidian"]);
const pid = pidResult.stdout.toString().trim();
if (!pid) throw new Error("Obsidian is not running");

Bun.spawnSync([adb, "forward", "--remove-all"]);
const port = 9223;
const forward = Bun.spawnSync([
	adb,
	"forward",
	`tcp:${port}`,
	`localabstract:webview_devtools_remote_${pid}`,
]);
if (forward.exitCode !== 0) throw new Error(forward.stderr.toString());

const targets = (await (
	await fetch(`http://127.0.0.1:${port}/json`)
).json()) as {
	id?: string;
}[];
const pageId = targets.find((target) => target.id)?.id;
if (!pageId) throw new Error("no CDP page target found");

const client = await connectCdp(port, pageId);
try {
	const value = await client.evaluate(expression);
	console.log(typeof value === "string" ? value : JSON.stringify(value));
} finally {
	client.close();
}
