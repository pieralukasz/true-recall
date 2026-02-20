import type { NoteHubSortBy, NoteHubStatusFilter } from "../../../../shared/store";

export const STATUS_FILTERS: { label: string; value: NoteHubStatusFilter }[] = [
	{ label: "All", value: "all" },
	{ label: "Due", value: "has-due" },
	{ label: "New", value: "has-new" },
	{ label: "Needs Cards", value: "needs-cards" },
	{ label: "Done", value: "no-due" },
];

export const SORT_OPTIONS: { label: string; value: NoteHubSortBy }[] = [
	{ label: "Name", value: "name" },
	{ label: "Due Count", value: "due" },
	{ label: "Card Count", value: "cards" },
];

export const PILL_BASE =
	"ep:px-2 ep:py-1 ep:rounded-xl ep:text-ui-smaller ep:font-medium ep:border-none ep:cursor-pointer ep:transition-colors";
export const PILL_ACTIVE = `${PILL_BASE} ep:bg-obs-interactive ep:text-obs-on-accent`;
export const PILL_INACTIVE = `${PILL_BASE} ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal`;

export const ICON_BTN_CLS =
	"clickable-icon ep:cursor-pointer ep:w-6 ep:h-6 ep:flex ep:items-center ep:justify-center ep:rounded-md ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5";
