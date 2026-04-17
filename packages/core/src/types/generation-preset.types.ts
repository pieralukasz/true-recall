export type FieldConfig =
	| { role: "ai-text"; instruction: string }
	| { role: "image"; sourceField: string; style?: string }
	| { role: "manual" };

export interface PresetTTSConfig {
	field: string;
	voice: string;
	autoplay: boolean;
}

export interface GenerationPreset {
	id: string;
	name: string;
	noteTypeId: string;
	fields: Record<string, FieldConfig>;
	tts: PresetTTSConfig | null;
	customPrompt?: string;
	isPinned: boolean;
	isDefault: boolean;
	isPro?: boolean;
	createdAt: number;
	updatedAt: number;
}

export type CreateGenerationPresetInput = Omit<
	GenerationPreset,
	"id" | "createdAt" | "updatedAt"
>;

export type UpdateGenerationPresetPatch = Partial<CreateGenerationPresetInput>;
