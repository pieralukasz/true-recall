import { describe, expect, it } from "vitest";

import {
	BUILTIN_BASIC_PRESET,
	BUILTIN_BASIC_PRESET_ID,
} from "../../../src/constants";
import { GenerationPresetService } from "../../../src/flashcard/presets/generation-preset.service";
import type {
	CreateGenerationPresetInput,
	GenerationPreset,
	UpdateGenerationPresetPatch,
} from "../../../src/types/generation-preset.types";
import type { NoteType } from "../../../src/types/note.types";
import type { TrueRecallSettings } from "../../../src/types/settings.types";

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
		const input: CreateGenerationPresetInput = {
			name: "Test",
			noteTypeId: "builtin-basic",
			fields: { Front: { role: "ai-text", instruction: "Q" } },
			tts: null,
			isPinned: false,
			isDefault: false,
		};
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
		const errors = makeService().validate({
			name: "OK",
			noteTypeId: "builtin-basic",
			fields: { Front: { role: "ai-text", instruction: "Q" } },
			tts: null,
			isPinned: false,
			isDefault: false,
		});
		expect(errors).toEqual([]);
	});

	it("rejects empty name", () => {
		const errors = makeService().validate({
			name: "   ",
			noteTypeId: "builtin-basic",
			fields: { Front: { role: "ai-text", instruction: "Q" } },
			tts: null,
			isPinned: false,
			isDefault: false,
		});
		expect(errors).toContain("name must be non-empty");
	});

	it("rejects unknown noteTypeId", () => {
		const errors = makeService().validate({
			name: "X",
			noteTypeId: "does-not-exist",
			fields: { Front: { role: "ai-text", instruction: "Q" } },
			tts: null,
			isPinned: false,
			isDefault: false,
		});
		expect(errors).toContain("noteTypeId 'does-not-exist' not found");
	});

	it("rejects empty fields", () => {
		const errors = makeService().validate({
			name: "X",
			noteTypeId: "builtin-basic",
			fields: {},
			tts: null,
			isPinned: false,
			isDefault: false,
		});
		expect(errors).toContain("fields must contain at least one field");
	});

	it("rejects field not in note type", () => {
		const errors = makeService().validate({
			name: "X",
			noteTypeId: "builtin-basic",
			fields: { Nonsense: { role: "ai-text", instruction: "Q" } },
			tts: null,
			isPinned: false,
			isDefault: false,
		});
		expect(errors.some((e) => e.includes("'Nonsense' not in note type"))).toBe(
			true,
		);
	});

	it("rejects ai-text with empty instruction", () => {
		const errors = makeService().validate({
			name: "X",
			noteTypeId: "builtin-basic",
			fields: { Front: { role: "ai-text", instruction: "  " } },
			tts: null,
			isPinned: false,
			isDefault: false,
		});
		expect(errors.some((e) => e.includes("instruction"))).toBe(true);
	});

	it("rejects image sourceField that doesn't exist in fields", () => {
		const errors = makeService().validate({
			name: "X",
			noteTypeId: "builtin-basic",
			fields: {
				Front: { role: "ai-text", instruction: "Q" },
				Back: { role: "image", sourceField: "Nonexistent" },
			},
			tts: null,
			isPinned: false,
			isDefault: false,
		});
		expect(errors.some((e) => e.includes("sourceField 'Nonexistent'"))).toBe(
			true,
		);
	});

	it("rejects image sourceField that is not ai-text", () => {
		const errors = makeService().validate({
			name: "X",
			noteTypeId: "builtin-basic",
			fields: {
				Front: { role: "manual" },
				Back: { role: "image", sourceField: "Front" },
			},
			tts: null,
			isPinned: false,
			isDefault: false,
		});
		expect(errors.some((e) => e.includes("must have role 'ai-text'"))).toBe(
			true,
		);
	});

	it("rejects tts field not in preset.fields", () => {
		const errors = makeService().validate({
			name: "X",
			noteTypeId: "builtin-basic",
			fields: { Front: { role: "ai-text", instruction: "Q" } },
			tts: { field: "NotThere", voice: "nova", autoplay: false },
			isPinned: false,
			isDefault: false,
		});
		expect(errors.some((e) => e.includes("TTS field 'NotThere'"))).toBe(true);
	});

	it("rejects tts voice not in TTS_VOICES", () => {
		const errors = makeService().validate({
			name: "X",
			noteTypeId: "builtin-basic",
			fields: { Front: { role: "ai-text", instruction: "Q" } },
			tts: { field: "Front", voice: "robot", autoplay: false },
			isPinned: false,
			isDefault: false,
		});
		expect(errors.some((e) => e.includes("voice 'robot'"))).toBe(true);
	});

	it("rejects preset with no ai-text field", () => {
		const errors = makeService().validate({
			name: "X",
			noteTypeId: "builtin-basic",
			fields: { Front: { role: "manual" } },
			tts: null,
			isPinned: false,
			isDefault: false,
		});
		expect(
			errors.some((e) => e.includes("at least one AI-generated field")),
		).toBe(true);
	});

	it("collects all errors, does not bail on first", () => {
		const errors = makeService().validate({
			name: "",
			noteTypeId: "does-not-exist",
			fields: {},
			tts: null,
			isPinned: false,
			isDefault: false,
		});
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
		const input: CreateGenerationPresetInput = {
			name: "Custom",
			noteTypeId: "builtin-basic",
			fields: { Front: { role: "ai-text", instruction: "Q" } },
			tts: null,
			isPinned: false,
			isDefault: false,
		};
		const created = await service.create(input);
		expect(created.id.length).toBeGreaterThan(0);
		expect(created.createdAt).toBeGreaterThan(0);
		expect(created.updatedAt).toBe(created.createdAt);
		expect(created.name).toBe("Custom");
	});

	it("persists the new preset", async () => {
		const { service, getSettings } = makeMutableService();
		await service.create({
			name: "Custom",
			noteTypeId: "builtin-basic",
			fields: { Front: { role: "ai-text", instruction: "Q" } },
			tts: null,
			isPinned: false,
			isDefault: false,
		});
		expect(getSettings().generationPresets).toHaveLength(1);
	});

	it("throws on validation failure", async () => {
		const { service } = makeMutableService();
		await expect(
			service.create({
				name: "",
				noteTypeId: "builtin-basic",
				fields: { Front: { role: "ai-text", instruction: "Q" } },
				tts: null,
				isPinned: false,
				isDefault: false,
			}),
		).rejects.toThrow(/Preset validation failed/);
	});

	it("with isDefault:true unsets default on others", async () => {
		const existing: GenerationPreset = {
			...BUILTIN_BASIC_PRESET,
			isDefault: true,
		};
		const { service, getSettings } = makeMutableService([existing]);
		const created = await service.create({
			name: "New default",
			noteTypeId: "builtin-basic",
			fields: { Front: { role: "ai-text", instruction: "Q" } },
			tts: null,
			isPinned: false,
			isDefault: true,
		});
		const presets = getSettings().generationPresets;
		expect(presets.find((p) => p.id === existing.id)?.isDefault).toBe(false);
		expect(presets.find((p) => p.id === created.id)?.isDefault).toBe(true);
		expect(getSettings().defaultGenerationPresetId).toBe(created.id);
	});
});

