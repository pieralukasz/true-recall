/**
 * Central export for UI components
 */

export {
	LoadingSpinner,
	createLoadingSpinner,
	type LoadingSpinnerProps,
} from "./LoadingSpinner";

export {
	EmptyState,
	createEmptyState,
	EmptyStateMessages,
	type EmptyStateProps,
} from "./EmptyState";

export {
	CardPreview,
	createCardPreview,
	type CardPreviewHandlers,
	type CardPreviewProps,
} from "./CardPreview";

export {
	CardReviewItem,
	createCardReviewItem,
	type CardReviewItemProps,
	type CardData,
} from "./CardReviewItem";

export {
	EditableTextField,
	createEditableTextField,
	TOOLBAR_BUTTONS,
	type EditableTextFieldProps,
	type ToolbarButton,
	type ToolbarButtonAction,
} from "./EditableTextField";

export {
	toggleTextareaWrap,
	insertAtTextareaCursor,
	autoResizeTextarea,
	setupAutoResize,
} from "./edit-toolbar.utils";

// Shared UI Components
export {
	CardCountDisplay,
	createCardCountDisplay,
	type CardCountDisplayProps,
} from "./CardCountDisplay";

export {
	IconButton,
	createIconButton,
	type IconButtonProps,
} from "./IconButton";

export {
	SearchInput,
	createSearchInput,
	type SearchInputProps,
} from "./SearchInput";

export {
	SectionHeader,
	createSectionHeader,
	type SectionHeaderProps,
	type SectionHeaderAction,
} from "./SectionHeader";

export {
	ActionButton,
	createActionButton,
	type ActionButtonProps,
	type ActionButtonVariant,
} from "./ActionButton";

export {
	SelectionFooter,
	createSelectionFooter,
	type SelectionFooterProps,
	type SelectionFooterDisplay,
	type SelectionFooterAction,
} from "./SelectionFooter";

export {
	renderStateBadge,
	createStateBadge,
	getCardStateType,
	getStateConfig,
	type StateBadgeProps,
	type CardStateType,
} from "./StateBadge";

export {
	CollapsibleSection,
	createCollapsibleSection,
	type CollapsibleSectionProps,
} from "./CollapsibleSection";

export { createFormLabel, type FormLabelProps } from "./FormLabel";

export {
	createBadge,
	createChip,
	type BadgeProps,
	type BadgeVariant,
	type BadgeSize,
	type ChipProps,
} from "./Badge";

export {
	showCardActionMenu,
	type CardActionMenuOptions,
	type CardMenuItem,
} from "./CardActionMenu";
