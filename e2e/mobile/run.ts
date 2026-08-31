/**
 * Scenario E2E suite for True Recall on Obsidian Android.
 *
 * Runs against a live emulator (or USB device) prepared as described in
 * README.md: Obsidian installed, a test vault with the plugin enabled.
 * Drives the app through adb (taps, keys, process kills) and the WebView
 * DevTools protocol (DOM clicks, assertions on the live SQLite store).
 *
 * Usage: bun e2e/mobile/run.ts
 * Env:   E2E_VAULT (default /sdcard/Documents/TestVault)
 *        E2E_NOTE  (default Biology)
 *        ADB       (default: adb from PATH or the homebrew platform-tools)
 */

import { type CdpClient, connectCdp } from "./cdp-client";

const VAULT = process.env.E2E_VAULT ?? "/sdcard/Documents/TestVault";
const NOTE = process.env.E2E_NOTE ?? "Biology";
const EXPECTED_VAULT_NAME = VAULT.split("/").filter(Boolean).at(-1) ?? VAULT;
const CDP_PORT = 9223;
const APP = "md.obsidian";
const RUN_TAG = `e2e${Date.now().toString(36).slice(-6)}`;

// ── host helpers ─────────────────────────────────────────────────────────

function findAdb(): string {
	if (process.env.ADB) return process.env.ADB;
	const candidates = [
		"adb",
		"/opt/homebrew/share/android-commandlinetools/platform-tools/adb",
		`${process.env.HOME}/Library/Android/sdk/platform-tools/adb`,
	];
	for (const candidate of candidates) {
		try {
			const probe = Bun.spawnSync([candidate, "version"], { stderr: "ignore" });
			if (probe.exitCode === 0) return candidate;
		} catch {
			// binary not present at this path; try the next candidate
		}
	}
	throw new Error("adb not found; set ADB env var");
}

const ADB = findAdb();

function sh(cmd: string[], allowFail = false): string {
	const result = Bun.spawnSync(cmd, { stderr: "pipe" });
	if (result.exitCode !== 0 && !allowFail) {
		throw new Error(
			`command failed: ${cmd.join(" ")}\n${result.stderr.toString()}`,
		);
	}
	return result.stdout.toString().trim();
}

const adb = (...args: string[]) => sh([ADB, ...args]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function sqliteCount(dbFile: string, sql: string): number {
	return Number(sh(["sqlite3", dbFile, sql]));
}

// ── device/CDP session ───────────────────────────────────────────────────

let cdp: CdpClient | null = null;

async function reconnect(): Promise<void> {
	cdp?.close();
	cdp = null;
	const pid = adb("shell", "pidof", APP);
	if (!pid) throw new Error("Obsidian is not running");
	sh([ADB, "forward", "--remove-all"], true);
	adb(
		"forward",
		`tcp:${CDP_PORT}`,
		`localabstract:webview_devtools_remote_${pid}`,
	);
	const raw = await (await fetch(`http://localhost:${CDP_PORT}/json`)).text();
	const pageId = /"id": "([A-F0-9]+)"/.exec(raw)?.[1];
	if (!pageId) throw new Error("no CDP page target found");
	cdp = await connectCdp(CDP_PORT, pageId);
}

async function js<T = unknown>(expression: string): Promise<T> {
	if (!cdp) await reconnect();
	if (!cdp) throw new Error("no CDP session");
	try {
		return await cdp.evaluate<T>(expression);
	} catch (err) {
		// The socket dies silently when the app restarts or the forward
		// drops; one reconnect covers every scenario boundary.
		if (err instanceof Error && err.message.includes("page exception")) {
			throw err;
		}
		await reconnect();
		if (!cdp) throw new Error("no CDP session after reconnect");
		return cdp.evaluate<T>(expression);
	}
}

async function waitFor(
	label: string,
	expression: string,
	timeoutMs = 60_000,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			if (await js<boolean>(expression)) return;
		} catch {
			// page might be mid-reload; retry
		}
		await sleep(1000);
	}
	throw new Error(`timeout waiting for: ${label}`);
}

