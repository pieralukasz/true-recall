import type { PluginManifest } from "../types";
import { createLinkStatusPostProcessor } from "./LinkStatusPostProcessor";
import { createLinkStatusViewPlugin } from "./LinkStatusViewPlugin";

export { createLinkStatusPostProcessor } from "./LinkStatusPostProcessor";
export { createLinkStatusViewPlugin } from "./LinkStatusViewPlugin";

export const linkStatusIndicatorsManifest: PluginManifest = {
	info: {
		id: "link-status-indicators",
		name: "Link Status Indicators",
		description:
			"Show inline status donuts next to [[links]] indicating flashcard review state.",
		features: [
			"Donut charts next to wikilinks in editor",
			"Text count indicators in preview mode",
			"Note stats tooltip on hover",
		],
		icon: "circle-dot",
		tier: "free",
	},
	activate: (ctx) => {
		const { obsidianPlugin: plugin } = ctx;
		const noteStatusCache = plugin.noteStatusCache;
		if (
			!plugin.coreApp.cardStore ||
			!plugin.frontmatterIndex ||
			!noteStatusCache
		)
			return;

		const { notify } =
			require("@true-recall/obsidian/services/notification.service") as typeof import("@true-recall/obsidian/services/notification.service");

		const onReviewNote = (file: import("obsidian").TFile) => {
			plugin.reviewNoteFlashcards(file).catch((error: unknown) => {
				notify().error("Failed to start review session", error);
			});
		};

		const onReviewNotes = (noteNames: string[], dueOnly: boolean) => {
			plugin
				.startReview({ mode: "notes", noteNames, dueOnly })
				.catch((error: unknown) => {
					notify().error("Failed to start review session", error);
				});
		};

		const viewPlugin = createLinkStatusViewPlugin(
			plugin.app,
			noteStatusCache,
			plugin.frontmatterIndex,
			() => plugin.settings.showLinkStatusIndicators,
			() => plugin.settings.showDonutsInReview,
			onReviewNote,
			onReviewNotes,
			plugin.coreApp.cardStore,
		);
		plugin.registerEditorExtension([viewPlugin]);

		const postProcessor = createLinkStatusPostProcessor(
			plugin.app,
			noteStatusCache,
			plugin.frontmatterIndex,
			() => plugin.settings.showLinkStatusIndicators,
			() => plugin.settings.showDonutsInPanel,
			onReviewNote,
			onReviewNotes,
		);
		plugin.registerMarkdownPostProcessor(postProcessor);
	},
};
