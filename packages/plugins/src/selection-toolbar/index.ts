import { TFile } from "obsidian";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { QuickNoteEditorModal } from "@true-recall/obsidian/modals/study/quick-note-editor/QuickNoteEditorModal";
import { buildImageEmbed } from "@true-recall/obsidian/plugin/build-image-embed";
import {
	appendToCurrentNote,
	createNoteFromSelection,
	editSelectionAsFlashcard,
	generateWithPreset,
	generateWithPresetGlobal,
	hasApiKey,
	quickAddFlashcardFromSelection,
	quickAddFlashcardGlobal,
} from "@true-recall/obsidian/plugin/SelectionActions";
import { notify } from "@true-recall/obsidian/services/notification.service";

import type { PluginManifest } from "../types";
import { GlobalSelectionToolbar } from "./GlobalSelectionToolbar";
import { createImageToolbarExtension } from "./ImageToolbarPlugin";
import { createSelectionToolbarExtension } from "./SelectionToolbarPlugin";
import { SelectionToolbarSettingsPanel } from "./settings-panel";

function executeCommand(plugin: TrueRecallPlugin, commandId: string): void {
	(
		plugin.app as unknown as {
			commands: { executeCommandById: (id: string) => void };
		}
	).commands.executeCommandById(commandId);
}

function getSourceFileFromDOM(
	plugin: TrueRecallPlugin,
	range: Range,
): TFile | null {
	const el =
		range.commonAncestorContainer instanceof Element
			? range.commonAncestorContainer
			: range.commonAncestorContainer.parentElement;

	const leafContent = el?.closest(".workspace-leaf-content");
	if (!leafContent) return null;

	let found: TFile | null = null;
	plugin.app.workspace.iterateAllLeaves((leaf) => {
		if (found) return;
		const containerEl = (leaf as unknown as { containerEl?: HTMLElement })
			.containerEl;
		if (containerEl?.contains(leafContent)) {
			const view = leaf.view;
			if (view && "file" in view && view.file instanceof TFile) {
				found = view.file as TFile;
			}
		}
	});
	return found;
}

function closestWithDataLine(node: Node): Element | null {
	const el = node instanceof Element ? node : node.parentElement;
	return el?.closest("[data-line]") ?? null;
}

async function resolveMarkdownFromRange(
	plugin: TrueRecallPlugin,
	range: Range,
	fallback: string,
): Promise<string> {
	const container =
		range.commonAncestorContainer instanceof Element
			? range.commonAncestorContainer
			: range.commonAncestorContainer.parentElement;
	if (!container?.closest(".markdown-preview-view")) return fallback;

	const sourceFile = getSourceFileFromDOM(plugin, range);
	if (!sourceFile) return fallback;

	const startEl = closestWithDataLine(range.startContainer);
	const endEl = closestWithDataLine(range.endContainer);
	if (!startEl || !endEl) return fallback;

	const startLine = Number.parseInt(
		startEl.getAttribute("data-line") ?? "",
		10,
	);
	const endLineAttr =
		endEl.getAttribute("data-line-end") ??
		endEl.getAttribute("data-line") ??
		"";
	const endLine = Number.parseInt(endLineAttr, 10);
	if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) return fallback;

	const from = Math.min(startLine, endLine);
	const to = Math.max(startLine, endLine);

	try {
		const source = await plugin.app.vault.read(sourceFile);
		const lines = source.split("\n");
		const slice = lines
			.slice(from, to + 1)
			.join("\n")
			.trim();
		return slice || fallback;
	} catch {
		return fallback;
	}
}

function handleImageOcclusion(
	plugin: TrueRecallPlugin,
	imagePath: string,
): void {
	const activeFile = plugin.app.workspace.getActiveFile();
	const resolved = plugin.app.metadataCache.getFirstLinkpathDest(
		imagePath,
		activeFile?.path ?? "",
	);
	const resolvedPath = resolved?.path ?? imagePath;

	if (activeFile && activeFile.extension === "md") {
		const frontmatterService = plugin.flashcardManager.getFrontmatterService();
		void (async () => {
			let sourceUid = await frontmatterService.getSourceNoteUid(
				activeFile.path,
			);
			if (!sourceUid) {
				sourceUid = frontmatterService.generateUid();
				await frontmatterService.setSourceNoteUid(activeFile.path, sourceUid);
			}
			await plugin.openImageOcclusionEditor({
				mode: "add",
				sourceUid,
				imagePath: resolvedPath,
			});
		})();
	} else {
		void plugin.openImageOcclusionEditor({
			mode: "add",
			imagePath: resolvedPath,
		});
	}
}

