import { describe, expect, it } from "vitest";

import type {
	CreateGenerationPresetInput,
	UpdateGenerationPresetPatch,
} from "../../../src/types/generation-preset.types";

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
