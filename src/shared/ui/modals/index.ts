/**
 * Shared modals exports - general-purpose modals used across features
 */

export {
	AddToProjectModal,
	type AddToProjectModalOptions,
	type AddToProjectResult,
} from "./AddToProjectModal";
export { BaseModal, type BaseModalOptions } from "./BaseModal";
export {
	BasePromiseModal,
	type CancellableResult,
	createCancelledResult,
} from "./BasePromiseModal";
export {
	CardPreviewModal,
	type CardPreviewModalOptions,
} from "./CardPreviewModal";
export {
	FlashcardEditorModal,
	type FlashcardEditorModalOptions,
	type FlashcardEditorResult,
	KeyboardShortcutsModal,
} from "./FlashcardEditorModal";
export {
	ImagePickerModal,
	type ImagePickerResult,
} from "./ImagePickerModal";
export {
	MediaPickerModal,
	type MediaPickerResult,
} from "./MediaPickerModal";
export {
	MoveCardModal,
	type MoveCardModalOptions,
	type MoveCardResult,
} from "./MoveCardModal";
export {
	SelectNoteModal,
	type SelectNoteModalOptions,
	type SelectNoteResult,
} from "./SelectNoteModal";
export {
	SetPresetModal,
	type SetPresetResult,
} from "./SetPresetModal";
export {
	cardsToMarkdown,
	cardToMarkdown,
	SimpleFlashcardEditorModal,
	type SimpleFlashcardEditorOptions,
	type SimpleFlashcardEditorResult,
} from "./SimpleFlashcardEditorModal";
