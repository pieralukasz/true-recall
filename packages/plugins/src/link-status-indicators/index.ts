import { notify } from "@true-recall/obsidian/services/notification.service";

import type { PluginManifest } from "../types";
import { createLinkStatusPostProcessor } from "./LinkStatusPostProcessor";
import { createLinkStatusViewPlugin } from "./LinkStatusViewPlugin";

export { createLinkStatusPostProcessor } from "./LinkStatusPostProcessor";
export { createLinkStatusViewPlugin } from "./LinkStatusViewPlugin";

let extensionsRegistered = false;

export const linkStatusIndicatorsManifest: PluginManifest = {
	info: {
		id: "link-status-indicators",
		name: "Link Status Indicators",
		description:
			"Show inline status donuts next to [[wikilinks]] that reveal flashcard review state at a glance. In reading mode you also get text count indicators, and hovering a link opens a tooltip with full note stats.",
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

		// CM6 extensions and markdown post-processors can't be unregistered
		// mid-session — register once and gate visibility live so the settings
		// toggle works without a restart.
		if (extensionsRegistered) return;
		extensionsRegistered = true;

		const isEnabled = () =>
			plugin.settings.pluginStates?.["link-status-indicators"] !== false &&
			plugin.settings.showLinkStatusIndicators;

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
			isEnabled,
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
			isEnabled,
			() => plugin.settings.showDonutsInPanel,
			onReviewNote,
			onReviewNotes,
		);
		plugin.registerMarkdownPostProcessor(postProcessor);
	},
};
