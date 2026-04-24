import type { App } from "obsidian";
import { requestUrl } from "obsidian";

import {
	buildTTSRequest,
	getTTSAudioFilename,
	TTS_AUDIO_DIR,
} from "@true-recall/core/ai/tts/tts.service";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { TrueRecallSettings } from "@true-recall/core/types/settings.types";

import { mutate } from "@true-recall/obsidian/data";

export interface TTSConfig {
	ttsField: string;
	languageCode: string;
}

type VaultAdapter = App["vault"]["adapter"];

export class TTSPostProcessor {
	constructor(
		private app: App,
		private getSettings: () => TrueRecallSettings,
		private cardStore: SqliteStoreService,
	) {}

	async processCards(cardIds: string[], config: TTSConfig): Promise<void> {
		if (!config.ttsField || !config.languageCode) return;

		const settings = this.getSettings();
		const { ttsField, languageCode } = config;
		const adapter = this.app.vault.adapter;

		if (!(await adapter.exists(TTS_AUDIO_DIR))) {
			await adapter.mkdir(TTS_AUDIO_DIR);
		}

		let updated = false;
		for (const cardId of cardIds) {
			try {
				const didUpdate = await this.processCard(
					cardId,
					ttsField,
					languageCode,
					settings,
					adapter,
				);
				if (didUpdate) updated = true;
			} catch (e) {
				console.warn(`[True Recall TTS] Failed for card ${cardId}:`, e);
			}
		}

		if (updated) {
			mutate("card:updated", () => {});
		}
	}

	private async processCard(
		cardId: string,
		ttsField: string,
		languageCode: string,
		settings: TrueRecallSettings,
		adapter: VaultAdapter,
	): Promise<boolean> {
		const card = this.cardStore.cards.get(cardId);
		if (!card?.noteId) return false;

		const note = this.cardStore.notes.getById(card.noteId);
		if (!note?.fields) return false;

		const text = note.fields[ttsField];
		if (!text) return false;

		const audioKey = `_audio_${ttsField}`;
		if (note.fields[audioKey]) return false;

		const filename = getTTSAudioFilename(text, languageCode);
		const audioPath = `${TTS_AUDIO_DIR}/${filename}`;

		if (await adapter.exists(audioPath)) {
			this.updateNoteAudioField(note.id, note.fields, audioKey, audioPath);
			return true;
		}

		const { url, body, headers } = buildTTSRequest(settings, {
			text,
			languageCode,
		});

		const response = await requestUrl({
			url,
			method: "POST",
			headers,
			body: JSON.stringify(body),
		});

		if (response.status !== 200) {
			throw new Error(`TTS API returned ${response.status}`);
		}

		await adapter.writeBinary(audioPath, response.arrayBuffer);

		this.updateNoteAudioField(note.id, note.fields, audioKey, audioPath);
		return true;
	}

	private updateNoteAudioField(
		noteId: string,
		currentFields: Record<string, string>,
		audioKey: string,
		audioPath: string,
	): void {
		const updatedFields = { ...currentFields, [audioKey]: audioPath };
		this.cardStore.notes.update(noteId, { fields: updatedFields });
	}
}
