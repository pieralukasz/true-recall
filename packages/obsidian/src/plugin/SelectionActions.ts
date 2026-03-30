import { StreamingGenerationService } from "@features/ai/services/streaming-generation.service";
import { QuickNoteEditorModal } from "@features/study/modals/quick-note-editor/QuickNoteEditorModal";
import { ObsidianHttpClient } from "../adapters/ObsidianHttpClient";
import { notify } from "@shared/services/notification.service";
import { BUILTIN_BASIC_ID } from "@shared/types/note.types";
import type TrueRecallPlugin from "../main";

let streamingService: StreamingGenerationService | null = null;

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

export function hasApiKey(plugin: TrueRecallPlugin): boolean {
	return !!(plugin.settings.proKey || plugin.settings.openRouterApiKey);
}

export async function generateFlashcardsFromSelection(
	plugin: TrueRecallPlugin,
	text: string,
): Promise<void> {
	const file = plugin.app.workspace.getActiveFile();
	if (!file) {
		notify().error("No active file");
		return;
	}

	try {
		await plugin.activateView();

		const noteType =
			plugin.cardStore?.noteTypes.getById(BUILTIN_BASIC_ID) ?? null;
		const service = getStreamingService(plugin);
		const result = await service.generateStreaming(text, file, noteType);

		if (result.created === 0 && result.duplicates === 0) {
			notify().warning("No flashcards found in AI response");
		} else if (result.duplicates > 0) {
			notify().info(
				`Created ${result.created} flashcard(s), ${result.duplicates} duplicate(s) skipped`,
			);
		} else {
			notify().info(`Created ${result.created} flashcard(s)`);
		}
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") return;
		const msg = error instanceof Error ? error.message : String(error);
		notify().error(`Flashcard generation failed: ${msg}`);
	}
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
		notify().info("Quick-added 1 flashcard");
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		notify().error(`Quick add failed: ${msg}`);
	}
}
