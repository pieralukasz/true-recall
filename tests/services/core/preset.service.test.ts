import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
	App,
	Vault,
	MetadataCache,
	TFile,
	CachedMetadata,
} from "obsidian";
import { FrontmatterIndexService } from "../../../src/features/core/services/frontmatter-index.service";
import { HierarchyService } from "../../../src/features/core/services/hierarchy.service";
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

describe("PresetService — 3-tier resolution", () => {
	let mockApp: App;
	let mockVault: Vault;
	let mockMetadataCache: MetadataCache;
	let mockFiles: TFile[];
	let mockCacheData: Map<string, CachedMetadata>;
	let frontmatterIndex: FrontmatterIndexService;
	let hierarchyService: HierarchyService;
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

	beforeEach(() => {
		mockFiles = [];
		mockCacheData = new Map();

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
			getFirstLinkpathDest: vi.fn((name: string) => {
				return (
					mockFiles.find(
						(f) => f.name === `${name}.md` || f.name === name,
					) ?? null
				);
			}),
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
			field: "parents",
			type: "array",
			unique: false,
		});

		settings = {
			fsrsPresets: [defaultPreset, medicalPreset, sciencePreset, notePreset],
			defaultPresetId: "default-id",
		} as unknown as TrueRecallSettings;

		hierarchyService = new HierarchyService(mockApp, frontmatterIndex);

		presetService = new PresetService(
			() => settings,
			vi.fn(),
			frontmatterIndex,
			hierarchyService,
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

		it("tier 2: uses parent's preset when note has no preset", () => {
			addMockFile("Projects/Anatomy.md", {
				fsrs_preset: "Medical",
			});
			addMockFile("Notes/Bones.md", {
				flashcard_uid: "uid-bones",
				parents: ["[[Anatomy]]"],
			});
			frontmatterIndex.rebuildIndex();
			hierarchyService.invalidateGraph();

			const card = makeCard("uid-bones");
			const result = presetService.resolvePresetForCard(card);
			expect(result.name).toBe("Medical");
		});

		it("tier 2 with context: uses specific parent's preset", () => {
			addMockFile("Projects/Anatomy.md", {
				fsrs_preset: "Medical",
			});
			addMockFile("Projects/Physics.md", {
				fsrs_preset: "Science",
			});
			addMockFile("Notes/Shared.md", {
				flashcard_uid: "uid-shared",
				parents: ["[[Anatomy]]", "[[Physics]]"],
			});
			frontmatterIndex.rebuildIndex();
			hierarchyService.invalidateGraph();

			const card = makeCard("uid-shared");

			const result1 = presetService.resolvePresetForCard(card, {
				projectPath: "Projects/Anatomy.md",
			});
			expect(result1.name).toBe("Medical");

			const result2 = presetService.resolvePresetForCard(card, {
				projectPath: "Projects/Physics.md",
			});
			expect(result2.name).toBe("Science");
		});

		it("tier 2: walks up parent chain (grandparent preset)", () => {
			addMockFile("Projects/Science.md", {
				fsrs_preset: "Science",
			});
			addMockFile("Projects/Biology.md", {
				parents: ["[[Science]]"],
			});
			addMockFile("Notes/Cells.md", {
				flashcard_uid: "uid-cells",
				parents: ["[[Biology]]"],
			});
			frontmatterIndex.rebuildIndex();
			hierarchyService.invalidateGraph();

			const card = makeCard("uid-cells");
			const result = presetService.resolvePresetForCard(card);
			expect(result.name).toBe("Science");
		});

		it("tier 1 takes priority over tier 2", () => {
			addMockFile("Projects/Anatomy.md", {
				fsrs_preset: "Medical",
			});
			addMockFile("Notes/Bones.md", {
				flashcard_uid: "uid-bones",
				fsrs_preset: "NoteSpecific",
				parents: ["[[Anatomy]]"],
			});
			frontmatterIndex.rebuildIndex();
			hierarchyService.invalidateGraph();

			const card = makeCard("uid-bones");
			const result = presetService.resolvePresetForCard(card);
			expect(result.name).toBe("NoteSpecific");
		});

		it("falls through invalid preset name to next tier", () => {
			addMockFile("Notes/MyNote.md", {
				flashcard_uid: "uid-1",
				fsrs_preset: "DeletedPreset",
				parents: ["[[Anatomy]]"],
			});
			addMockFile("Projects/Anatomy.md", {
				fsrs_preset: "Medical",
			});
			frontmatterIndex.rebuildIndex();
			hierarchyService.invalidateGraph();

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

	describe("resolvePresetForCard — parent ordering", () => {
		it("first parent with preset wins (BFS order)", () => {
			addMockFile("Projects/Anatomy.md", {
				fsrs_preset: "Medical",
			});
			addMockFile("Projects/Physics.md", {
				fsrs_preset: "Science",
			});
			addMockFile("Notes/SharedNote.md", {
				flashcard_uid: "uid-shared",
				parents: ["[[Anatomy]]", "[[Physics]]"],
			});
			frontmatterIndex.rebuildIndex();
			hierarchyService.invalidateGraph();

			const card = makeCard("uid-shared");
			const result = presetService.resolvePresetForCard(card);
			expect(result.name).toBe("Medical");
		});

		it("when first parent has no preset, falls through to next parent", () => {
			addMockFile("Projects/Anatomy.md", {
				// no fsrs_preset
			});
			addMockFile("Projects/Physics.md", {
				fsrs_preset: "Science",
			});
			addMockFile("Notes/SharedNote.md", {
				flashcard_uid: "uid-shared",
				parents: ["[[Anatomy]]", "[[Physics]]"],
			});
			frontmatterIndex.rebuildIndex();
			hierarchyService.invalidateGraph();

			const card = makeCard("uid-shared");
			const result = presetService.resolvePresetForCard(card);
			expect(result.name).toBe("Science");
		});

		it("explicit context.projectPath bypasses parent ordering", () => {
			addMockFile("Projects/Anatomy.md", {
				fsrs_preset: "Medical",
			});
			addMockFile("Projects/Physics.md", {
				fsrs_preset: "Science",
			});
			addMockFile("Notes/SharedNote.md", {
				flashcard_uid: "uid-shared",
				parents: ["[[Anatomy]]", "[[Physics]]"],
			});
			frontmatterIndex.rebuildIndex();
			hierarchyService.invalidateGraph();

			const card = makeCard("uid-shared");
			const result = presetService.resolvePresetForCard(card, {
				projectPath: "Projects/Physics.md",
			});
			expect(result.name).toBe("Science");
		});
	});

	describe("resolvePresetChain", () => {
		it("returns full chain with correct active tier", () => {
			addMockFile("Projects/Anatomy.md", {
				fsrs_preset: "Medical",
			});
			addMockFile("Notes/Bones.md", {
				flashcard_uid: "uid-bones",
				parents: ["[[Anatomy]]"],
			});
			frontmatterIndex.rebuildIndex();
			hierarchyService.invalidateGraph();

			const { chain, effective } = presetService.resolvePresetChain(
				"Notes/Bones.md",
			);

			expect(chain).toHaveLength(3);
			expect(chain[0]).toMatchObject({
				source: "note",
				presetName: null,
				active: false,
			});
			expect(chain[1]).toMatchObject({
				source: "parent",
				presetName: "Medical",
				active: true,
			});
			expect(chain[2]).toMatchObject({
				source: "default",
				presetName: "Default",
				active: false,
			});

			expect(effective.preset.name).toBe("Medical");
			expect(effective.source).toBe("parent");
		});

		it("marks default as active when no overrides exist", () => {
			addMockFile("Notes/Plain.md", {
				flashcard_uid: "uid-plain",
			});
			frontmatterIndex.rebuildIndex();

			const { chain, effective } =
				presetService.resolvePresetChain("Notes/Plain.md");

			expect(chain[2]).toMatchObject({
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
			null as never,
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
