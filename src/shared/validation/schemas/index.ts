/**
 * Central export for all Zod schemas
 */

// Validation-specific types (from Zod schemas)
export type { FlashcardInfo } from "@shared/validation/schemas/flashcard.schema";
// Flashcard Schemas
export {
	FlashcardInfoSchema,
	FlashcardItemSchema,
} from "@shared/validation/schemas/flashcard.schema";

// Settings Schemas
export {
	type AIModel,
	AIModelSchema,
	type PartialSettings,
	PartialSettingsSchema,
	type Settings,
	SettingsSchema,
	SettingsWithApiKeySchema,
} from "@shared/validation/schemas/settings.schema";
