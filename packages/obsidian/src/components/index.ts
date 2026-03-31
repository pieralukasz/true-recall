// ── Obsidian-specific components ─────────────────────────────
export {
	AppNavBar,
	type AppNavBarProps,
} from "@true-recall/obsidian/components/AppNavBar";
export {
	FolderPicker,
	type FolderPickerProps,
} from "@true-recall/obsidian/components/FolderPicker";
export {
	MarkdownContent,
	type MarkdownContentProps,
} from "@true-recall/obsidian/components/MarkdownContent";
export {
	NoteListItem,
	type NoteListItemProps,
} from "@true-recall/obsidian/components/NoteListItem";
export {
	NotePicker,
	type NotePickerProps,
} from "@true-recall/obsidian/components/NotePicker";
export {
	SearchCombobox,
	type SearchComboboxProps,
} from "@true-recall/obsidian/components/SearchCombobox";
export {
	SearchInput,
	type SearchInputProps,
} from "@true-recall/obsidian/components/SearchInput";
export {
	TextInput,
	type TextInputProps,
} from "@true-recall/obsidian/components/TextInput";

// ── Interactive ──────────────────────────────────────────────
export {
	ActionButton,
	type ActionButtonProps,
	type ActionButtonSize,
	type ActionButtonVariant,
} from "./ActionButton";
export {
	CardCountDisplay,
	type CardCountDisplayProps,
} from "./CardCountDisplay";
export {
	CheckboxListItem,
	type CheckboxListItemProps,
} from "./CheckboxListItem";
export {
	Clickable,
	type ClickableProps,
} from "./Clickable";
export {
	EmptyState,
	EmptyStateMessages,
	type EmptyStateProps,
} from "./EmptyState";
export {
	ErrorBoundary,
	type ErrorBoundaryProps,
} from "./ErrorBoundary";

// ── Form ─────────────────────────────────────────────────────
export {
	FormCard,
	type FormCardProps,
} from "./FormCard";
export {
	FormField,
	type FormFieldProps,
} from "./FormField";
export {
	FormSection,
	type FormSectionProps,
} from "./FormSection";
export {
	IconButton,
	type IconButtonProps,
} from "./IconButton";
export {
	InfoBlock,
	type InfoBlockProps,
} from "./InfoBlock";
export {
	LoadingSpinner,
	type LoadingSpinnerProps,
} from "./LoadingSpinner";
export {
	ModalFooter,
	type ModalFooterProps,
	PRIMARY_BTN,
	SECONDARY_BTN,
} from "./ModalFooter";
export {
	OptionCheckbox,
	type OptionCheckboxProps,
} from "./OptionCheckbox";

// ── Layout ───────────────────────────────────────────────────
export { Panel, type PanelProps } from "./Panel";
export {
	PasteDropZone,
	type PasteDropZoneProps,
} from "./PasteDropZone";
export {
	SelectInput,
	type SelectInputOption,
	type SelectInputProps,
	type SelectOption,
	type SelectOptionGroup,
} from "./SelectInput";
export {
	SliderInput,
	type SliderInputProps,
} from "./SliderInput";

// ── Data Display ─────────────────────────────────────────────
export {
	StatBadge,
	type StatBadgeProps,
	StatGrid,
	type StatGridProps,
} from "./StatBadge";
export {
	type CardStateType,
	getCardStateType,
	getStateConfig,
	StateBadge,
	type StateBadgeProps,
} from "./StateBadge";
export {
	TextAreaInput,
	type TextAreaInputProps,
} from "./TextAreaInput";
export {
	ToggleInput,
	type ToggleInputProps,
} from "./ToggleInput";
