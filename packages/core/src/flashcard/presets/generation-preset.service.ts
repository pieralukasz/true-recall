import { TTS_VOICES } from "../../constants";
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

		const noteType = this.getNoteTypeById(preset.noteTypeId);
		if (!noteType) {
			errors.push(`noteTypeId '${preset.noteTypeId}' not found`);
		}

		const fieldNames = Object.keys(preset.fields);
		if (fieldNames.length === 0) {
			errors.push("fields must contain at least one field");
		}

		if (noteType) {
			for (const name of fieldNames) {
				if (!noteType.fields.includes(name)) {
					errors.push(
						`field '${name}' not in note type '${noteType.slug}' (valid: ${noteType.fields.join(", ")})`,
					);
				}
			}
		}

		let hasAiText = false;
		for (const [name, cfg] of Object.entries(preset.fields)) {
			if (cfg.role === "ai-text") {
				hasAiText = true;
				if (!cfg.instruction || cfg.instruction.trim().length === 0) {
					errors.push(`field '${name}': ai-text instruction must be non-empty`);
				}
			} else if (cfg.role === "image") {
				const ref = preset.fields[cfg.sourceField];
				if (!ref) {
					errors.push(
						`field '${name}': sourceField '${cfg.sourceField}' not in preset fields`,
					);
				} else if (ref.role !== "ai-text") {
					errors.push(
						`field '${name}': sourceField '${cfg.sourceField}' must have role 'ai-text' (got '${ref.role}')`,
					);
				}
			}
		}

		if (fieldNames.length > 0 && !hasAiText) {
			errors.push(
				"preset must have at least one AI-generated field (role: ai-text)",
			);
		}

		if (preset.tts) {
			const ttsField = preset.fields[preset.tts.field];
			if (!ttsField) {
				errors.push(`TTS field '${preset.tts.field}' not in preset fields`);
			} else if (ttsField.role !== "ai-text") {
				errors.push(
					`TTS field '${preset.tts.field}' must have role 'ai-text' (got '${ttsField.role}')`,
				);
			}
			if (
				!TTS_VOICES.includes(preset.tts.voice as (typeof TTS_VOICES)[number])
			) {
				errors.push(
					`TTS voice '${preset.tts.voice}' not supported (valid: ${TTS_VOICES.join(", ")})`,
				);
			}
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

		if (current.isBuiltin) {
			throw new Error("Cannot edit built-in preset");
		}

		const allowedKeys: Array<keyof UpdateGenerationPresetPatch> = [
			"name",
			"noteTypeId",
			"fields",
			"tts",
			"customPrompt",
			"isPinned",
			"isDefault",
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

		if (target.isBuiltin) {
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
