import type { Menu } from "obsidian";

import type { AssistantContext } from "@true-recall/core/ai/assistant";

import { openAiWorkspace } from "@true-recall/obsidian/features/assistant/ui/open-ai-workspace";
import type { CardActionsHandler } from "@true-recall/obsidian/features/study/ui/review/handlers";
import type { TypeInMode } from "@true-recall/obsidian/features/study/ui/review/helpers";
import type { ReviewApi } from "@true-recall/obsidian/store";
import { capabilities, isMobile } from "@true-recall/obsidian/utils/platform";

import type TrueRecallPlugin from "../../main";
import { isPluginEnabled } from "../../plugin/plugin-utils";

export interface ReviewMenuActions {
	plugin: TrueRecallPlugin;
	getReview: () => ReviewApi;
	cardActionsHandler: CardActionsHandler;
	getTypeInMode: () => TypeInMode;
	cycleTypeInMode: () => void;
	buildAssistantContext: () => AssistantContext;
	canFactCheckCurrentCard: () => boolean;
	factCheckCurrentCard: () => void;
	openCardPolishMenu: (event: MouseEvent) => void;
	canUndoSessionAction: () => boolean;
	undoSessionAction: () => Promise<boolean>;
	handleOpenSourceNote: () => void;
}
export function populateReviewActionsMenu(
	menu: Menu,
	deps: ReviewMenuActions,
): void {
	// Keyboard hints are noise on touch devices without a keyboard.
	const withHint = (label: string, hint: string) =>
		isMobile() ? label : `${label} (${hint})`;
	const typeInMode = deps.getTypeInMode();
	const typeInMenuLabel = withHint(
		typeInMode === "ai" ? "Type in: On" : "Type in: Off",
		"t",
	);

	menu.addItem((item) =>
		item
			.setTitle(typeInMenuLabel)
			.setIcon("text-cursor-input")
			.onClick(() => deps.cycleTypeInMode()),
	);
	menu.addSeparator();

	if (isPluginEnabled(deps.plugin.settings, "ai-assistant")) {
		menu.addItem((item) =>
			item
				.setTitle("Ask AI about this card")
				.setIcon("sparkles")
				.onClick(() => {
					openAiWorkspace(deps.plugin, {
						intent: "compose",
						context: deps.buildAssistantContext(),
					});
				}),
		);
		if (deps.canFactCheckCurrentCard()) {
			menu.addItem((item) =>
				item
					.setTitle("Fact check this card (AI)")
					.setIcon("search-check")
					.onClick(() => deps.factCheckCurrentCard()),
			);
		}
		// On mobile the polish button has no home in the grade bar, so it
		// joins the actions menu here.
		if (isMobile() && isPluginEnabled(deps.plugin.settings, "card-polish")) {
			menu.addItem((item) =>
				item
					.setTitle("Polish card (AI)")
					.setIcon("wand")
					.onClick((evt) => {
						if (evt instanceof MouseEvent) deps.openCardPolishMenu(evt);
					}),
			);
		}
		menu.addSeparator();
	}

	if (deps.canUndoSessionAction()) {
		menu.addItem((item) =>
			item
				.setTitle(withHint("Undo last action", "z"))
				.setIcon("undo")
				.onClick(() => void deps.undoSessionAction()),
		);
		menu.addSeparator();
	}

	menu.addItem((item) =>
		item
			.setTitle(withHint("Move card", "m"))
			.setIcon("folder-input")
			.onClick(() => deps.cardActionsHandler.handleMoveCard()),
	);
	menu.addItem((item) =>
		item
			.setTitle(withHint("Delete card", "shift+1"))
			.setIcon("trash-2")
			.onClick(() => deps.cardActionsHandler.handleDelete()),
	);
	menu.addItem((item) =>
		item
			.setTitle(withHint("Suspend card", "shift+2"))
			.setIcon("pause")
			.onClick(() => deps.cardActionsHandler.handleSuspend()),
	);
	menu.addItem((item) =>
		item
			.setTitle(withHint("Bury card", "-"))
			.setIcon("eye-off")
			.onClick(() => deps.cardActionsHandler.handleBuryCard()),
	);
	menu.addItem((item) =>
		item
			.setTitle(withHint("Bury note", "="))
			.setIcon("eye-off")
			.onClick(() => deps.cardActionsHandler.handleBuryNote()),
	);
	if (deps.cardActionsHandler.canForgetCurrentCard()) {
		menu.addItem((item) =>
			item
				.setTitle(withHint("Forget card", "f"))
				.setIcon("rotate-ccw")
				.onClick(() => deps.cardActionsHandler.handleForget()),
		);
	}
	const currentCard = deps.getReview().getCurrentCard();
	const isNoteReview = currentCard?.cardType === "note-review";

	if (isNoteReview) {
		menu.addItem((item) =>
			item
				.setTitle(withHint("Open note", "e"))
				.setIcon("external-link")
				.onClick(() => deps.handleOpenSourceNote()),
		);
	} else {
		menu.addItem((item) =>
			item
				.setTitle(withHint("Edit card", "e"))
				.setIcon("pencil")
				.onClick(() => void deps.cardActionsHandler.handleEditCardModal()),
		);
		menu.addItem((item) =>
			item
				.setTitle("Change note type")
				.setIcon("replace")
				.onClick(() => void deps.cardActionsHandler.handleChangeNoteType()),
		);
		menu.addItem((item) =>
			item
				.setTitle(withHint("Add flashcard", "a"))
				.setIcon("plus")
				.onClick(() => void deps.cardActionsHandler.handleAddNewFlashcard()),
		);
		if (capabilities.canEditImageOcclusion()) {
			menu.addItem((item) =>
				item
					.setTitle("Add image occlusion")
					.setIcon("image")
					.onClick(
						() => void deps.cardActionsHandler.handleAddImageOcclusion(),
					),
			);
		}
		menu.addItem((item) =>
			item
				.setTitle("Open source note")
				.setIcon("external-link")
				.onClick(() => deps.handleOpenSourceNote()),
		);
	}
}
