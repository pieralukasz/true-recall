export const TABLE_STYLES = {
    // Containers
    SCROLL_CONTAINER: "ep:relative ep:h-full ep:overflow-auto",
    TABLE_WRAPPER: "ep:relative ep:w-full",
    TABLE: "ep:absolute ep:inset-0 ep:w-full [border-collapse:collapse] [table-layout:fixed]",
    THEAD: "ep:sticky ep:top-0 ep:z-10 ep:bg-obs-secondary",
    TBODY: "ep:relative ep:block",
    HEADER_ROW: "ep:flex",

    // Header cells
    HEADER_CELL: "ep:py-2.5 ep:px-3 ep:text-left ep:font-semibold ep:text-obs-muted ep:text-ui-smaller ep:uppercase ep:tracking-wider ep:border-b ep:border-obs-border ep:whitespace-nowrap ep:select-none ep:hover:bg-obs-modifier-hover",
    SORT_BTN: "ep:flex ep:items-center ep:gap-1 ep:bg-transparent ep:border-0 ep:p-0 ep:cursor-pointer ep:text-inherit ep:font-inherit",

    // Data rows
    ROW_BASE: "ep:absolute ep:flex ep:items-center ep:w-full ep:border-b ep:border-obs-border ep:transition-colors ep:duration-100 ep:cursor-pointer ep:hover:bg-obs-modifier-hover",
    ROW_SELECTED: "ep:bg-[rgba(var(--obs-interactive-rgb),0.1)] ep:hover:!bg-[rgba(var(--obs-interactive-rgb),0.15)]",
    ROW_SUSPENDED: "ep:opacity-60",
    ROW_BURIED: "ep:opacity-60 ep:italic",
    ROW_FOCUSED: "ep:ring-2 ep:ring-obs-interactive ep:ring-inset",

    // Cells
    CELL: "ep:py-2.5 ep:px-3 ep:text-obs-normal ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap",
    CELL_CONTENT: "ep:block ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap",

    // Due date colors
    DUE_OVERDUE: "ep:text-obs-error",
    DUE_TODAY: "ep:text-obs-interactive ep:font-medium",

    // Lapses warning
    LAPSES_HIGH: "ep:text-obs-error",

    // Source link
    SOURCE_LINK: "ep:text-obs-accent ep:no-underline ep:cursor-pointer ep:hover:underline",
    SOURCE_EMPTY: "ep:text-obs-muted",

    // Empty/Loading states
    EMPTY_CONTAINER: "ep:flex ep:flex-col ep:items-center ep:justify-center ep:py-15 ep:px-5 ep:text-obs-muted ep:text-center ep:h-full",
    EMPTY_ICON: "ep:text-5xl ep:mb-4 ep:opacity-50",
    EMPTY_TITLE: "ep:text-ui-small ep:mb-2",
    EMPTY_SUBTITLE: "ep:text-ui-smaller ep:opacity-70",
} as const;

