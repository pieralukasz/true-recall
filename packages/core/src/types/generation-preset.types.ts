export interface GenerationPreset {
	id: string;
	name: string;
	/** Free-form instruction. The system appends the format spec from `noteType.fields`. */
	prompt: string;
	noteTypeId: string;
	/** Gating flag — preset can only run with Pro key. Was `isPro`. */
	requiresPro: boolean;
	/** Ships with the plugin; user cannot edit or delete. */
	builtin: boolean;
	isDefault: boolean;
	/** Include the full source note content as context for the AI. */
	includeSourceNote?: boolean;
	/** Include sibling flashcards from the same source note as context. */
	includeRelatedCards?: boolean;
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
		| "requiresPro"
		| "isDefault"
		| "includeSourceNote"
		| "includeRelatedCards"
	>
>;
