import { describe, expect, it, vi } from "vitest";

import type { TrueRecallAppConfig } from "../../src/app/TrueRecallApp";
import { TrueRecallApp } from "../../src/app/TrueRecallApp";
import { DEFAULT_SETTINGS } from "../../src/constants";
import type { TrueRecallSettings } from "../../src/types";

function cloneSettings(): TrueRecallSettings {
	return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as TrueRecallSettings;
}

async function createApp() {
	const save = vi.fn(async (_settings: TrueRecallSettings) => {});
	const config = {
		fileSystem: {},
		frontmatter: {},
		metadataIndex: {},
		persistence: {},
		notification: { show: vi.fn(), error: vi.fn() },
		httpClient: {},
		settingsPersistence: {
			load: vi.fn(async () => cloneSettings()),
			save,
		},
		linkResolver: { resolveLink: () => null },
		vaultEvents: {
			onMetadataChanged: () => () => {},
			onFileDeleted: () => () => {},
			onFileRenamed: () => () => {},
			onLayoutReady: () => {},
		},
	} as unknown as TrueRecallAppConfig;
	const app = new TrueRecallApp(config);
	await app.initialize();
	save.mockClear();
	return { app, save };
}

describe("TrueRecallApp settings persistence", () => {
	it("rolls memory back and rejects when persistence fails", async () => {
		const { app, save } = await createApp();
		save.mockRejectedValueOnce(new Error("disk full"));

		await expect(
			app.updateSettings({ cloudSyncEmail: "private@example.com" }),
		).rejects.toThrow("disk full");

		expect(app.settings.cloudSyncEmail).toBeUndefined();
	});

	it("serializes the full mutate-save-publish transaction", async () => {
		const { app, save } = await createApp();
		let releaseFirst = () => {};
		const firstPending = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		const snapshots: TrueRecallSettings[] = [];
		save.mockImplementation(async (settings: TrueRecallSettings) => {
			snapshots.push(settings);
			if (snapshots.length === 1) await firstPending;
		});

		const first = app.updateSettings({ apiPort: 30001 });
		const second = app.updateSettings({ enableLocalApi: true });
		await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
		releaseFirst();
		await Promise.all([first, second]);

		expect(snapshots).toHaveLength(2);
		expect(snapshots[0]).toMatchObject({
			apiPort: 30001,
			enableLocalApi: false,
		});
		expect(snapshots[1]).toMatchObject({
			apiPort: 30001,
			enableLocalApi: true,
		});
		expect(app.settings).toMatchObject({
			apiPort: 30001,
			enableLocalApi: true,
		});
	});

	it("continues queued updates from the rolled-back state after a save fails", async () => {
		const { app, save } = await createApp();
		save.mockRejectedValueOnce(new Error("disk full"));

		const failed = app.updateSettings({
			cloudSyncEmail: "must-not-leak@example.com",
		});
		const next = app.updateSettings({ apiPort: 31000 });

		await expect(failed).rejects.toThrow("disk full");
		await expect(next).resolves.toBeUndefined();

		expect(save).toHaveBeenCalledTimes(2);
		expect(save.mock.calls[1]?.[0]).toMatchObject({ apiPort: 31000 });
		expect(save.mock.calls[1]?.[0].cloudSyncEmail).toBeUndefined();
		expect(app.settings.apiPort).toBe(31000);
		expect(app.settings.cloudSyncEmail).toBeUndefined();
	});
});