describe("GenerationPresetService.update", () => {
	it("patches top-level fields", async () => {
		const { service, getSettings } = makeMutableService([
			{ ...BUILTIN_BASIC_PRESET, id: "p1", name: "Old", isDefault: true },
		]);
		const updated = await service.update("p1", { name: "New" });
		expect(updated.name).toBe("New");
		expect(getSettings().generationPresets[0]?.name).toBe("New");
		expect(updated.updatedAt).toBeGreaterThanOrEqual(
			BUILTIN_BASIC_PRESET.updatedAt,
		);
	});

	it("atomically replaces fields sub-object", async () => {
		const { service } = makeMutableService([
			{ ...BUILTIN_BASIC_PRESET, id: "p1", isDefault: true },
		]);
		const updated = await service.update("p1", {
			fields: {
				Front: { role: "manual" },
				Back: { role: "ai-text", instruction: "A" },
			},
		});
		expect(updated.fields.Front).toEqual({ role: "manual" });
		expect(updated.fields.Back).toEqual({
			role: "ai-text",
			instruction: "A",
		});
	});

	it("returns 404-like error for unknown id", async () => {
		const { service } = makeMutableService();
		await expect(service.update("nope", { name: "X" })).rejects.toThrow(
			/Preset 'nope' not found/,
		);
	});

	it("rejects unknown patch keys", async () => {
		const { service } = makeMutableService([
			{ ...BUILTIN_BASIC_PRESET, id: "p1", isDefault: true },
		]);
		await expect(
			service.update("p1", {
				bogus: true,
			} as unknown as UpdateGenerationPresetPatch),
		).rejects.toThrow(/Unknown field/);
	});

	it("throws on validation failure (e.g. invalid fields)", async () => {
		const { service } = makeMutableService([
			{ ...BUILTIN_BASIC_PRESET, id: "p1", isDefault: true },
		]);
		await expect(service.update("p1", { fields: {} })).rejects.toThrow(
			/Preset validation failed/,
		);
	});

	it("with isDefault:true unsets default on others", async () => {
		const { service, getSettings } = makeMutableService([
			{ ...BUILTIN_BASIC_PRESET, id: "p1", isDefault: true },
			{ ...BUILTIN_BASIC_PRESET, id: "p2", isDefault: false },
		]);
		await service.update("p2", { isDefault: true });
		const presets = getSettings().generationPresets;
		expect(presets.find((p) => p.id === "p1")?.isDefault).toBe(false);
		expect(presets.find((p) => p.id === "p2")?.isDefault).toBe(true);
		expect(getSettings().defaultGenerationPresetId).toBe("p2");
	});
});

