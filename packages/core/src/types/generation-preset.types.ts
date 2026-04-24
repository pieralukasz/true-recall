export interface PresetTTSConfig {
	field: string;
	voice: string;
	autoplay: boolean;
}

export interface PresetImageConfig {
	targetField: string;
	sourceField: string;
	style?: string;
}

export interface GenerationPreset {
	id: string;
	name: string;
	/** Free-form instruction. The system appends the format spec from `noteType.fields`. */
	prompt: string;
	noteTypeId: string;
	tts: PresetTTSConfig | null;
	image: PresetImageConfig | null;
	/** Gating flag — preset can only run with Pro key. Was `isPro`. */
	requiresPro: boolean;
	/** Ships with the plugin; user cannot edit or delete. */
	builtin: boolean;
	isDefault: boolean;
	createdAt: number;
	updatedAt: number;
}

export type CreateGenerationPresetInput = Omit<
	GenerationPreset,
	"id" | "createdAt" | "updatedAt" | "builtin"
>;

export type UpdateGenerationPresetPatch = Partial<
	Pick<
		GenerationPreset,
		| "name"
		| "prompt"
		| "noteTypeId"
		| "tts"
		| "image"
		| "requiresPro"
		| "isDefault"
	>
>;
