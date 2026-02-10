/**
 * Central export for all Zod schemas
 */

// Flashcard Schemas
export {
    FlashcardItemSchema,
    FlashcardInfoSchema,
} from "./flashcard.schema";

// Validation-specific types (from Zod schemas)
export type { FlashcardInfo } from "./flashcard.schema";

// Settings Schemas
export {
    AIModelSchema,
    SettingsSchema,
    PartialSettingsSchema,
    SettingsWithApiKeySchema,
    type AIModel,
    type Settings,
    type PartialSettings,
} from "./settings.schema";