export const selectionToolbarManifest: PluginManifest = {
	info: {
		id: "selection-toolbar",
		name: "Selection Toolbar",
		description:
			"A floating toolbar that appears above selected text or clicked images, with quick actions for flashcard creation, AI generation, and image occlusion. Works in editor, reading mode, and side panels; the button set is fully configurable.",
		features: [
			"Editor selection toolbar with configurable buttons",
			"Image click toolbar for image occlusion and quick capture",
			"Reading-mode and panel selection toolbar",
		],
		icon: "mouse-pointer-square-dashed",
		tier: "free",
	},
	settingsPanel: SelectionToolbarSettingsPanel,
	activate: (ctx) => {
		const plugin = ctx.obsidianPlugin;

		const tier = () => {
			if (plugin.settings.proKey) return "pro";
			if (hasApiKey(plugin)) return "byok";
			return "none";
		};

		const editorExtension = createSelectionToolbarExtension({
			actions: {
				onPreset: (presetId, text) =>
					generateWithPreset(plugin, presetId, text),
				onEdit: (text) => editSelectionAsFlashcard(plugin, text),
				onQuickAdd: (text) => quickAddFlashcardFromSelection(plugin, text),
				onImageOcclusion: (imagePath) =>
					handleImageOcclusion(plugin, imagePath),
				onHighlight: () => {},
				onNewNote: (text) => createNoteFromSelection(plugin, text),
				onAppend: (text) => appendToCurrentNote(plugin, text),
				onCommand: (id) => executeCommand(plugin, id),
				onDismiss: () => {},
			},
			getButtons: () => plugin.settings.editorToolbarButtons,
			tier,
			getProviderType: () => plugin.settings.providerType,
			isEnabled: () => true,
			getPluginStates: () => plugin.settings.pluginStates ?? {},
			getPresets: () => plugin.settings.generationPresets,
		});
		plugin.registerEditorExtension([editorExtension]);

		const imageExtension = createImageToolbarExtension({
			onQuickAddImage: async (imagePath) => {
				try {
					const file = plugin.app.workspace.getActiveFile();
					if (!file) {
						notify().error("No active file");
						return;
					}
					const imageEmbed = buildImageEmbed(imagePath);
					await plugin.flashcardManager.saveFlashcardsToSql(
						file.path,
						file.basename,
						[
							{
								id: crypto.randomUUID(),
								question: imageEmbed,
								answer: "",
							},
						],
						undefined,
						imageEmbed,
					);
					notify().cardsCreated(1, file.basename);
				} catch (error) {
					const msg = error instanceof Error ? error.message : String(error);
					notify().error(`Quick add failed: ${msg}`);
				}
			},
			onEdit: (imagePath) => {
				const modal = new QuickNoteEditorModal(plugin.app, plugin, {
					mode: "add",
					initialFields: {
						Front: buildImageEmbed(imagePath),
					},
				});
				void modal.openAndWait();
			},
			onImageOcclusion: (imagePath) => handleImageOcclusion(plugin, imagePath),
			getButtons: () => plugin.settings.imageToolbarButtons,
			getPluginStates: () => plugin.settings.pluginStates ?? {},
			isEnabled: () => true,
		});
		plugin.registerEditorExtension([imageExtension]);

		const globalToolbar = new GlobalSelectionToolbar({
			actions: {
				onPreset: (presetId, text, sourceFile) =>
					generateWithPresetGlobal(plugin, presetId, text, sourceFile),
				onEdit: (text) => editSelectionAsFlashcard(plugin, text),
				onQuickAdd: (text, sourceFile) =>
					quickAddFlashcardGlobal(plugin, text, sourceFile),
				onHighlight: () => {},
				onNewNote: (text) => createNoteFromSelection(plugin, text),
				onAppend: (text) => appendToCurrentNote(plugin, text),
				onCommand: (id) => executeCommand(plugin, id),
				onDismiss: () => {},
			},
			getButtons: () => plugin.settings.globalToolbarButtons,
			tier,
			getProviderType: () => plugin.settings.providerType,
			isEnabled: () => true,
			getPluginStates: () => plugin.settings.pluginStates ?? {},
			getSourceFile: (range) => getSourceFileFromDOM(plugin, range),
			getPresets: () => plugin.settings.generationPresets,
			resolveMarkdown: (range, fallback) =>
				resolveMarkdownFromRange(plugin, range, fallback),
		});
		globalToolbar.register();

		return () => {
			globalToolbar.destroy();
		};
	},
};
