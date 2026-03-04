/**
 * Shared modals exports - general-purpose modals used across features
 */

export { BaseModal, type BaseModalOptions } from "@shared/ui/modals/BaseModal";
export {
	BasePromiseModal,
	type CancellableResult,
	createCancelledResult,
} from "@shared/ui/modals/BasePromiseModal";
export {
	CardPreviewModal,
	type CardPreviewModalOptions,
} from "@shared/ui/modals/CardPreviewModal";
export {
	MoveCardModal,
	type MoveCardModalOptions,
	type MoveCardResult,
} from "@shared/ui/modals/MoveCardModal";
export {
	SelectNoteModal,
	type SelectNoteModalOptions,
	type SelectNoteResult,
} from "@shared/ui/modals/SelectNoteModal";
export {
	PresetInspectorModal,
	type PresetInspectorResult,
} from "@shared/ui/modals/PresetInspectorModal";
export {
	PresetOptionsModal,
	type PresetOptionsModalOptions,
} from "@shared/ui/modals/PresetOptionsModal";
export {
	SetPresetModal,
	type SetPresetResult,
} from "@shared/ui/modals/SetPresetModal";
export {
	ConfirmModal,
	type ConfirmModalOptions,
	confirm,
} from "@shared/ui/modals/ConfirmModal";