describe("GenerationPresetService.delete", () => {
	it("blocks deletion of built-in preset", async () => {
		const { service } = makeMutableService([
			{
				...BUILTIN_BASIC_PRESET,
				id: BUILTIN_BASIC_PRESET_ID,
				isDefault: true,
			},
			{ ...BUILTIN_BASIC_PRESET, id: "p2", isDefault: false },
		]);
		await expect(service.delete(BUILTIN_BASIC_PRESET_ID)).rejects.toThrow(
			/Cannot delete built-in/,
		);
	});

	it("blocks deletion of last remaining preset", async () => {
		const { service } = makeMutableService([
			{ ...BUILTIN_BASIC_PRESET, id: "only", isDefault: true },
		]);
		await expect(service.delete("only")).rejects.toThrow(/last preset/);
	});

	it("removes a non-default preset without changing the default", async () => {
		const { service, getSettings } = makeMutableService([
			{ ...BUILTIN_BASIC_PRESET, id: "p1", isDefault: true },
			{ ...BUILTIN_BASIC_PRESET, id: "p2", isDefault: false },
		]);
		await service.delete("p2");
		const presets = getSettings().generationPresets;
		expect(presets.map((p) => p.id)).toEqual(["p1"]);
		expect(getSettings().defaultGenerationPresetId).toBe("p1");
	});

	it("auto-promotes first remaining preset when default is deleted", async () => {
		const { service, getSettings } = makeMutableService([
			{ ...BUILTIN_BASIC_PRESET, id: "p1", isDefault: true },
			{ ...BUILTIN_BASIC_PRESET, id: "p2", isDefault: false },
		]);
		await service.delete("p1");
		const presets = getSettings().generationPresets;
		expect(presets.map((p) => p.id)).toEqual(["p2"]);
		expect(presets[0]?.isDefault).toBe(true);
		expect(getSettings().defaultGenerationPresetId).toBe("p2");
	});

	it("returns 404-like error for unknown id", async () => {
		const { service } = makeMutableService([
			{ ...BUILTIN_BASIC_PRESET, id: "p1", isDefault: true },
			{ ...BUILTIN_BASIC_PRESET, id: "p2", isDefault: false },
		]);
		await expect(service.delete("nope")).rejects.toThrow(/not found/);
	});
});
