/**
 * Review Handlers
 * Exports handlers for ReviewView
 */

export {
	AnswerHandler,
	type AnswerHandlerCallbacks,
	type AnswerHandlerDeps,
} from "@features/study/ui/review/handlers/AnswerHandler";
export {
	EditHandler,
	type EditHandlerDeps,
} from "@features/study/ui/review/handlers/EditHandler";
export {
	type CardActionsCallbacks,
	CardActionsHandler,
	type CardActionsHandlerDeps,
} from "@features/study/ui/review/handlers/CardActionsHandler";
export {
	type KeyboardActionCallbacks,
	KeyboardHandler,
	type KeyboardShortcuts,
} from "@features/study/ui/review/handlers/KeyboardHandler";