async function launchAppAndWait(): Promise<void> {
	adb("shell", "am", "start", "-n", `${APP}/.MainActivity`);
	await sleep(8000);
	// The WebView target changes identity on every process start.
	const deadline = Date.now() + 120_000;
	for (;;) {
		try {
			await reconnect();
			break;
		} catch (err) {
			if (Date.now() > deadline) throw err;
			await sleep(3000);
		}
	}
	await waitFor(
		"plugin loaded with store",
		`!!(app.plugins?.plugins?.["true-recall"]?.coreApp?.cardStore && app.workspace.layoutReady)`,
		120_000,
	);
}

// clicks the first element under `rootSelector` whose trimmed text equals `text`
function clickByText(rootSelector: string, text: string): string {
	return `(() => {
		const root = document.querySelector(${JSON.stringify(rootSelector)});
		if (!root) return false;
		const target = [...root.querySelectorAll("*")].find(
			(el) => el.childElementCount === 0 && el.textContent.trim() === ${JSON.stringify(text)},
		);
		if (!target) return false;
		(target.closest("[role=button], button, .ep-btn") ?? target).click();
		return true;
	})()`;
}

async function typeIntoField(fieldIndex: number, text: string): Promise<void> {
	const focused = await js<boolean>(`(() => {
		const editors = [...document.querySelectorAll(".modal .cm-editor .cm-content")];
		const target = editors[${fieldIndex}];
		if (!target) return false;
		target.focus();
		return document.activeElement === target || target.contains(document.activeElement);
	})()`);
	if (!focused) throw new Error(`cannot focus field #${fieldIndex}`);
	adb("shell", "input", "text", text.replace(/ /g, "%s"));
	await sleep(600);
}

// ── scenario framework ───────────────────────────────────────────────────

type Scenario = { name: string; run: () => Promise<void> };
const results: { name: string; ok: boolean; error?: string; ms: number }[] = [];

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(`assertion failed: ${message}`);
}

// state shared between scenarios
let dbDevicePath = "";
const pulledDb = "/tmp/true-recall-e2e.db";

function pullDb(): void {
	adb("pull", dbDevicePath, pulledDb);
}

// ── scenarios ────────────────────────────────────────────────────────────

