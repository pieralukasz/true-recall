import { Menu } from "obsidian";
import { useCallback, useMemo } from "preact/hooks";

import { useCardActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/useCardActions";
import { usePanelActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelActions";
import { usePanelStore } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelStore";
import type {
	PanelSort,
	PanelStatusFilter,
} from "@true-recall/obsidian/features/library/ui/panel/utils/panel-list.utils";
import { usePlugin } from "@true-recall/obsidian/preact";

const STATUS_OPTIONS: { value: PanelStatusFilter; label: string }[] = [
	{ value: "all", label: "All Cards" },
	{ value: "due", label: "Due" },
	{ value: "suspended", label: "Suspended" },
	{ value: "buried", label: "Buried" },
];

const SORT_OPTIONS: { value: PanelSort; label: string }[] = [
	{ value: "source", label: "Source Order" },
	{ value: "due", label: "Due First" },
	{ value: "created", label: "Recently Created" },
	{ value: "updated", label: "Recently Edited" },
];

interface UsePanelHeaderArgs {
	totalCount: number;
	dueCount: number;
	statusFilter: PanelStatusFilter;
	sort: PanelSort;
	onStatusFilterChange: (filter: PanelStatusFilter) => void;
	onSortChange: (sort: PanelSort) => void;
	onShowShortcuts: () => void;
	onRefresh: () => void;
}

export function usePanelHeader({
	totalCount,
	dueCount,
	statusFilter,
	sort,
	onStatusFilterChange,
	onSortChange,
	onShowShortcuts,
	onRefresh,
}: UsePanelHeaderArgs) {
	const plugin = usePlugin();
	const {
		currentFile,
		flashcardInfo,
		searchQuery,
		isFollowingReview,
		uncollectedCount,
		hasHighlights,
	} = usePanelStore();
	const panelActions = usePanelActions();
	const cardActions = useCardActions();
	const rModeEnabled = plugin.settings.rMode.enabled;
	const canStudy = totalCount > 0 && currentFile !== null;
	const handleStudy = useCallback(() => {
		if (!currentFile || !canStudy) return;
		const targetCount = rModeEnabled
			? plugin.settings.rMode.defaultSessionSize
			: undefined;
		void plugin.reviewNoteFlashcards(currentFile, targetCount);
	}, [currentFile, canStudy, rModeEnabled, plugin]);

	const hasNoteReview = useMemo(() => {
		const sourceUid = flashcardInfo?.sourceUid;
		return sourceUid ? plugin.flashcardManager.hasNoteReview(sourceUid) : false;
	}, [flashcardInfo?.sourceUid, plugin]);

	const openFilterMenu = useCallback(
		(event: MouseEvent) => {
			const menu = new Menu();
			for (const option of STATUS_OPTIONS) {
				menu.addItem((item) =>
					item
						.setTitle(option.label)
						.setChecked(statusFilter === option.value)
						.onClick(() => onStatusFilterChange(option.value)),
				);
			}
			menu.addSeparator();
			for (const option of SORT_OPTIONS) {
				menu.addItem((item) =>
					item
						.setTitle(option.label)
						.setChecked(sort === option.value)
						.onClick(() => onSortChange(option.value)),
				);
			}
			menu.showAtMouseEvent(event);
		},
		[statusFilter, sort, onStatusFilterChange, onSortChange],
	);

	const openMoreMenu = useCallback(
		(event: MouseEvent) => {
			const menu = new Menu();
			const hasCards = totalCount > 0;

			if (!rModeEnabled && hasCards) {
				menu.addItem((item) =>
					item
						.setTitle(
							dueCount > 0 ? `Review ${dueCount} Due Cards` : "Start Review",
						)
						.setIcon("brain")
						.onClick(() => void panelActions.handleReview()),
				);
			}
			menu.addItem((item) =>
				item
					.setTitle(
						hasNoteReview ? "Disable Note Review" : "Enable Note Review",
					)
					.setIcon(hasNoteReview ? "toggle-right" : "toggle-left")
					.onClick(() => void plugin.toggleNoteReview()),
			);
			menu.addSeparator();
			addCommonActions(menu, panelActions, hasHighlights, onRefresh);

			if (hasCards) {
				addCardCollectionActions(menu, panelActions);
			}
			menu.addSeparator();
			menu.addItem((item) =>
				item
					.setTitle("Keyboard Shortcuts")
					.setIcon("keyboard")
					.onClick(onShowShortcuts),
			);
			if (hasCards) addDestructiveActions(menu, panelActions);
			menu.showAtMouseEvent(event);
		},
		[
			totalCount,
			dueCount,
			rModeEnabled,
			plugin,
			hasNoteReview,
			hasHighlights,
			panelActions,
			onRefresh,
			onShowShortcuts,
		],
	);

	return {
		searchQuery,
		isFollowingReview,
		uncollectedCount,
		rModeEnabled,
		canStudy,
		handleStudy,
		handleSearchChange: panelActions.handleSearchChange,
		handleOpenSourceNote: panelActions.handleOpenSourceNote,
		handleCollect: panelActions.handleCollect,
		handleAddFlashcard: cardActions.handleAddFlashcard,
		openFilterMenu,
		openMoreMenu,
	};
}

type PanelActions = ReturnType<typeof usePanelActions>;

function addCommonActions(
	menu: Menu,
	actions: PanelActions,
	hasHighlights: boolean,
	onRefresh: () => void,
) {
	menu.addItem((item) =>
		item.setTitle("Refresh").setIcon("refresh-cw").onClick(onRefresh),
	);
	menu.addItem((item) =>
		item
			.setTitle("Open Source Note")
			.setIcon("file-text")
			.onClick(actions.handleOpenSourceNote),
	);
	if (hasHighlights) {
		menu.addItem((item) =>
			item
				.setTitle("Generate from Highlights")
				.setIcon("highlighter")
				.onClick(() => void actions.handleGenerateFromHighlights()),
		);
	}
}

function addCardCollectionActions(menu: Menu, actions: PanelActions) {
	menu.addItem((item) =>
		item
			.setTitle("Open Card Browser")
			.setIcon("table-2")
			.onClick(actions.handleBrowseDeck),
	);
	menu.addSeparator();
	menu.addItem((item) =>
		item
			.setTitle("Copy All")
			.setIcon("clipboard-copy")
			.onClick(actions.handleCopyAllToClipboard),
	);
	menu.addItem((item) =>
		item
			.setTitle("Export CSV")
			.setIcon("file-down")
			.onClick(actions.handleExportCsv),
	);
}

function addDestructiveActions(menu: Menu, actions: PanelActions) {
	menu.addSeparator();
	menu.addItem((item) =>
		item
			.setTitle("Forget All Cards")
			.setIcon("rotate-ccw")
			.onClick(actions.handleForgetAll),
	);
	menu.addItem((item) =>
		item
			.setTitle("Delete All Cards")
			.setIcon("trash-2")
			.onClick(actions.handleDeleteAll),
	);
	menu.addItem((item) =>
		item
			.setTitle("Delete Note & Cards")
			.setIcon("file-x-2")
			.onClick(actions.handleDeleteNoteAndCards),
	);
}
