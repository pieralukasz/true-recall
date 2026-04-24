import { describe, expect, it } from "vitest";

import {
	BUILTIN_BASIC_PRESET,
	BUILTIN_BASIC_PRESET_ID,
	BUILTIN_BASIC_PRO_PRESET,
	BUILTIN_BASIC_PRO_PRESET_ID,
} from "../../../src/constants";
import { GenerationPresetService } from "../../../src/flashcard/presets/generation-preset.service";
import type {
	CreateGenerationPresetInput,
	GenerationPreset,
	UpdateGenerationPresetPatch,
} from "../../../src/types/generation-preset.types";
import type { NoteType } from "../../../src/types/note.types";
import type { TrueRecallSettings } from "../../../src/types/settings.types";

/** User-owned (non-builtin) counterpart of the built-in Basic preset. */
const BASE_PRESET: GenerationPreset = {
	...BUILTIN_BASIC_PRESET,
	builtin: false,
};

const BASIC_NOTE_TYPE: NoteType = {
	id: "builtin-basic",
	name: "Basic",
	type: 0,
	fields: ["Front", "Back"],
	templates: [],
	css: "",
	isBuiltin: true,
	slug: "basic",
};

function makeInput(
	overrides: Partial<CreateGenerationPresetInput> = {},
): CreateGenerationPresetInput {
	return {
		name: "Test",
		prompt: "Make cards.",
		noteTypeId: "builtin-basic",
		tts: null,
		image: null,
		requiresPro: false,
		isDefault: false,
		...overrides,
	};
}

function makeService(
	noteTypes: Record<string, NoteType> = {
		"builtin-basic": BASIC_NOTE_TYPE,
	},
): GenerationPresetService {
	return new GenerationPresetService(
		() =>
			({
				generationPresets: [],
				defaultGenerationPresetId: "",
			}) as unknown as TrueRecallSettings,
		async () => {},
		(id: string) => noteTypes[id] ?? null,
	);
}

function makeMutableService(
	initial: GenerationPreset[] = [],
	noteTypes: Record<string, NoteType> = {
		"builtin-basic": BASIC_NOTE_TYPE,
	},
): {
	service: GenerationPresetService;
	getSettings: () => TrueRecallSettings;
	persisted: Partial<TrueRecallSettings>[];
} {
	let settings = {
		generationPresets: initial,
		defaultGenerationPresetId:
			initial.find((p) => p.isDefault)?.id ?? initial[0]?.id ?? "",
	} as unknown as TrueRecallSettings;
	const persisted: Partial<TrueRecallSettings>[] = [];
	const service = new GenerationPresetService(
		() => settings,
		async (patch) => {
			settings = { ...settings, ...patch } as TrueRecallSettings;
			persisted.push(patch);
		},
		(id) => noteTypes[id] ?? null,
	);
	return { service, getSettings: () => settings, persisted };
}

describe("generation preset types", () => {
	it("CreateGenerationPresetInput omits server fields", () => {
		const input: CreateGenerationPresetInput = makeInput();
		// @ts-expect-error id must not be assignable
		const withId: CreateGenerationPresetInput = { ...input, id: "x" };
		expect(input.name).toBe("Test");
		expect(withId.name).toBe("Test");
	});

	it("UpdateGenerationPresetPatch is partial", () => {
		const patch: UpdateGenerationPresetPatch = { name: "New name" };
		expect(patch.name).toBe("New name");
	});
});

