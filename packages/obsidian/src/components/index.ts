// ── Obsidian-specific components (kept local) ───────────────
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

// ── Re-exported from @true-recall/ui (platform-agnostic) ────
export {
	ActionButton,
	type ActionButtonProps,
	type ActionButtonSize,
	type ActionButtonVariant,
	CardCountDisplay,
	type CardCountDisplayProps,
	type CardStateType,
	CheckboxListItem,
	type CheckboxListItemProps,
	Clickable,
	type ClickableProps,
	EmptyState,
	EmptyStateMessages,
	type EmptyStateProps,
	ErrorBoundary,
	type ErrorBoundaryProps,
	FormCard,
	type FormCardProps,
	FormField,
	type FormFieldProps,
	FormSection,
	type FormSectionProps,
	getCardStateType,
	getStateConfig,
	IconButton,
	type IconButtonProps,
	InfoBlock,
	type InfoBlockProps,
	LoadingSpinner,
	type LoadingSpinnerProps,
	ModalFooter,
	type ModalFooterProps,
	OptionCheckbox,
	type OptionCheckboxProps,
	Panel,
	type PanelProps,
	PasteDropZone,
	type PasteDropZoneProps,
	PRIMARY_BTN,
	SECONDARY_BTN,
	SelectInput,
	type SelectInputOption,
	type SelectInputProps,
	type SelectOption,
	type SelectOptionGroup,
	SliderInput,
	type SliderInputProps,
	StatBadge,
	type StatBadgeProps,
	StateBadge,
	type StateBadgeProps,
	StatGrid,
	type StatGridProps,
	TextAreaInput,
	type TextAreaInputProps,
	ToggleInput,
	type ToggleInputProps,
} from "@true-recall/ui/shared";
