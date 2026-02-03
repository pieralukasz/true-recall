/**
 * Modals exports
 */
export { BaseModal, type BaseModalOptions } from "./BaseModal";
export {
    BasePromiseModal,
    type CancellableResult,
    createCancelledResult,
} from "./BasePromiseModal";
export { CardPreviewModal, type CardPreviewModalOptions } from "./CardPreviewModal";
export {
    FlashcardReviewModal,
    type FlashcardReviewResult,
    type FlashcardReviewModalOptions,
} from "./FlashcardReviewModal";
export {
    MoveCardModal,
    type MoveCardResult,
    type MoveCardModalOptions,
} from "./MoveCardModal";
export {
    FlashcardEditorModal,
    KeyboardShortcutsModal,
    type FlashcardEditorResult,
    type FlashcardEditorModalOptions,
} from "./FlashcardEditorModal";
export {
    MediaPickerModal,
    type MediaPickerResult,
} from "./MediaPickerModal";
export {
    ImagePickerModal,
    type ImagePickerResult,
} from "./ImagePickerModal";
export {
    AddToProjectModal,
    type AddToProjectResult,
    type AddToProjectModalOptions,
} from "./AddToProjectModal";
export {
    SelectNoteModal,
    type SelectNoteResult,
    type SelectNoteModalOptions,
} from "./SelectNoteModal";
export {
    RestoreBackupModal,
    type RestoreBackupResult,
    type RestoreBackupModalOptions,
} from "./RestoreBackupModal";
export {
    DeviceSelectionModal,
    type DeviceSelectionResult,
    type DeviceSelectionModalOptions,
} from "./DeviceSelectionModal";
export {
    FirstSyncConflictModal,
    type FirstSyncConflictResult,
    type FirstSyncChoice,
} from "./FirstSyncConflictModal";
export {
    OrphanedCardsActionModal,
    type OrphanedCardsActionResult,
    type OrphanedCardsAction,
    type OrphanedCardsActionModalOptions,
} from "./OrphanedCardsActionModal";
export {
    SimpleFlashcardEditorModal,
    flashcardToMarkdown,
    flashcardsToMarkdown,
    type SimpleFlashcardEditorResult,
    type SimpleFlashcardEditorOptions,
} from "./SimpleFlashcardEditorModal";
export {
    EasyDaysModal,
    type EasyDaysResult,
} from "./EasyDaysModal";