export const TOOLBAR_STYLES = {
    SEARCH_WRAPPER: "ep:relative ep:flex ep:items-center",
    SEARCH_ICON: "ep:absolute ep:left-2.5 ep:text-obs-muted ep:pointer-events-none ep:flex ep:items-center",
    SEARCH_INPUT: "ep:w-full ep:py-2 ep:pr-8 ep:pl-9 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-[13px] focus:ep:border-obs-interactive focus:ep:outline-none",
    SEARCH_CLEAR: "ep:absolute ep:right-2 ep:flex ep:items-center ep:justify-center ep:w-5 ep:h-5 ep:rounded ep:text-obs-muted ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal",

    STATS_TEXT: "ep:text-obs-muted",
    STATS_SELECTED: "ep:font-semibold ep:text-obs-interactive",

    ACTION_BTN: "ep:flex ep:items-center ep:justify-center ep:gap-1.5 ep:py-1.5 ep:px-2.5 ep:border-none ep:rounded-md ep:bg-transparent ep:text-obs-muted ep:text-[13px] ep:cursor-pointer ep:transition-all ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal",
    ACTION_BTN_FILLED: "ep:flex ep:items-center ep:justify-center ep:gap-1.5 ep:py-1.5 ep:px-3 ep:border-none ep:rounded-md ep:bg-obs-modifier-hover ep:text-obs-muted ep:text-[13px] ep:cursor-pointer ep:transition-all ep:hover:bg-obs-modifier-border ep:hover:text-obs-normal",

    DROPDOWN: "ep:hidden ep:absolute ep:top-full ep:right-0 ep:mt-1 ep:min-w-[160px] ep:p-1 ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-lg ep:shadow-s ep:z-[100]",
    DROPDOWN_VISIBLE: "ep:block",
    DROPDOWN_ITEM: "ep:flex ep:items-center ep:gap-2 ep:w-full ep:py-2 ep:px-3 ep:rounded ep:text-[13px] ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:text-obs-normal",
    DROPDOWN_ITEM_DANGER: "ep:text-obs-error ep:hover:bg-red-500/10",
    DROPDOWN_DIVIDER: "ep:h-px ep:my-1 ep:bg-obs-border",
} as const;

export const SIDEBAR_STYLES = {
    HEADER: "ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border",
    HEADER_TITLE: "ep:text-obs-muted ep:text-[11px] ep:font-semibold ep:uppercase ep:tracking-[0.5px]",
    HEADER_CLEAR_BTN: "ep:flex ep:items-center ep:justify-center ep:w-5 ep:h-5 ep:p-0 ep:border-none ep:rounded ep:bg-transparent ep:text-obs-muted ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal",

    SECTION: "ep:p-3 ep:border-b ep:border-obs-border last:ep:border-b-0",
    SECTION_TITLE: "ep:mb-2 ep:text-obs-muted ep:text-[11px] ep:font-semibold ep:uppercase ep:tracking-[0.5px]",
    SECTION_CONTENT: "ep:flex ep:flex-col ep:gap-0.5",

    FILTER_ITEM_BASE: "ep:flex ep:items-center ep:py-1.5 ep:px-2.5 ep:border-none ep:rounded-md ep:text-[13px] ep:text-left ep:cursor-pointer ep:transition-all",
    FILTER_ITEM_DEFAULT: "ep:bg-transparent ep:text-obs-normal ep:hover:bg-obs-modifier-hover",
    FILTER_ITEM_SELECTED: "ep:bg-obs-interactive ep:text-on-accent",

    FILTER_ICON_DEFAULT: "ep:shrink-0 ep:mr-2 ep:opacity-70",
    FILTER_ICON_SELECTED: "ep:shrink-0 ep:mr-2 ep:opacity-100",

    FILTER_LABEL: "ep:flex-1 ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap",

    FILTER_COUNT_DEFAULT: "ep:shrink-0 ep:ml-2 ep:text-[11px] ep:font-medium ep:py-0.5 ep:px-1.5 ep:bg-obs-modifier-hover ep:rounded-full ep:text-obs-muted",
    FILTER_COUNT_SELECTED: "ep:shrink-0 ep:ml-2 ep:text-[11px] ep:font-medium ep:py-0.5 ep:px-1.5 ep:bg-white/20 ep:rounded-full ep:text-on-accent",
} as const;

