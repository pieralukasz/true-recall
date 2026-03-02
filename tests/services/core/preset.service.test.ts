import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
	App,
	Vault,
	MetadataCache,
	TFile,
	CachedMetadata,
} from "obsidian";
import { FrontmatterIndexService } from "../../../src/features/core/services/frontmatter-index.service";
import { FolderProjectService } from "../../../src/features/core/services/folder-project.service";
import { ProjectLinkService } from "../../../src/features/core/services/project-link.service";
import { PresetService } from "../../../src/features/core/services/preset.service";
import type {
	FSRSPreset,
	TrueRecallSettings,
} from "../../../src/shared/types/settings.types";
import type { FSRSFlashcardItem } from "../../../src/shared/types/fsrs";

function makePreset(name: string, id?: string): FSRSPreset {
	return {
		id: id ?? crypto.randomUUID(),
		name,
		requestRetention: 0.9,
		maximumInterval: 36500,
		weights: null,
		learningSteps: [1, 10],
		relearningSteps: [10],
		newCardsPerDay: 20,
		reviewsPerDay: 200,
		createdAt: Date.now(),
		lastOptimization: null,
		lastOptimizationReviewCount: null,
		lastOptimizationMetrics: null,
	};
}

function makeCard(sourceUid?: string): FSRSFlashcardItem {
	return {
		id: "card-1",
		sourceUid,
		sourceNoteName: "TestNote",
		question: "Q",
		answer: "A",
		fsrs: {
			state: 0,
			due: new Date().toISOString(),
			stability: 0,
			difficulty: 0,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: 0,
			lapses: 0,
			lastReview: null,
			suspended: false,
			buriedUntil: null,
		},
	} as FSRSFlashcardItem;
}

