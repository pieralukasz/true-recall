import type { TFile } from "obsidian";

import { StreamingGenerationService } from "@true-recall/core/ai/generation/streaming-generation.service";
import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";

import { mutate } from "@true-recall/obsidian/data";
import { QuickNoteEditorModal } from "@true-recall/obsidian/modals/study/quick-note-editor/QuickNoteEditorModal";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { TTSPostProcessor } from "@true-recall/obsidian/services/tts-post-processor";

import { ObsidianHttpClient } from "../adapters/ObsidianHttpClient";
import type TrueRecallPlugin from "../main";

let streamingService: StreamingGenerationService | null = null;
let ttsProcessor: TTSPostProcessor | null = null;

function getStreamingService(
	plugin: TrueRecallPlugin,
): StreamingGenerationService {
	if (!streamingService) {
		streamingService = new StreamingGenerationService(
			() => plugin.settings,
			plugin.flashcardManager as any,
			new ObsidianHttpClient(),
		);
	}
	return streamingService;
}

function getTTSPostProcessor(plugin: TrueRecallPlugin): TTSPostProcessor {
	if (!ttsProcessor) {
		ttsProcessor = new TTSPostProcessor(
			plugin.app,
			() => plugin.settings,
			plugin.cardStore,
		);
	}
	return ttsProcessor;
}

function findMostRecentMarkdownFile(plugin: TrueRecallPlugin): TFile | null {
	const recentPaths = plugin.app.workspace.getLastOpenFiles();
	for (const path of recentPaths) {
		if (!path.endsWith(".md")) continue;
		const file = plugin.app.vault.getAbstractFileByPath(path);
		if (file instanceof (plugin.app.vault.adapter.constructor as any)) continue;
		// Use type narrowing via duck-typing since TFile is not importable as value
		if (file && "basename" in file) return file as TFile;
	}
	return null;
}

export function hasApiKey(plugin: TrueRecallPlugin): boolean {
	return !!(plugin.settings.proKey || plugin.settings.openRouterApiKey);
}

export function editSelectionAsFlashcard(
	plugin: TrueRecallPlugin,
	text: string,
): void {
	const modal = new QuickNoteEditorModal(plugin.app, plugin, {
		mode: "add",
		initialFields: { Front: text },
	});
	void modal.openAndWait();
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
		const parts = text.split(/\n\s*\n/);
		const question = (parts[0] ?? text).trim();
		const answer = parts.slice(1).join("\n\n").trim();
		await plugin.flashcardManager.saveFlashcardsToSql(
			file.path,
			file.basename,
			[{ id: crypto.randomUUID(), question, answer }],
			undefined,
			text,
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
		const parts = text.split(/\n\s*\n/);
		const question = (parts[0] ?? text).trim();
		const answer = parts.slice(1).join("\n\n").trim();
		await plugin.flashcardManager.saveFlashcardsToSql(
			file.path,
			file.basename,
			[{ id: crypto.randomUUID(), question, answer }],
			undefined,
			text,
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

function runPresetPostProcessing(
	plugin: TrueRecallPlugin,
	preset: GenerationPreset,
	createdCardIds: string[],
): void {
	if (createdCardIds.length === 0) return;
	if (preset.tts?.field) {
		void getTTSPostProcessor(plugin).processCards(createdCardIds, {
			ttsField: preset.tts.field,
			languageCode: preset.tts.voice,
		});
	}
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

	try {
		await plugin.activateView();
		const service = getStreamingService(plugin);
		const result = await service.generate(text, file, preset.id);

		runPresetPostProcessing(plugin, preset, result.createdCardIds);

		if (result.created === 0 && result.duplicates === 0) {
			notify().warning("No flashcards found in AI response");
		} else if (result.duplicates > 0) {
			notify().cardsCreatedWithDuplicates(
				result.created,
				result.duplicates,
				file.basename,
			);
		} else {
			notify().cardsCreated(result.created, file.basename);
		}
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") return;
		const msg = error instanceof Error ? error.message : String(error);
		notify().error(`Generation failed: ${msg}`);
	}
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

	try {
		await plugin.activateView();
		const service = getStreamingService(plugin);
		const result = await service.generate(text, file, preset.id);

		runPresetPostProcessing(plugin, preset, result.createdCardIds);

		if (result.created === 0 && result.duplicates === 0) {
			notify().warning("No flashcards found in AI response");
		} else if (result.duplicates > 0) {
			notify().cardsCreatedWithDuplicates(
				result.created,
				result.duplicates,
				file.basename,
			);
		} else {
			notify().cardsCreated(result.created, file.basename);
		}
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") return;
		const msg = error instanceof Error ? error.message : String(error);
		notify().error(`Generation failed: ${msg}`);
	}
}
