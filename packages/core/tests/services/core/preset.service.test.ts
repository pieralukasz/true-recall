import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IFileSystem } from "../../../src/interfaces/file-system";
import type { IMetadataIndex } from "../../../src/interfaces/metadata-index";
import { FrontmatterIndexService } from "../../../src/services/notes/frontmatter-index.service";
import { HierarchyService } from "../../../src/services/notes/hierarchy.service";
import { PresetService } from "../../../src/services/notes/preset.service";
import type { FSRSFlashcardItem } from "../../../src/types/fsrs";
import type {
	FSRSPreset,
	TrueRecallSettings,
} from "../../../src/types/settings.types";

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

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	const parts = path.split(".");
	let current: unknown = obj;
	for (const part of parts) {
		if (current == null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

function createMockMetadataIndex(
	fileData: Map<string, Record<string, unknown>>,
): IMetadataIndex {
	return {
		getPathByFieldValue: vi.fn((field: string, value: string) => {
			for (const [path, fm] of fileData) {
				if (getNestedValue(fm, field) === value) return path;
			}
			return null;
		}),
		getFieldValue: vi.fn((path: string, field: string) => {
			const fm = fileData.get(path);
			if (!fm) return undefined;
			return getNestedValue(fm, field);
		}),
		getAllPathsWithField: vi.fn((field: string) => {
			const result = new Map<string, unknown>();
			for (const [path, fm] of fileData) {
				const val = getNestedValue(fm, field);
				if (val !== undefined && val !== null) {
					result.set(path, val);
				}
			}
			return result;
		}),
		onFieldChange: vi.fn(() => () => {}),
	};
}

describe("PresetService — 3-tier resolution", () => {
	let fileData: Map<string, Record<string, unknown>>;
	let frontmatterIndex: FrontmatterIndexService;
	let hierarchyService: HierarchyService;
	let presetService: PresetService;
	let settings: TrueRecallSettings;

	const defaultPreset = makePreset("Default", "default-id");
	const medicalPreset = makePreset("Medical", "medical-id");
	const sciencePreset = makePreset("Science", "science-id");
	const notePreset = makePreset("NoteSpecific", "note-id");

	function addMockFile(
		path: string,
		frontmatter?: Record<string, unknown>,
	): void {
		fileData.set(path, frontmatter ?? {});
	}

	beforeEach(() => {
		fileData = new Map();

		const metadataIndex = createMockMetadataIndex(fileData);

		frontmatterIndex = new FrontmatterIndexService(metadataIndex);
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

		const mockFileSystem: IFileSystem = {
			read: vi.fn(async () => ""),
			write: vi.fn(async () => {}),
			delete: vi.fn(async () => {}),
			listMarkdownFiles: vi.fn(async () => [...fileData.keys()]),
			watch: vi.fn(() => () => {}),
		};

		const resolveLinkPath = (name: string): string | null => {
			if (fileData.has(`${name}.md`)) return `${name}.md`;
			for (const path of fileData.keys()) {
				const basename = path.split("/").pop()?.replace(/\.md$/, "");
				if (basename === name) return path;
			}
			return null;
		};

		hierarchyService = new HierarchyService(
			frontmatterIndex,
			mockFileSystem,
			resolveLinkPath,
		);

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

	describe("toFSRSSettings", () => {
		it("reuses an immutable settings snapshot for the same preset", () => {
			const first = presetService.toFSRSSettings(defaultPreset);
			const second = presetService.toFSRSSettings(defaultPreset);

			expect(second).toBe(first);
			expect(Object.isFrozen(first)).toBe(true);
			expect(Object.isFrozen(first.learningSteps)).toBe(true);
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

			const { chain, effective } =
				presetService.resolvePresetChain("Notes/Bones.md");

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
			fsrsPresets: [makePreset("Default", "default-id"), { ...presetA }],
			defaultPresetId: "default-id",
		} as unknown as TrueRecallSettings;
	});

	function createServiceWithCardStore(
		getCardStore?: () => {
			stats: { updateReviewLogPresetName: ReturnType<typeof vi.fn> };
		} | null,
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