const scenarios: Scenario[] = [
	{
		name: "S1 plugin boots: WASM store, schema v3, mobile view allowlist",
		run: async () => {
			await launchAppAndWait();
			const state = await js<{
				schema: string | null;
				deviceId: string;
				views: string[];
				dbPath: string;
				vaultName: string;
			}>(`(() => {
				const p = app.plugins.plugins["true-recall"];
				const db = p.coreApp.cardStore.getSqliteDb();
				return {
					schema: db.query("SELECT value FROM meta WHERE key='schema_version'")[0]?.value ?? null,
					deviceId: p.deviceIdService.getDeviceId(),
					views: Object.keys(app.viewRegistry.viewByType).filter(k => k.startsWith("true-recall")).sort(),
					dbPath: p.coreApp.cardStore.getPersistenceDebugInfo().dbPath,
					vaultName: app.vault.getName(),
				};
			})()`);
			assert(
				state.vaultName === EXPECTED_VAULT_NAME,
				`active vault is ${state.vaultName}, want ${EXPECTED_VAULT_NAME}`,
			);
			assert(state.schema === "3", `schema_version is ${state.schema}, want 3`);
			assert(
				/^[a-z0-9]{8}$/.test(state.deviceId),
				`device id ${state.deviceId}`,
			);
			assert(
				state.views.join(",") ===
					"true-recall-dashboard-view,true-recall-flashcard-panel,true-recall-review,true-recall-stats",
				`mobile views: ${state.views.join(",")}`,
			);
			dbDevicePath = `${VAULT}/${state.dbPath}`;
		},
	},
	{
		name: "S2 add two cards through the quick editor UI",
		run: async () => {
			const before = await js<number>(
				`app.plugins.plugins["true-recall"].coreApp.cardStore.getSqliteDb().query("SELECT count(*) n FROM cards WHERE deleted_at IS NULL")[0].n`,
			);
			await js(`(async () => {
				await app.workspace.openLinkText(${JSON.stringify(NOTE)}, "");
				await new Promise(r => setTimeout(r, 500));
				return app.commands.executeCommandById("true-recall:add-flashcard");
			})()`);
			await waitFor(
				"quick editor modal",
				`!!document.querySelector(".modal .cm-editor")`,
				20_000,
			);
			await typeIntoField(0, `Q1 ${RUN_TAG}`);
			await typeIntoField(1, `A1 ${RUN_TAG}`);
			// blur instead of the BACK key: BACK can dismiss the whole modal
			await js(`document.activeElement?.blur()`);
			await sleep(500);
			assert(
				await js<boolean>(clickByText(".modal", "Save & add another")),
				"Save & add another button not found",
			);
			await waitFor(
				"first card saved",
				`app.plugins.plugins["true-recall"].coreApp.cardStore.getSqliteDb().query("SELECT count(*) n FROM cards WHERE deleted_at IS NULL")[0].n === ${before + 1}`,
				15_000,
			);
			// createNote() writes before the asynchronous command finishes. Wait for
			// the editor to clear and re-enable Done so the next click cannot race the
			// first save's disabled state.
			await waitFor(
				"quick editor ready for second card",
				`(() => {
					const buttons = [...document.querySelectorAll(".modal [role=button], .modal button")];
					const done = buttons.find((button) => button.textContent.trim() === "Done");
					const fields = [...document.querySelectorAll(".modal .cm-editor .cm-content")];
					return !!done && done.getAttribute("aria-disabled") !== "true" && fields.length >= 2 && fields.every((field) => !field.textContent.trim());
				})()`,
				15_000,
			);
			await typeIntoField(0, `Q2 ${RUN_TAG}`);
			await typeIntoField(1, `A2 ${RUN_TAG}`);
			await js(`document.activeElement?.blur()`);
			await sleep(500);
			assert(
				await js<boolean>(clickByText(".modal", "Done")),
				"Done button not found",
			);
			await waitFor(
				"modal closed and second card saved",
				`!document.querySelector(".modal .cm-editor") && app.plugins.plugins["true-recall"].coreApp.cardStore.getSqliteDb().query("SELECT count(*) n FROM cards WHERE deleted_at IS NULL")[0].n === ${before + 2}`,
				15_000,
			);
		},
	},
	{
		name: "S3 review the note and grade a card",
		run: async () => {
			const logsBefore = await js<number>(
				`app.plugins.plugins["true-recall"].coreApp.cardStore.getSqliteDb().query("SELECT count(*) n FROM review_log")[0].n`,
			);
			await js(`(async () => {
				await app.workspace.openLinkText(${JSON.stringify(NOTE)}, "");
				await new Promise(r => setTimeout(r, 500));
				return app.commands.executeCommandById("true-recall:review-current-note");
			})()`);
			await waitFor(
				"review view with Show answer",
				`!!document.querySelector(".true-recall-review-buttons")`,
				20_000,
			);
			assert(
				await js<boolean>(
					clickByText(".true-recall-review-buttons", "Show answer"),
				),
				"Show answer not found",
			);
			await sleep(800);
			assert(
				await js<boolean>(clickByText(".true-recall-review-buttons", "Good")),
				"Good button not found",
			);
			await waitFor(
				"review log grew",
				`app.plugins.plugins["true-recall"].coreApp.cardStore.getSqliteDb().query("SELECT count(*) n FROM review_log")[0].n === ${logsBefore + 1}`,
				15_000,
			);
		},
	},
	{
		name: "S4 grade survives HOME + immediate process kill",
		run: async () => {
			// let the debounced flush from S3 land so the disk is a clean baseline
			const memBefore = await js<number>(
				`app.plugins.plugins["true-recall"].coreApp.cardStore.getSqliteDb().query("SELECT count(*) n FROM review_log")[0].n`,
			);
			const deadline = Date.now() + 20_000;
			for (;;) {
				pullDb();
				if (
					sqliteCount(pulledDb, "SELECT count(*) FROM review_log") === memBefore
				)
					break;
				if (Date.now() > deadline)
					throw new Error("disk never caught up with memory");
				await sleep(1000);
			}
			// grade the second fresh card, still on screen after S3
			await waitFor(
				"next card ready",
				`!!document.querySelector(".true-recall-review-buttons")`,
				15_000,
			);
			assert(
				await js<boolean>(
					clickByText(".true-recall-review-buttons", "Show answer"),
				),
				"Show answer not found for second card",
			);
			await sleep(800);
			assert(
				await js<boolean>(clickByText(".true-recall-review-buttons", "Good")),
				"Good button not found for second card",
			);
			// the realistic worst case: user backgrounds the app and the OS
			// kills it right after; visibilitychange must have flushed by then
			adb("shell", "input", "keyevent", "3");
			await sleep(1200);
			adb("shell", "am", "force-stop", APP);
			pullDb();
			const diskAfter = sqliteCount(
				pulledDb,
				"SELECT count(*) FROM review_log",
			);
			assert(
				diskAfter === memBefore + 1,
				`on-disk review_log: ${memBefore} -> ${diskAfter}, want +1`,
			);
			// relaunch and confirm the store agrees with the disk
			await launchAppAndWait();
			const inMemory = await js<number>(
				`app.plugins.plugins["true-recall"].coreApp.cardStore.getSqliteDb().query("SELECT count(*) n FROM review_log")[0].n`,
			);
			assert(
				inMemory === diskAfter,
				`in-memory ${inMemory} != on-disk ${diskAfter} after relaunch`,
			);
		},
	},
	{
		name: "S5 manual 'Sync devices now' reports a result",
		run: async () => {
			const outcome = await js<{
				ran: boolean;
				notices: string[];
			}>(`(async () => {
				const ran = app.commands.executeCommandById("true-recall:sync-devices-now");
				await new Promise(r => setTimeout(r, 3000));
				return { ran, notices: [...activeDocument.querySelectorAll(".notice")].map(n => n.textContent) };
			})()`);
			assert(outcome.ran, "sync command unavailable");
			assert(
				outcome.notices.some(
					(n) => n.includes("up to date") || n.includes("Synced"),
				),
				`no sync notice, got: ${JSON.stringify(outcome.notices)}`,
			);
		},
	},
	{
		name: "S6 dashboard shows the save/sync status chip",
		run: async () => {
			await js(`app.commands.executeCommandById("true-recall:open-dashboard")`);
			await waitFor(
				"status chip",
				`[...document.querySelectorAll("[data-type='true-recall-dashboard-view'] span")].some(s => s.textContent === "Saved locally" || s.textContent === "Saving…")`,
				20_000,
			);
		},
	},
];

// ── main ─────────────────────────────────────────────────────────────────

console.log(`True Recall mobile E2E (vault: ${VAULT}, tag: ${RUN_TAG})`);
adb("get-state"); // fails early when no device is connected

for (const scenario of scenarios) {
	const start = Date.now();
	try {
		await scenario.run();
		results.push({ name: scenario.name, ok: true, ms: Date.now() - start });
		console.log(`PASS ${scenario.name} (${Date.now() - start}ms)`);
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		results.push({
			name: scenario.name,
			ok: false,
			error,
			ms: Date.now() - start,
		});
		console.error(`FAIL ${scenario.name}: ${error}`);
	}
}

cdp?.close();
const failed = results.filter((r) => !r.ok);
console.log(
	`\n${results.length - failed.length}/${results.length} scenarios passed`,
);
process.exit(failed.length === 0 ? 0 : 1);
