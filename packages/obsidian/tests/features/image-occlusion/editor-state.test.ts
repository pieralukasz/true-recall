import { describe, expect, it } from "vitest";

import type { Note } from "@true-recall/core/types/note.types";

import type {
	IODefinition,
	IOEditorMode,
	IORegion,
} from "@true-recall/plugins/image-occlusion/types";
import {
	appendDetectedRegions,
	createIOEditorInitialState,
	patchRegion,
} from "@true-recall/plugins/image-occlusion/utils/editor-state";

function makeRegion(overrides: Partial<IORegion> = {}): IORegion {
	return {
		id: "region-1",
		x: 0.1,
		y: 0.2,
		w: 0.3,
		h: 0.4,
		groupKey: "0",
		shape: "rect",
		...overrides,
	};
}

function makeDefinition(regions: IORegion[] = []): IODefinition {
	return { version: 1, maskMode: "solo", regions };
}

function makeEditMode(fields: Record<string, string>): IOEditorMode {
	const note: Note = {
		id: "note-1",
		noteTypeId: "builtin-image-occlusion",
		fields,
		tags: [],
	};
	return { mode: "edit", noteId: note.id, note };
}

describe("createIOEditorInitialState", () => {
	it("initializes a new editor with the supplied image and drawing tool", () => {
		const state = createIOEditorInitialState({
			mode: "add",
			imagePath: "attachments/diagram.png",
		});

		expect(state.imagePath).toBe("attachments/diagram.png");
		expect(state.definition.regions).toEqual([]);
		expect(state.tool).toBe("rect");
	});

	it("restores an existing definition and starts in select mode", () => {
		const definition = makeDefinition([makeRegion()]);
		const state = createIOEditorInitialState(
			makeEditMode({
				Image: "attachments/existing.png",
				Regions: JSON.stringify(definition),
			}),
		);

		expect(state.imagePath).toBe("attachments/existing.png");
		expect(state.definition).toEqual(definition);
		expect(state.tool).toBe("select");
	});

	it("falls back to an empty definition when stored data is invalid", () => {
		const state = createIOEditorInitialState(
			makeEditMode({ Image: "diagram.png", Regions: "not-json" }),
		);

		expect(state.definition).toEqual(makeDefinition());
		expect(state.tool).toBe("rect");
	});
});

describe("appendDetectedRegions", () => {
	it("appends AI regions with sequential keys after existing groups", () => {
		const definition = makeDefinition([
			makeRegion({ id: "existing", groupKey: "4" }),
		]);
		const detected = [
			makeRegion({ id: "detected-1", groupKey: "ignored" }),
			makeRegion({ id: "detected-2", groupKey: "ignored" }),
		];

		const result = appendDetectedRegions(definition, detected);

		expect(result.regions.map((region) => region.groupKey)).toEqual([
			"4",
			"5",
			"6",
		]);
		expect(definition.regions).toHaveLength(1);
	});
});

describe("patchRegion", () => {
	it("updates only the selected region without mutating the definition", () => {
		const first = makeRegion({ id: "first" });
		const second = makeRegion({ id: "second", x: 0.7 });
		const definition = makeDefinition([first, second]);

		const result = patchRegion(definition, "first", { x: 0.5, label: "Hip" });

		expect(result.regions[0]).toMatchObject({ x: 0.5, label: "Hip" });
		expect(result.regions[1]).toBe(second);
		expect(definition.regions[0]).toBe(first);
	});
});
