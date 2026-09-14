import {
	VIEW_TYPE_ASSISTANT_EDITOR,
	VIEW_TYPE_ASSISTANT_INBOX,
	VIEW_TYPE_ASSISTANT_WORKSPACE,
	VIEW_TYPE_CARD_BROWSER,
	VIEW_TYPE_CARD_TYPES_EDITOR,
	VIEW_TYPE_DASHBOARD,
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_NOTE_TYPE_MANAGER,
	VIEW_TYPE_QUICK_NOTE_EDITOR,
	VIEW_TYPE_REVIEW,
	VIEW_TYPE_SIMULATOR,
	VIEW_TYPE_STATS,
} from "@true-recall/core/constants";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { registerCommands } from "@true-recall/obsidian/plugin/PluginCommands";
import { registerEventHandlers } from "@true-recall/obsidian/plugin/PluginEventHandlers";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { TrueRecallSettingTab } from "@true-recall/obsidian/settings";
import { isViewAllowedOnCurrentPlatform } from "@true-recall/obsidian/utils/platform";
import { AssistantInboxView } from "@true-recall/obsidian/views/assistant/AssistantInboxView";
import { AssistantWorkspaceView } from "@true-recall/obsidian/views/assistant/AssistantWorkspaceView";
import { CardBrowserView } from "@true-recall/obsidian/views/browser/CardBrowserView";
import { DashboardView } from "@true-recall/obsidian/views/dashboard/DashboardView";
import { AssistantEditorView } from "@true-recall/obsidian/views/modal-window/AssistantEditorView";
import { CardTypesEditorView } from "@true-recall/obsidian/views/modal-window/CardTypesEditorView";
import { NoteTypeManagerView } from "@true-recall/obsidian/views/modal-window/NoteTypeManagerView";
import { QuickNoteEditorView } from "@true-recall/obsidian/views/modal-window/QuickNoteEditorView";
import { FlashcardPanelView } from "@true-recall/obsidian/views/panel/FlashcardPanelView";
import { ReviewView } from "@true-recall/obsidian/views/review/ReviewView";
import { SimulatorView } from "@true-recall/obsidian/views/simulator/SimulatorView";
import { StatsView } from "@true-recall/obsidian/views/stats/StatsView";
export async function registerFeatures(
	plugin: TrueRecallPlugin,
): Promise<void> {
	const registerIfAllowed = (
		viewType: string,
		factory: (
			leaf: import("obsidian").WorkspaceLeaf,
		) => import("obsidian").View,
	) => {
		if (isViewAllowedOnCurrentPlatform(viewType)) {
			plugin.registerView(viewType, factory);
		}
	};

	registerIfAllowed(
		VIEW_TYPE_FLASHCARD_PANEL,
		(leaf) => new FlashcardPanelView(leaf, plugin),
	);

	registerIfAllowed(VIEW_TYPE_REVIEW, (leaf) => new ReviewView(leaf, plugin));

	registerIfAllowed(
		VIEW_TYPE_SIMULATOR,
		(leaf) => new SimulatorView(leaf, plugin),
	);

	registerIfAllowed(
		VIEW_TYPE_DASHBOARD,
		(leaf) => new DashboardView(leaf, plugin),
	);

	plugin.addRibbonIcon(
		"layout-dashboard",
		"True Recall: Open dashboard",
		() => {
			plugin.openDashboard().catch((error) => {
				notify().error("Failed to open dashboard", error);
			});
		},
	);

	registerIfAllowed(
		VIEW_TYPE_CARD_BROWSER,
		(leaf) => new CardBrowserView(leaf, plugin),
	);

	registerIfAllowed(VIEW_TYPE_STATS, (leaf) => new StatsView(leaf, plugin));

	registerIfAllowed(
		VIEW_TYPE_QUICK_NOTE_EDITOR,
		(leaf) => new QuickNoteEditorView(leaf, plugin),
	);

	registerIfAllowed(
		VIEW_TYPE_ASSISTANT_EDITOR,
		(leaf) => new AssistantEditorView(leaf, plugin),
	);

	registerIfAllowed(
		VIEW_TYPE_NOTE_TYPE_MANAGER,
		(leaf) => new NoteTypeManagerView(leaf, plugin),
	);

	registerIfAllowed(
		VIEW_TYPE_CARD_TYPES_EDITOR,
		(leaf) => new CardTypesEditorView(leaf, plugin),
	);

	registerIfAllowed(
		VIEW_TYPE_ASSISTANT_INBOX,
		(leaf) => new AssistantInboxView(leaf, plugin),
	);

	registerIfAllowed(
		VIEW_TYPE_ASSISTANT_WORKSPACE,
		(leaf) => new AssistantWorkspaceView(leaf, plugin),
	);

	registerCommands(plugin);
	plugin.addSettingTab(new TrueRecallSettingTab(plugin.app, plugin));
	registerEventHandlers(plugin);
	plugin.applyTabBarVisibility();

	const { CommandService: CmdService } = await import(
		"@true-recall/obsidian/commands"
	);
	plugin.commandService = new CmdService({
		flashcardManager: plugin.flashcardManager,
		cardStore: plugin.cardStore,
		sessionPersistence: plugin.sessionPersistence,
	});
}