describe("GenerationPresetService.validate", () => {
	it("accepts a valid preset", () => {
		const errors = makeService().validate(makeInput());
		expect(errors).toEqual([]);
	});

	it("rejects empty name", () => {
		const errors = makeService().validate(makeInput({ name: "   " }));
		expect(errors).toContain("name must be non-empty");
	});

	it("rejects empty prompt", () => {
		const errors = makeService().validate(makeInput({ prompt: "   " }));
		expect(errors).toContain("prompt must be non-empty");
	});

	it("rejects unknown noteTypeId", () => {
		const errors = makeService().validate(
			makeInput({ noteTypeId: "does-not-exist" }),
		);
		expect(errors).toContain("noteTypeId 'does-not-exist' not found");
	});

	it("rejects tts field not in note type", () => {
		const errors = makeService().validate(
			makeInput({
				tts: { field: "NotThere", voice: "nova", autoplay: false },
			}),
		);
		expect(errors.some((e) => e.includes("TTS field 'NotThere'"))).toBe(true);
	});

	it("rejects tts voice not in TTS_VOICES", () => {
		const errors = makeService().validate(
			makeInput({
				tts: { field: "Front", voice: "robot", autoplay: false },
			}),
		);
		expect(errors.some((e) => e.includes("voice 'robot'"))).toBe(true);
	});

	it("rejects image targetField not in note type", () => {
		const errors = makeService().validate(
			makeInput({ image: { targetField: "Ghost", sourceField: "Front" } }),
		);
		expect(errors.some((e) => e.includes("Image targetField 'Ghost'"))).toBe(
			true,
		);
	});

	it("rejects image sourceField not in note type", () => {
		const errors = makeService().validate(
			makeInput({ image: { targetField: "Front", sourceField: "Ghost" } }),
		);
		expect(errors.some((e) => e.includes("Image sourceField 'Ghost'"))).toBe(
			true,
		);
	});

	it("rejects image where target equals source", () => {
		const errors = makeService().validate(
			makeInput({ image: { targetField: "Front", sourceField: "Front" } }),
		);
		expect(errors).toContain("Image targetField must differ from sourceField");
	});

	it("collects all errors, does not bail on first", () => {
		const errors = makeService().validate(
			makeInput({ name: "", prompt: "", noteTypeId: "does-not-exist" }),
		);
		expect(errors.length).toBeGreaterThanOrEqual(3);
	});
});

describe("GenerationPresetService.list/get", () => {
	it("list() returns presets from settings", () => {
		const { service } = makeMutableService([BUILTIN_BASIC_PRESET]);
		expect(service.list()).toEqual([BUILTIN_BASIC_PRESET]);
	});

	it("get() returns null for unknown id", () => {
		const { service } = makeMutableService([BUILTIN_BASIC_PRESET]);
		expect(service.get("nope")).toBeNull();
	});

	it("get() returns preset by id", () => {
		const { service } = makeMutableService([BUILTIN_BASIC_PRESET]);
		expect(service.get(BUILTIN_BASIC_PRESET.id)).toEqual(BUILTIN_BASIC_PRESET);
	});
});

describe("GenerationPresetService.create", () => {
	it("generates id and timestamps", async () => {
		const { service } = makeMutableService();
		const created = await service.create(makeInput({ name: "Custom" }));
		expect(created.id.length).toBeGreaterThan(0);
		expect(created.createdAt).toBeGreaterThan(0);
		expect(created.updatedAt).toBe(created.createdAt);
		expect(created.name).toBe("Custom");
		expect(created.builtin).toBe(false);
	});

	it("persists the new preset", async () => {
		const { service, getSettings } = makeMutableService();
		await service.create(makeInput({ name: "Custom" }));
		expect(getSettings().generationPresets).toHaveLength(1);
	});

	it("throws on validation failure", async () => {
		const { service } = makeMutableService();
		await expect(service.create(makeInput({ name: "" }))).rejects.toThrow(
			/Preset validation failed/,
		);
	});

	it("with isDefault:true unsets default on others", async () => {
		const existing: GenerationPreset = {
			...BASE_PRESET,
			isDefault: true,
		};
		const { service, getSettings } = makeMutableService([existing]);
		const created = await service.create(
			makeInput({ name: "New default", isDefault: true }),
		);
		const presets = getSettings().generationPresets;
		expect(presets.find((p) => p.id === existing.id)?.isDefault).toBe(false);
		expect(presets.find((p) => p.id === created.id)?.isDefault).toBe(true);
		expect(getSettings().defaultGenerationPresetId).toBe(created.id);
	});
});

