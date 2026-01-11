/**
 * Central export for all Zod schemas
 */

// API Schemas
export {
    OpenRouterErrorSchema,
    OpenRouterChoiceSchema,
    OpenRouterResponseSchema,
    ChatMessageSchema,
    type OpenRouterError,
    type OpenRouterChoice,
    type OpenRouterResponse,
    type ChatMessage,
} from "./api.schema";

// Flashcard Schemas
export {
    FlashcardChangeTypeSchema,
    FlashcardItemSchema,
    FlashcardChangeSchema,
    RawFlashcardChangeSchema,
    NewFlashcardChangeSchema,
    ModifiedFlashcardChangeSchema,
    DeletedFlashcardChangeSchema,
    DiffResponseSchema,
    FlashcardInfoSchema,
} from "./flashcard.schema";

// Validation-specific types (from Zod schemas)
export type { RawFlashcardChange, DiffResponse, FlashcardInfo } from "./flashcard.schema";

// Note: FlashcardChangeType, FlashcardItem, FlashcardChange are exported from src/types/index.ts

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