export const PREVIEW_STYLES = {
    EMPTY: "ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-full ep:py-10 ep:px-5 ep:text-obs-muted ep:text-center",
    EMPTY_ICON: "ep:text-[32px] ep:mb-3 ep:opacity-50",
    EMPTY_TEXT: "ep:text-[13px]",

    HEADER: "ep:flex ep:items-center ep:justify-between ep:py-3 ep:px-4 ep:border-b ep:border-obs-border ep:bg-obs-secondary ep:sticky ep:top-0 ep:z-10",
    HEADER_TITLE: "ep:text-[13px] ep:font-semibold ep:text-obs-normal ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap",
    HEADER_ACTIONS: "ep:flex ep:items-center ep:gap-1 ep:shrink-0",

    ACTION_BTN: "ep:flex ep:items-center ep:justify-center ep:w-7 ep:h-7 ep:p-0 ep:border-none ep:rounded-md ep:bg-transparent ep:text-obs-muted ep:cursor-pointer ep:transition-all ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal",
    ACTION_BTN_ACTIVE: "ep:bg-obs-interactive ep:text-on-accent ep:hover:bg-obs-interactive ep:hover:text-on-accent",
    ACTION_BTN_DANGER: "ep:text-obs-muted ep:hover:bg-red-500/10 ep:hover:text-obs-error",

    CONTENT: "ep:flex-1 ep:overflow-y-auto ep:p-4",
    SECTION_LABEL: "ep:block ep:mb-2 ep:text-obs-muted ep:text-[11px] ep:font-semibold ep:uppercase ep:tracking-[0.5px]",
    SECTION_CONTENT: "ep:p-3 ep:bg-obs-secondary ep:rounded-lg ep:text-obs-normal ep:text-ui-small ep:leading-relaxed markdown-rendered",

    DIVIDER: "ep:h-px ep:my-4 ep:bg-obs-border",

    INFO: "ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border ep:mx-4 ep:mb-4",
    INFO_ROW: "ep:flex ep:items-start ep:py-1.5 ep:border-b ep:border-obs-border last:ep:border-b-0",
    INFO_LABEL: "ep:shrink-0 ep:min-w-[80px] ep:mr-3 ep:text-obs-muted ep:text-ui-smaller",
    INFO_VALUE: "ep:text-obs-normal ep:text-[13px]",

    STATS_ROW: "ep:flex ep:flex-wrap ep:gap-2 ep:py-2 ep:border-b ep:border-obs-border",
    STAT_BOX: "ep:flex ep:flex-col ep:py-2 ep:px-3 ep:bg-obs-secondary ep:rounded-md ep:min-w-[70px]",
    STAT_LABEL: "ep:text-[10px] ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-[0.3px] ep:mb-0.5",
    STAT_VALUE: "ep:text-ui-small ep:font-semibold ep:text-obs-normal",

    PROJECT_TAG: "ep:py-0.5 ep:px-2 ep:bg-obs-modifier-hover ep:rounded ep:text-ui-smaller ep:text-obs-muted",

    // State badges
    BADGE_BASE: "ep:inline-flex ep:items-center ep:py-0.5 ep:px-2 ep:rounded-xl ep:text-[11px] ep:font-semibold ep:uppercase ep:tracking-[0.3px]",
    BADGE_NEW: "ep:bg-blue-500/15 ep:text-blue-500",
    BADGE_LEARNING: "ep:bg-orange-500/15 ep:text-orange-500",
    BADGE_REVIEW: "ep:bg-green-500/15 ep:text-green-500",
    BADGE_RELEARNING: "ep:bg-yellow-500/15 ep:text-yellow-500",
    BADGE_SUSPENDED: "ep:bg-red-500/15 ep:text-obs-error",
    BADGE_BURIED: "ep:bg-obs-modifier-hover ep:text-obs-muted",
    BADGE_UNKNOWN: "ep:bg-obs-modifier-hover ep:text-obs-muted",
} as const;

export const RESIZE_STYLES = {
    COLUMN_HANDLE: "ep:absolute ep:right-0 ep:top-0 ep:bottom-0 ep:w-1 ep:cursor-col-resize ep:bg-transparent ep:hover:bg-obs-interactive/50 ep:z-10",
    COLUMN_HANDLE_ACTIVE: "ep:bg-obs-interactive",
    PANEL_HANDLE: "ep:w-1.5 ep:bg-transparent ep:cursor-col-resize ep:shrink-0 ep:transition-colors ep:hover:bg-obs-interactive/30",
    PANEL_HANDLE_ACTIVE: "ep:bg-obs-interactive/60",
} as const;