describe("PresetService — 4-tier resolution", () => {
	let mockApp: App;
	let mockVault: Vault;
	let mockMetadataCache: MetadataCache;
	let mockFiles: TFile[];
	let mockCacheData: Map<string, CachedMetadata>;
	let resolvedLinks: Record<string, Record<string, number>>;
	let frontmatterIndex: FrontmatterIndexService;
	let projectLinkService: ProjectLinkService;
	let folderProjectService: FolderProjectService;
	let presetService: PresetService;
	let settings: TrueRecallSettings;

	const defaultPreset = makePreset("Default", "default-id");
	const medicalPreset = makePreset("Medical", "medical-id");
	const sciencePreset = makePreset("Science", "science-id");
	const notePreset = makePreset("NoteSpecific", "note-id");

	function createMockFile(path: string): TFile {
		const name = path.split("/").pop() ?? path;
		// eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- Test mock
		return { path, name, extension: "md" } as TFile;
	}

	function addMockFile(
		path: string,
		frontmatter?: Record<string, unknown>,
	): TFile {
		const file = createMockFile(path);
		mockFiles.push(file);
		mockCacheData.set(path, { frontmatter } as CachedMetadata);
		return file;
	}

	function setLinks(from: string, to: string[]) {
		resolvedLinks[from] = {};
		for (const t of to) {
			resolvedLinks[from][t] = 1;
		}
	}

	beforeEach(() => {
		mockFiles = [];
		mockCacheData = new Map();
		resolvedLinks = {};

		mockVault = {
			getMarkdownFiles: vi.fn(() => mockFiles),
			getAbstractFileByPath: vi.fn(
				(path: string) =>
					mockFiles.find((f) => f.path === path) ?? null,
			),
			on: vi.fn(() => ({ unload: vi.fn() })),
			off: vi.fn(),
		} as unknown as Vault;

		mockMetadataCache = {
			getFileCache: vi.fn(
				(file: TFile) => mockCacheData.get(file.path) ?? null,
			),
			resolvedLinks,
			on: vi.fn(() => ({ unload: vi.fn() })),
			off: vi.fn(),
		} as unknown as MetadataCache;

		mockApp = {
			vault: mockVault,
			metadataCache: mockMetadataCache,
		} as unknown as App;

		frontmatterIndex = new FrontmatterIndexService(mockApp);
		frontmatterIndex.register({
			field: "flashcard_uid",
			type: "string",
			unique: true,
		});
		frontmatterIndex.register({
			field: "fsrs_preset",
			type: "string",
			unique: false,
		});
		frontmatterIndex.register({
			field: "project",
			type: "string",
			unique: false,
		});

		settings = {
			fsrsPresets: [defaultPreset, medicalPreset, sciencePreset, notePreset],
			defaultPresetId: "default-id",
			folderProjectsEnabled: true,
			excludedFolders: [],
		} as unknown as TrueRecallSettings;

		folderProjectService = new FolderProjectService(
			mockApp,
			frontmatterIndex,
			() => settings,
		);

		projectLinkService = new ProjectLinkService(
			mockApp,
			frontmatterIndex,
		);

		presetService = new PresetService(
			() => settings,
			vi.fn(),
			frontmatterIndex,
			projectLinkService,
			folderProjectService,
		);
	});

	describe("resolvePresetForCard", () => {
		it("returns default preset when card has no sourceUid", () => {
			const card = makeCard(undefined);
			const result = presetService.resolvePresetForCard(card);
			expect(result.name).toBe("Default");
		});

		it("tier 1: uses note's own fsrs_preset", () => {
			addMockFile("Notes/MyNote.md", {
				flashcard_uid: "uid-1",
				fsrs_preset: "NoteSpecific",
			});
			frontmatterIndex.rebuildIndex();

			const card = makeCard("uid-1");
			const result = presetService.resolvePresetForCard(card);
			expect(result.name).toBe("NoteSpecific");
		});

		it("tier 2: uses link-based project preset when note has no preset", () => {
			addMockFile("Projects/Anatomy.md", {
				project: true,
				fsrs_preset: "Medical",
			});
			addMockFile("Notes/Bones.md", {
				flashcard_uid: "uid-bones",
			});
			setLinks("Projects/Anatomy.md", ["Notes/Bones.md"]);
			frontmatterIndex.rebuildIndex();

			const card = makeCard("uid-bones");
			const result = presetService.resolvePresetForCard(card);
			expect(result.name).toBe("Medical");
		});

		it("tier 2 with context: uses specific project's preset", () => {
			addMockFile("Projects/Anatomy.md", {
				project: true,
				fsrs_preset: "Medical",
			});
			addMockFile("Projects/Physics.md", {
				project: true,
				fsrs_preset: "Science",
			});
			addMockFile("Notes/Shared.md", {
				flashcard_uid: "uid-shared",
			});
			setLinks("Projects/Anatomy.md", ["Notes/Shared.md"]);
			setLinks("Projects/Physics.md", ["Notes/Shared.md"]);
			frontmatterIndex.rebuildIndex();

			const card = makeCard("uid-shared");

			// With Anatomy context → Medical
			const result1 = presetService.resolvePresetForCard(card, {
				projectPath: "Projects/Anatomy.md",
			});
			expect(result1.name).toBe("Medical");

			// With Physics context → Science
			const result2 = presetService.resolvePresetForCard(card, {
				projectPath: "Projects/Physics.md",
			});
			expect(result2.name).toBe("Science");
		});

		it("tier 3: uses folder note's preset when no note or project preset", () => {
			// Folder note with preset
			addMockFile("Biology/Biology.md", {
				fsrs_preset: "Science",
			});
			// Note inside folder
			addMockFile("Biology/Cells.md", {
				flashcard_uid: "uid-cells",
			});
			frontmatterIndex.rebuildIndex();

			const card = makeCard("uid-cells");
			const result = presetService.resolvePresetForCard(card);
			expect(result.name).toBe("Science");
		});

		it("tier 3: walks up folder hierarchy", () => {
			addMockFile("Science/Science.md", {
				fsrs_preset: "Science",
			});
			// No folder note at Biology level
			addMockFile("Science/Biology/Cells.md", {
				flashcard_uid: "uid-cells-deep",
			});
			frontmatterIndex.rebuildIndex();

			const card = makeCard("uid-cells-deep");
			const result = presetService.resolvePresetForCard(card);
			expect(result.name).toBe("Science");
		});

		it("tier 1 takes priority over tier 2", () => {
			addMockFile("Projects/Anatomy.md", {
				project: true,
				fsrs_preset: "Medical",
			});
			addMockFile("Notes/Bones.md", {
				flashcard_uid: "uid-bones",
				fsrs_preset: "NoteSpecific",
			});
			setLinks("Projects/Anatomy.md", ["Notes/Bones.md"]);
			frontmatterIndex.rebuildIndex();

			const card = makeCard("uid-bones");
			const result = presetService.resolvePresetForCard(card);
			expect(result.name).toBe("NoteSpecific");
		});

		it("tier 2 takes priority over tier 3", () => {
			addMockFile("Biology/Biology.md", {
				fsrs_preset: "Science",
			});
			addMockFile("Projects/Anatomy.md", {
				project: true,
				fsrs_preset: "Medical",
			});
			addMockFile("Biology/Bones.md", {
				flashcard_uid: "uid-bones",
			});
			setLinks("Projects/Anatomy.md", ["Biology/Bones.md"]);
			frontmatterIndex.rebuildIndex();

			const card = makeCard("uid-bones");
			const result = presetService.resolvePresetForCard(card);
			expect(result.name).toBe("Medical");
		});

		it("falls through invalid preset name to next tier", () => {
			addMockFile("Notes/MyNote.md", {
				flashcard_uid: "uid-1",
				fsrs_preset: "DeletedPreset",
			});
			addMockFile("Projects/Anatomy.md", {
				project: true,
				fsrs_preset: "Medical",
			});
			setLinks("Projects/Anatomy.md", ["Notes/MyNote.md"]);
			frontmatterIndex.rebuildIndex();

			const card = makeCard("uid-1");
			const result = presetService.resolvePresetForCard(card);
			expect(result.name).toBe("Medical");
		});

		it("returns default when all tiers fail", () => {
			addMockFile("Notes/MyNote.md", {
				flashcard_uid: "uid-1",
			});
			frontmatterIndex.rebuildIndex();

			const card = makeCard("uid-1");
			const result = presetService.resolvePresetForCard(card);
			expect(result.name).toBe("Default");
		});
	});

	describe("resolvePresetForCard — deterministic alphabetical ordering", () => {
		it("when two projects both have presets, alphabetically-first project path wins", () => {
			addMockFile("Projects/Zoology.md", {
				project: true,
				fsrs_preset: "Science",
			});
			addMockFile("Projects/Anatomy.md", {
				project: true,
				fsrs_preset: "Medical",
			});
			addMockFile("Notes/SharedNote.md", {
				flashcard_uid: "uid-shared",
			});
			setLinks("Projects/Zoology.md", ["Notes/SharedNote.md"]);
			setLinks("Projects/Anatomy.md", ["Notes/SharedNote.md"]);
			frontmatterIndex.rebuildIndex();

			const card = makeCard("uid-shared");
			const result = presetService.resolvePresetForCard(card);
			// Anatomy < Zoology alphabetically → Medical wins
			expect(result.name).toBe("Medical");
		});

		it("when alphabetically-first project has no preset, falls through to next", () => {
			addMockFile("Projects/Anatomy.md", {
				project: true,
				// no fsrs_preset
			});
			addMockFile("Projects/Zoology.md", {
				project: true,
				fsrs_preset: "Science",
			});
			addMockFile("Notes/SharedNote.md", {
				flashcard_uid: "uid-shared",
			});
			setLinks("Projects/Anatomy.md", ["Notes/SharedNote.md"]);
			setLinks("Projects/Zoology.md", ["Notes/SharedNote.md"]);
			frontmatterIndex.rebuildIndex();

			const card = makeCard("uid-shared");
			const result = presetService.resolvePresetForCard(card);
			expect(result.name).toBe("Science");
		});

		it("explicit context.projectPath bypasses alphabetical ordering", () => {
			addMockFile("Projects/Anatomy.md", {
				project: true,
				fsrs_preset: "Medical",
			});
			addMockFile("Projects/Zoology.md", {
				project: true,
				fsrs_preset: "Science",
			});
			addMockFile("Notes/SharedNote.md", {
				flashcard_uid: "uid-shared",
			});
			setLinks("Projects/Anatomy.md", ["Notes/SharedNote.md"]);
			setLinks("Projects/Zoology.md", ["Notes/SharedNote.md"]);
			frontmatterIndex.rebuildIndex();

			const card = makeCard("uid-shared");
			// Explicitly request Zoology context → Science, not alphabetically-first
			const result = presetService.resolvePresetForCard(card, {
				projectPath: "Projects/Zoology.md",
			});
			expect(result.name).toBe("Science");
		});
	});

	describe("resolvePresetChain", () => {
		it("returns full chain with correct active tier", () => {
			addMockFile("Projects/Anatomy.md", {
				project: true,
				fsrs_preset: "Medical",
			});
			addMockFile("Biology/Biology.md", {
				fsrs_preset: "Science",
			});
			addMockFile("Biology/Bones.md", {
				flashcard_uid: "uid-bones",
			});
			setLinks("Projects/Anatomy.md", ["Biology/Bones.md"]);
			frontmatterIndex.rebuildIndex();

			const { chain, effective } = presetService.resolvePresetChain(
				"Biology/Bones.md",
			);

			expect(chain).toHaveLength(4);
			expect(chain[0]).toMatchObject({
				source: "note",
				presetName: null,
				active: false,
			});
			expect(chain[1]).toMatchObject({
				source: "link-project",
				presetName: "Medical",
				active: true,
			});
			expect(chain[2]).toMatchObject({
				source: "folder",
				presetName: "Science",
				active: false,
			});
			expect(chain[3]).toMatchObject({
				source: "default",
				presetName: "Default",
				active: false,
			});

			expect(effective.preset.name).toBe("Medical");
			expect(effective.source).toBe("link-project");
		});

		it("marks default as active when no overrides exist", () => {
			addMockFile("Notes/Plain.md", {
				flashcard_uid: "uid-plain",
			});
			frontmatterIndex.rebuildIndex();

			const { chain, effective } =
				presetService.resolvePresetChain("Notes/Plain.md");

			expect(chain[3]).toMatchObject({
				source: "default",
				active: true,
			});
			expect(effective.source).toBe("default");
		});
	});
});