describe("GenerationPresetService.update", () => {
	it("patches top-level fields", async () => {
		const { service, getSettings } = makeMutableService([
			{ ...BASE_PRESET, id: "p1", name: "Old", isDefault: true },
		]);
		const updated = await service.update("p1", { name: "New" });
		expect(updated.name).toBe("New");
		expect(getSettings().generationPresets[0]?.name).toBe("New");
	});

	it("patches the prompt", async () => {
		const { service } = makeMutableService([
			{ ...BASE_PRESET, id: "p1", isDefault: true },
		]);
		const updated = await service.update("p1", { prompt: "New instruction." });
		expect(updated.prompt).toBe("New instruction.");
	});

	it("returns 404-like error for unknown id", async () => {
		const { service } = makeMutableService();
		await expect(service.update("nope", { name: "X" })).rejects.toThrow(
			/Preset 'nope' not found/,
		);
	});

	it("rejects unknown patch keys", async () => {
		const { service } = makeMutableService([
			{ ...BASE_PRESET, id: "p1", isDefault: true },
		]);
		await expect(
			service.update("p1", {
				bogus: true,
			} as unknown as UpdateGenerationPresetPatch),
		).rejects.toThrow(/Unknown field/);
	});

	it("throws on validation failure (empty prompt)", async () => {
		const { service } = makeMutableService([
			{ ...BASE_PRESET, id: "p1", isDefault: true },
		]);
		await expect(service.update("p1", { prompt: "   " })).rejects.toThrow(
			/Preset validation failed/,
		);
	});

	it("with isDefault:true unsets default on others", async () => {
		const { service, getSettings } = makeMutableService([
			{ ...BASE_PRESET, id: "p1", isDefault: true },
			{ ...BASE_PRESET, id: "p2", isDefault: false },
		]);
		await service.update("p2", { isDefault: true });
		const presets = getSettings().generationPresets;
		expect(presets.find((p) => p.id === "p1")?.isDefault).toBe(false);
		expect(presets.find((p) => p.id === "p2")?.isDefault).toBe(true);
		expect(getSettings().defaultGenerationPresetId).toBe("p2");
	});

	it("blocks update of built-in Pro preset", async () => {
		const { service } = makeMutableService([
			{
				...BUILTIN_BASIC_PRO_PRESET,
				id: BUILTIN_BASIC_PRO_PRESET_ID,
				isDefault: true,
			},
			{ ...BASE_PRESET, id: "p2", isDefault: false },
		]);
		await expect(
			service.update(BUILTIN_BASIC_PRO_PRESET_ID, { name: "Hacked" }),
		).rejects.toThrow(/Cannot edit built-in/);
	});

	it("blocks update of the free built-in Basic preset", async () => {
		const { service } = makeMutableService([
			{ ...BUILTIN_BASIC_PRESET, isDefault: true },
		]);
		await expect(
			service.update(BUILTIN_BASIC_PRESET_ID, { name: "Renamed" }),
		).rejects.toThrow(/Cannot edit built-in/);
	});
});

describe("GenerationPresetService.delete", () => {
	it("blocks deletion of built-in Pro preset", async () => {
		const { service } = makeMutableService([
			{
				...BUILTIN_BASIC_PRO_PRESET,
				id: BUILTIN_BASIC_PRO_PRESET_ID,
				isDefault: true,
			},
			{ ...BASE_PRESET, id: "p2", isDefault: false },
		]);
		await expect(service.delete(BUILTIN_BASIC_PRO_PRESET_ID)).rejects.toThrow(
			/Cannot delete built-in/,
		);
	});

	it("blocks deletion of the free built-in Basic preset", async () => {
		const { service } = makeMutableService([
			{ ...BUILTIN_BASIC_PRESET, isDefault: true },
			{ ...BASE_PRESET, id: "p2", isDefault: false },
		]);
		await expect(service.delete(BUILTIN_BASIC_PRESET_ID)).rejects.toThrow(
			/Cannot delete built-in/,
		);
	});

	it("blocks deletion of last remaining preset", async () => {
		const { service } = makeMutableService([
			{ ...BASE_PRESET, id: "only", isDefault: true },
		]);
		await expect(service.delete("only")).rejects.toThrow(/last preset/);
	});

	it("removes a non-default preset without changing the default", async () => {
		const { service, getSettings } = makeMutableService([
			{ ...BASE_PRESET, id: "p1", isDefault: true },
			{ ...BASE_PRESET, id: "p2", isDefault: false },
		]);
		await service.delete("p2");
		const presets = getSettings().generationPresets;
		expect(presets.map((p) => p.id)).toEqual(["p1"]);
		expect(getSettings().defaultGenerationPresetId).toBe("p1");
	});

	it("auto-promotes first remaining preset when default is deleted", async () => {
		const { service, getSettings } = makeMutableService([
			{ ...BASE_PRESET, id: "p1", isDefault: true },
			{ ...BASE_PRESET, id: "p2", isDefault: false },
		]);
		await service.delete("p1");
		const presets = getSettings().generationPresets;
		expect(presets.map((p) => p.id)).toEqual(["p2"]);
		expect(presets[0]?.isDefault).toBe(true);
		expect(getSettings().defaultGenerationPresetId).toBe("p2");
	});

	it("returns 404-like error for unknown id", async () => {
		const { service } = makeMutableService([
			{ ...BASE_PRESET, id: "p1", isDefault: true },
			{ ...BASE_PRESET, id: "p2", isDefault: false },
		]);
		await expect(service.delete("nope")).rejects.toThrow(/not found/);
	});
});
