import { describe, expect, it, vi } from "vitest";

import type { TrueRecallAppConfig } from "../../src/app/TrueRecallApp";
import { TrueRecallApp } from "../../src/app/TrueRecallApp";

type MetadataChangedCallback = (
	path: string,
	frontmatter: Record<string, unknown> | undefined,
) => void;

type FileRenamedCallback = (newPath: string, oldPath: string) => void;

function createConfig() {
	let metadataChangedCallback: MetadataChangedCallback | null = null;
	let fileRenamedCallback: FileRenamedCallback | null = null;

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
			onMetadataChanged: (cb: MetadataChangedCallback) => {
				metadataChangedCallback = cb;
				return () => {};
			},
			onFileDeleted: () => () => {},
			onFileRenamed: (cb: FileRenamedCallback) => {
				fileRenamedCallback = cb;
				return () => {};
			},
			onLayoutReady: () => {},
		},
	} as unknown as TrueRecallAppConfig;

	return {
		config,
		fireMetadataChanged: (path: string, frontmatter: Record<string, unknown>) =>
			metadataChangedCallback?.(path, frontmatter),
		fireFileRenamed: (newPath: string, oldPath: string) =>
			fileRenamedCallback?.(newPath, oldPath),
	};
}

async function createAppWithProject() {
	const helpers = createConfig();
	const app = new TrueRecallApp(helpers.config);
	await app.initialize();

	helpers.fireMetadataChanged("Project.md", { project: true });
	helpers.fireMetadataChanged("Notes/Old name.md", {
		flashcard_uid: "uid-123",
		parents: ["[[Project]]"],
	});

	return { app, ...helpers };
}

describe("TrueRecallApp — file rename invalidates the hierarchy graph", () => {
	it("keeps the note's UID in its project after a rename", async () => {
		const { app, fireFileRenamed } = await createAppWithProject();

		expect([
			...app.hierarchyService.getSourceUidsForProject("Project.md"),
		]).toEqual(["uid-123"]);

		fireFileRenamed("Notes/New name.md", "Notes/Old name.md");

		expect([
			...app.hierarchyService.getSourceUidsForProject("Project.md"),
		]).toEqual(["uid-123"]);
		expect(app.hierarchyService.getChildPaths("Project.md")).toEqual([
			"Notes/New name.md",
		]);
	});

	it("emits hierarchy:changed so caches downstream refresh", async () => {
		const { app, fireFileRenamed } = await createAppWithProject();
		const listener = vi.fn();
		app.events.on("hierarchy:changed", listener);

		fireFileRenamed("Notes/New name.md", "Notes/Old name.md");

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("ignores renames of notes outside the hierarchy", async () => {
		const { app, fireMetadataChanged, fireFileRenamed } =
			await createAppWithProject();
		fireMetadataChanged("Attachments/loose.md", { flashcard_uid: "uid-loose" });
		const listener = vi.fn();
		app.events.on("hierarchy:changed", listener);

		fireFileRenamed("Attachments/renamed.md", "Attachments/loose.md");

		expect(listener).not.toHaveBeenCalled();
	});
});
