import type {
	CreateGenerationPresetInput,
	GenerationPreset,
	UpdateGenerationPresetPatch,
} from "../../types/generation-preset.types";
import type { NoteType } from "../../types/note.types";
import type { TrueRecallSettings } from "../../types/settings.types";

type PresetLike = CreateGenerationPresetInput | GenerationPreset;

export class GenerationPresetService {
	constructor(
		private readonly getSettings: () => TrueRecallSettings,
		private readonly persistSettings: (
			patch: Partial<TrueRecallSettings>,
		) => Promise<void>,
		private readonly getNoteTypeById: (id: string) => NoteType | null,
	) {}

	validate(preset: PresetLike): string[] {
		const errors: string[] = [];

		if (!preset.name || preset.name.trim().length === 0) {
			errors.push("name must be non-empty");
		}

		if (!preset.prompt || preset.prompt.trim().length === 0) {
			errors.push("prompt must be non-empty");
		}

		const noteType = this.getNoteTypeById(preset.noteTypeId);
		if (!noteType) {
			errors.push(`noteTypeId '${preset.noteTypeId}' not found`);
		}

		return errors;
	}

	list(): GenerationPreset[] {
		return this.getSettings().generationPresets;
	}

	get(id: string): GenerationPreset | null {
		return this.list().find((p) => p.id === id) ?? null;
	}

	async create(input: CreateGenerationPresetInput): Promise<GenerationPreset> {
		const errors = this.validate(input);
		if (errors.length > 0) {
			throw new Error(`Preset validation failed: ${errors.join("; ")}`);
		}

		const now = Date.now();
		const preset: GenerationPreset = {
			...input,
			id: crypto.randomUUID(),
			builtin: false,
			createdAt: now,
			updatedAt: now,
		};

		const current = this.getSettings().generationPresets;
		const next = input.isDefault
			? current.map((p) => ({ ...p, isDefault: false }))
			: current.slice();
		next.push(preset);

		const defaultGenerationPresetId = input.isDefault
			? preset.id
			: this.getSettings().defaultGenerationPresetId;

		await this.persistSettings({
			generationPresets: next,
			defaultGenerationPresetId,
		});

		return preset;
	}

	async update(
		id: string,
		patch: UpdateGenerationPresetPatch,
	): Promise<GenerationPreset> {
		const current = this.get(id);
		if (!current) {
			throw new Error(`Preset '${id}' not found`);
		}

		if (current.builtin) {
			throw new Error("Cannot edit built-in preset");
		}

		const allowedKeys: Array<keyof UpdateGenerationPresetPatch> = [
			"name",
			"prompt",
			"noteTypeId",
			"requiresPro",
			"isDefault",
			"includeSourceNote",
			"includeRelatedCards",
		];
		for (const key of Object.keys(patch)) {
			if (!allowedKeys.includes(key as keyof UpdateGenerationPresetPatch)) {
				throw new Error(`Unknown field in patch: ${key}`);
			}
		}

		const merged: GenerationPreset = {
			...current,
			...patch,
			id: current.id,
			createdAt: current.createdAt,
			updatedAt: Date.now(),
		};

		const errors = this.validate(merged);
		if (errors.length > 0) {
			throw new Error(`Preset validation failed: ${errors.join("; ")}`);
		}

		const presets = this.getSettings().generationPresets;
		const next = presets.map((p) => {
			if (p.id === id) return merged;
			if (patch.isDefault === true) return { ...p, isDefault: false };
			return p;
		});

		const defaultGenerationPresetId =
			patch.isDefault === true
				? id
				: this.getSettings().defaultGenerationPresetId;

		await this.persistSettings({
			generationPresets: next,
			defaultGenerationPresetId,
		});

		return merged;
	}

	async delete(id: string): Promise<void> {
		const current = this.getSettings().generationPresets;
		const target = current.find((p) => p.id === id);
		if (!target) {
			throw new Error(`Preset '${id}' not found`);
		}

		if (target.builtin) {
			throw new Error("Cannot delete built-in preset");
		}

		if (current.length === 1) {
			throw new Error("Cannot delete the last preset");
		}

		const remaining = current.filter((p) => p.id !== id);
		let defaultGenerationPresetId =
			this.getSettings().defaultGenerationPresetId;

		if (target.isDefault) {
			const promoted = remaining[0];
			if (!promoted) {
				throw new Error("Cannot delete the last preset");
			}
			promoted.isDefault = true;
			defaultGenerationPresetId = promoted.id;
		}

		await this.persistSettings({
			generationPresets: remaining,
			defaultGenerationPresetId,
		});
	}
}
