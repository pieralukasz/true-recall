import { describe, expect, it, vi } from "vitest";

import type { TrueRecallAppConfig } from "../../src/app/TrueRecallApp";
import { TrueRecallApp } from "../../src/app/TrueRecallApp";

function createConfig() {
	let fileDeletedCallback: ((path: string) => void) | null = null;
	let metadataChangedCallback:
		| ((path: string, frontmatter: Record<string, unknown> | undefined) => void)
		| null = null;

	const config = {
		fileSystem: {},
		frontmatter: {},
		metadataIndex: {},
		persistence: {},
		notification: { show: vi.fn(), error: vi.fn() },
		httpClient: {},
		settingsPersistence: {
			load: vi.fn(async () => null),
			save: vi.fn(async () => {}),
		},
		linkResolver: { resolveLink: () => null },
		vaultEvents: {
			onMetadataChanged: (cb: typeof metadataChangedCallback) => {
				metadataChangedCallback = cb;
				return () => {};
			},
			onFileDeleted: (cb: (path: string) => void) => {
				fileDeletedCallback = cb;
				return () => {};
			},
			onFileRenamed: () => () => {},
			onLayoutReady: () => {},
		},
	} as unknown as TrueRecallAppConfig;

	return {
		config,
		fireFileDeleted: (path: string) => fileDeletedCallback?.(path),
		fireMetadataChanged: (path: string, frontmatter: Record<string, unknown>) =>
			metadataChangedCallback?.(path, frontmatter),
	};
}

describe("TrueRecallApp — file deletion hook ordering", () => {
	it("runs deletion hooks while the frontmatter index still resolves the path", async () => {
		const { config, fireFileDeleted, fireMetadataChanged } = createConfig();
		const app = new TrueRecallApp(config);
		await app.initialize();

		fireMetadataChanged("Notes/source.md", { flashcard_uid: "uid-123" });
		expect(
			app.frontmatterIndex.getValues("flashcard_uid", "Notes/source.md"),
		).toEqual(["uid-123"]);

		const seenUids: string[][] = [];
		app.registerFileDeletionHook((path) => {
			seenUids.push(app.frontmatterIndex.getValues("flashcard_uid", path));
		});

		fireFileDeleted("Notes/source.md");

		expect(seenUids).toEqual([["uid-123"]]);
		expect(
			app.frontmatterIndex.getValues("flashcard_uid", "Notes/source.md"),
		).toEqual([]);
	});

	it("still clears the index when a hook throws", async () => {
		const { config, fireFileDeleted, fireMetadataChanged } = createConfig();
		const app = new TrueRecallApp(config);
		await app.initialize();
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		fireMetadataChanged("Notes/source.md", { flashcard_uid: "uid-123" });
		app.registerFileDeletionHook(() => {
			throw new Error("boom");
		});

		fireFileDeleted("Notes/source.md");

		expect(
			app.frontmatterIndex.getValues("flashcard_uid", "Notes/source.md"),
		).toEqual([]);
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});
});
