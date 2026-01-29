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