describe("PresetService — updatePreset rename propagation", () => {
	let persistSettings: ReturnType<typeof vi.fn>;
	let mockUpdatePresetName: ReturnType<typeof vi.fn>;
	let settings: TrueRecallSettings;
	let presetService: PresetService;

	const presetA = makePreset("OldName", "preset-a");

	beforeEach(() => {
		persistSettings = vi.fn(() => Promise.resolve());
		mockUpdatePresetName = vi.fn();

		settings = {
			fsrsPresets: [
				makePreset("Default", "default-id"),
				{ ...presetA },
			],
			defaultPresetId: "default-id",
		} as unknown as TrueRecallSettings;
	});

	function createServiceWithCardStore(
		getCardStore?: () => { stats: { updateReviewLogPresetName: ReturnType<typeof vi.fn> } } | null,
	): PresetService {
		return new PresetService(
			() => settings,
			persistSettings,
			null as never,
			null,
			null,
			getCardStore as never,
		);
	}

	it("calls updateReviewLogPresetName when name changes", async () => {
		presetService = createServiceWithCardStore(() => ({
			stats: { updateReviewLogPresetName: mockUpdatePresetName },
		}));

		await presetService.updatePreset("preset-a", { name: "NewName" });

		expect(mockUpdatePresetName).toHaveBeenCalledOnce();
		expect(mockUpdatePresetName).toHaveBeenCalledWith("OldName", "NewName");
	});

	it("does NOT call updateReviewLogPresetName when name is unchanged", async () => {
		presetService = createServiceWithCardStore(() => ({
			stats: { updateReviewLogPresetName: mockUpdatePresetName },
		}));

		await presetService.updatePreset("preset-a", {
			requestRetention: 0.85,
		});

		expect(mockUpdatePresetName).not.toHaveBeenCalled();
	});

	it("does NOT call when changes.name equals existing name", async () => {
		presetService = createServiceWithCardStore(() => ({
			stats: { updateReviewLogPresetName: mockUpdatePresetName },
		}));

		await presetService.updatePreset("preset-a", { name: "OldName" });

		expect(mockUpdatePresetName).not.toHaveBeenCalled();
	});

	it("does not throw when getCardStore returns null", async () => {
		presetService = createServiceWithCardStore(() => null);

		await expect(
			presetService.updatePreset("preset-a", { name: "NewName" }),
		).resolves.toBeUndefined();
		expect(persistSettings).toHaveBeenCalledOnce();
	});

	it("does not throw when getCardStore is undefined", async () => {
		presetService = createServiceWithCardStore(undefined);

		await expect(
			presetService.updatePreset("preset-a", { name: "NewName" }),
		).resolves.toBeUndefined();
		expect(persistSettings).toHaveBeenCalledOnce();
	});

	it("still persists settings after rename", async () => {
		presetService = createServiceWithCardStore(() => ({
			stats: { updateReviewLogPresetName: mockUpdatePresetName },
		}));

		await presetService.updatePreset("preset-a", { name: "NewName" });

		expect(persistSettings).toHaveBeenCalledOnce();
		// Verify the preset was actually updated in settings
		const updated = settings.fsrsPresets.find((p) => p.id === "preset-a");
		expect(updated?.name).toBe("NewName");
	});

	it("does nothing for unknown preset id", async () => {
		presetService = createServiceWithCardStore(() => ({
			stats: { updateReviewLogPresetName: mockUpdatePresetName },
		}));

		await presetService.updatePreset("nonexistent", { name: "Nope" });

		expect(mockUpdatePresetName).not.toHaveBeenCalled();
		expect(persistSettings).not.toHaveBeenCalled();
	});
});
