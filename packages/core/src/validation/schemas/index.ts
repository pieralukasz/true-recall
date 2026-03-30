/**
 * Central export for all Zod schemas
 */

// Validation-specific types (from Zod schemas)
export type { FlashcardInfoPayload } from "./flashcard.schema";
// Flashcard Schemas
export {
	FlashcardInfoSchema,
	FlashcardItemSchema,
} from "./flashcard.schema";

// Settings Schemas
export {
	type AIModel,
	AIModelSchema,
	type PartialSettings,
	PartialSettingsSchema,
	type Settings,
	SettingsSchema,
	SettingsWithApiKeySchema,
} from "./settings.schema";
