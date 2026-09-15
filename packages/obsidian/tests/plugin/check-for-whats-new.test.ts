import { beforeEach, describe, expect, it, vi } from "vitest";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { checkForWhatsNew } from "@true-recall/obsidian/plugin/check-for-whats-new";

const mocks = vi.hoisted(() => ({
	open: vi.fn(),
	createModal: vi.fn(),
}));

vi.mock("@true-recall/obsidian/modals/shared/WhatsNewModal", () => ({
	WhatsNewModal: class {
		constructor(...args: unknown[]) {
			mocks.createModal(...args);
		}
		open = mocks.open;
	},
}));

function createPlugin(previous: string | undefined, current = "2.5.1") {
	const plugin = {
		manifest: { version: current },
		settings: { lastSeenVersion: previous },
		saveSettings: vi.fn(async (patch: { lastSeenVersion: string }) => {
			Object.assign(plugin.settings, patch);
		}),
	};
	return {
		plugin: plugin as unknown as TrueRecallPlugin,
		saveSettings: plugin.saveSettings,
	};
}

describe("checkForWhatsNew", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.open.mockReset();
	});

	it("expands every unseen release while keeping older history available", async () => {
		const { plugin, saveSettings } = createPlugin("2.4.2");
		await checkForWhatsNew(plugin);

		expect(mocks.createModal).toHaveBeenCalledWith(
			plugin,
			expect.arrayContaining([
				expect.objectContaining({ version: "2.5.1" }),
				expect.objectContaining({ version: "2.5.0" }),
				expect.objectContaining({ version: "2.4.2" }),
			]),
			["2.5.1", "2.5.0"],
		);
		expect(mocks.open).toHaveBeenCalledOnce();
		expect(saveSettings).toHaveBeenCalledWith({ lastSeenVersion: "2.5.1" });

		await checkForWhatsNew(plugin);
		expect(mocks.open).toHaveBeenCalledOnce();
	});

	it("expands only the patch for someone who has already seen 2.5.0", async () => {
		const { plugin } = createPlugin("2.5.0");
		await checkForWhatsNew(plugin);
		expect(mocks.createModal.mock.calls[0]?.[2]).toEqual(["2.5.1"]);
	});

	it("records a fresh installation without showing old updates", async () => {
		const { plugin, saveSettings } = createPlugin(undefined);
		await checkForWhatsNew(plugin);
		expect(mocks.open).not.toHaveBeenCalled();
		expect(saveSettings).toHaveBeenCalledWith({ lastSeenVersion: "2.5.1" });
	});

	it.each([
		["2.5.1", "2.5.1"],
		["2.5.1", "2.5.0"],
		["2.5.0", "99.0.0"],
	])("does not advance the marker for %s → %s without a new documented release", async (previous, current) => {
		const { plugin, saveSettings } = createPlugin(previous, current);
		await checkForWhatsNew(plugin);
		expect(mocks.open).not.toHaveBeenCalled();
		expect(saveSettings).not.toHaveBeenCalled();
	});

	it("keeps notes unseen if the modal cannot be opened", async () => {
		const { plugin, saveSettings } = createPlugin("2.4.2");
		mocks.open.mockImplementationOnce(() => {
			throw new Error("modal failed");
		});
		await expect(checkForWhatsNew(plugin)).rejects.toThrow("modal failed");
		expect(saveSettings).not.toHaveBeenCalled();
	});
});
