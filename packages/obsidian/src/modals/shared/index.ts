/**
 * Shared modals exports - general-purpose modals used across features
 */

export {
	BaseModal,
	type BaseModalOptions,
} from "@true-recall/obsidian/modals/shared/BaseModal";
export {
	BasePromiseModal,
	type CancellableResult,
	createCancelledResult,
} from "@true-recall/obsidian/modals/shared/BasePromiseModal";
export {
	CardPreviewModal,
	type CardPreviewModalOptions,
} from "@true-recall/obsidian/modals/shared/CardPreviewModal";
export {
	ConfirmModal,
	type ConfirmModalOptions,
	confirm,
} from "@true-recall/obsidian/modals/shared/ConfirmModal";
export {
	MoveCardModal,
	type MoveCardModalOptions,
	type MoveCardResult,
} from "@true-recall/obsidian/modals/shared/MoveCardModal";
export {
	PresetInspectorModal,
	type PresetInspectorResult,
} from "@true-recall/obsidian/modals/shared/PresetInspectorModal";
export {
	PresetOptionsModal,
	type PresetOptionsModalOptions,
} from "@true-recall/obsidian/modals/shared/PresetOptionsModal";
export {
	SelectNoteModal,
	type SelectNoteModalOptions,
	type SelectNoteResult,
} from "@true-recall/obsidian/modals/shared/SelectNoteModal";
export {
	SetPresetModal,
	type SetPresetResult,
} from "@true-recall/obsidian/modals/shared/SetPresetModal";
