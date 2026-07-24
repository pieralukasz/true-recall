import { TFile } from "obsidian";

import { hasAIKey } from "@true-recall/core/ai/config/ai-client-config";
import { generationWorkflowId } from "@true-recall/core/ai/workflows/ai-workflow";
import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";

import { mutate } from "@true-recall/obsidian/data";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { openQuickNoteEditor } from "@true-recall/obsidian/views/modal-window/open-quick-note-editor";

import type TrueRecallPlugin from "../main";
import { normalizeSelectionForFlashcard } from "./normalize-selection";

function findMostRecentMarkdownFile(plugin: TrueRecallPlugin): TFile | null {
	const recentPaths = plugin.app.workspace.getLastOpenFiles();
	for (const path of recentPaths) {
		if (!path.endsWith(".md")) continue;
		const file = plugin.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) return file;
	}
	return null;
}

export function hasApiKey(plugin: TrueRecallPlugin): boolean {
	// Preset generation always runs at the "generation" scope
	// (StreamingGenerationService → resolveAIClientConfig(settings, "generation")),
	// so the toolbar gate must check that same scope. Checking the default scope
	// greyed out the button when only a generation-scoped LM Studio model was set.
	return hasAIKey(plugin.settings, "generation");
}

export function editSelectionAsFlashcard(
	plugin: TrueRecallPlugin,
	text: string,
): void {
	const normalized = normalizeSelectionForFlashcard(text);
	void openQuickNoteEditor(plugin, {
		mode: "add",
		initialFields: { Front: normalized },
	});
}

export async function quickAddFlashcardFromSelection(
	plugin: TrueRecallPlugin,
	text: string,
): Promise<void> {
	try {
		const file = plugin.app.workspace.getActiveFile();
		if (!file) {
			notify().error("No active file");
			return;
		}
		const normalized = normalizeSelectionForFlashcard(text);
		const parts = normalized.split(/\n\s*\n/);
		const question = (parts[0] ?? normalized).trim();
		const answer = parts.slice(1).join("\n\n").trim();
		await plugin.flashcardManager.saveFlashcardsToSql(
			file.path,
			file.basename,
			[{ id: crypto.randomUUID(), question, answer }],
			undefined,
			normalized,
		);
		notify().cardsCreated(1, file.basename);
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		notify().error(`Quick add failed: ${msg}`);
	}
}

export async function quickAddFlashcardGlobal(
	plugin: TrueRecallPlugin,
	text: string,
	sourceFile?: TFile | null,
): Promise<void> {
	const file =
		sourceFile ??
		plugin.app.workspace.getActiveFile() ??
		findMostRecentMarkdownFile(plugin);
	if (!file) {
		editSelectionAsFlashcard(plugin, text);
		notify().info("No active note found — opened editor instead");
		return;
	}

	try {
		const normalized = normalizeSelectionForFlashcard(text);
		const parts = normalized.split(/\n\s*\n/);
		const question = (parts[0] ?? normalized).trim();
		const answer = parts.slice(1).join("\n\n").trim();
		await plugin.flashcardManager.saveFlashcardsToSql(
			file.path,
			file.basename,
			[{ id: crypto.randomUUID(), question, answer }],
			undefined,
			normalized,
		);
		notify().cardsCreated(1, file.basename);
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		notify().error(`Quick add failed: ${msg}`);
	}
}

function deriveNoteName(text: string): string {
	const firstLine = text.split("\n")[0]?.trim() ?? "";
	const cleaned = firstLine
		.replace(/^#+\s*/, "")
		.replace(/[\\/:*?"<>|]/g, "")
		.trim();
	return cleaned.slice(0, 80) || "Selection Note";
}

export async function createNoteFromSelection(
	plugin: TrueRecallPlugin,
	text: string,
): Promise<void> {
	try {
		const { CreateNoteFromSelectionModal } = await import(
			"@true-recall/obsidian/modals/study/CreateNoteFromSelectionModal"
		);
		const defaultName = deriveNoteName(text);
		const modal = new CreateNoteFromSelectionModal(
			plugin.app,
			plugin,
			defaultName,
		);
		const result = await modal.openAndWait();
		if (result.cancelled) return;

		const path = CreateNoteFromSelectionModal.buildNotePath(
			result.name,
			result.folder,
		);
		if (plugin.app.vault.getAbstractFileByPath(path)) {
			notify().error(`Note "${result.name}" already exists`);
			return;
		}

		const file = await plugin.app.vault.create(path, text);

		const fmService = plugin.flashcardManager.getFrontmatterService();
		const uid = fmService.generateUid();
		await fmService.setSourceNoteUid(file.path, uid);

		if (result.parentProject) {
			await fmService.addParent(file.path, result.parentProject);
			plugin.hierarchyService.invalidateGraph();
			mutate("hierarchy:changed", () => {});
		}

		await plugin.app.workspace.openLinkText(file.path, "", false);
		notify().info(`Created "${file.basename}"`);
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		notify().error(`Failed to create note: ${msg}`);
	}
}

export async function appendToCurrentNote(
	plugin: TrueRecallPlugin,
	text: string,
): Promise<void> {
	const file =
		plugin.app.workspace.getActiveFile() ?? findMostRecentMarkdownFile(plugin);
	if (!file) {
		notify().error("No active note to append to");
		return;
	}

	try {
		await plugin.app.vault.process(file, (content) => {
			const separator = content.endsWith("\n") ? "\n" : "\n\n";
			return `${content}${separator}${text}\n`;
		});
		notify().info(`Appended to "${file.basename}"`);
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		notify().error(`Failed to append: ${msg}`);
	}
}

function resolvePreset(
	plugin: TrueRecallPlugin,
	presetId: string,
): GenerationPreset | null {
	return (
		plugin.settings.generationPresets.find((p) => p.id === presetId) ?? null
	);
}

export async function generateWithPreset(
	plugin: TrueRecallPlugin,
	presetId: string,
	text: string,
): Promise<void> {
	const preset = resolvePreset(plugin, presetId);
	if (!preset) {
		notify().error("Generation preset not found");
		return;
	}

	const file = plugin.app.workspace.getActiveFile();
	if (!file) {
		notify().error("No active file");
		return;
	}

	enqueueGeneration(plugin, preset, text, file);
}

export async function generateWithPresetGlobal(
	plugin: TrueRecallPlugin,
	presetId: string,
	text: string,
	sourceFile?: TFile | null,
): Promise<void> {
	const preset = resolvePreset(plugin, presetId);
	if (!preset) {
		notify().error("Generation preset not found");
		return;
	}

	const file =
		sourceFile ??
		plugin.app.workspace.getActiveFile() ??
		findMostRecentMarkdownFile(plugin);
	if (!file) {
		editSelectionAsFlashcard(plugin, text);
		notify().info("No active note found — opened editor instead");
		return;
	}

	enqueueGeneration(plugin, preset, text, file);
}

/** Deprecated AI Generation entry points now delegate to the Assistant queue. */
function enqueueGeneration(
	plugin: TrueRecallPlugin,
	preset: GenerationPreset,
	text: string,
	file: TFile,
): void {
	if (!plugin.assistantService) {
		notify().error("AI Assistant is not ready");
		return;
	}
	plugin.assistantService.startThread({
		instruction: preset.prompt,
		presetId: generationWorkflowId(preset.id),
		context: {
			selectedText: text,
			activeNotePath: file.path,
			source: { path: file.path, text },
			applyGeneratedCardsImmediately: true,
		},
		state: "active",
		displayMessage: `Generate with ${preset.name}`,
	});
	notify().info(`Generating with ${preset.name} in the background…`);
}
