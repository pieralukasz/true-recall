import { requestUrl, TFile } from "obsidian";

import type {
	AssistantNoteTypeInfo,
	AssistantRelatedCard,
	AssistantToolHost,
	ImageCandidate,
} from "@true-recall/core/ai/assistant";
import {
	type KnowledgeEvidence,
	RagKnowledgeRetriever,
} from "@true-recall/core/rag";

import type TrueRecallPlugin from "@true-recall/obsidian/main";

import { mapOpenverseResults, OPENVERSE_URL } from "./openverse";

const MAX_RELATED_CARDS = 10;

export class ObsidianAssistantHost implements AssistantToolHost {
	constructor(private plugin: TrueRecallPlugin) {}

	listNoteTypes(): AssistantNoteTypeInfo[] {
		const store = this.plugin.cardStore;
		if (!store) return [];
		return store.noteTypes.getAll().map((nt) => ({
			id: nt.id,
			name: nt.name,
			fields: [...nt.fields],
		}));
	}

	getCardFields(cardId: string): {
		noteId: string;
		noteTypeId: string;
		fields: Record<string, string>;
	} | null {
		const store = this.plugin.cardStore;
		const card = store?.cards.get(cardId);
		if (!store || !card?.noteId || !card.noteTypeId) return null;
		const note = store.notes.getById(card.noteId);
		const noteType = store.noteTypes.getById(card.noteTypeId);
		if (!note || !noteType) return null;
		const fields: Record<string, string> = {};
		for (const f of noteType.fields) fields[f] = note.fields?.[f] ?? "";
		return { noteId: card.noteId, noteTypeId: card.noteTypeId, fields };
	}

	getRelatedCards(sourceUid: string): AssistantRelatedCard[] {
		const store = this.plugin.cardStore;
		if (!store) return [];
		const out: AssistantRelatedCard[] = [];
		for (const c of store.cards.getCardsBySourceUid(sourceUid) ?? []) {
			if (out.length >= MAX_RELATED_CARDS) break;
			if (!c.noteTypeId || !c.noteId) continue;
			const nt = store.noteTypes.getById(c.noteTypeId);
			const note = store.notes.getById(c.noteId);
			if (!nt || !note) continue;
			const fields: Record<string, string> = {};
			for (const f of nt.fields) fields[f] = note.fields?.[f] ?? "";
			out.push({ noteType: nt.name, fields });
		}
		return out;
	}

	async readNote(path: string): Promise<string | null> {
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return null;
		return this.plugin.app.vault.cachedRead(file);
	}

	async searchImages(query: string, count: number): Promise<ImageCandidate[]> {
		try {
			const pageSize = Math.min(count, 20);
			const response = await requestUrl({
				url: `${OPENVERSE_URL}?q=${encodeURIComponent(query)}&page_size=${pageSize}`,
			});
			return mapOpenverseResults(response.json, count);
		} catch (error) {
			console.warn("[True Recall] Openverse search failed:", error);
			return [];
		}
	}

	async searchKnowledge(
		query: string,
		count: number,
	): Promise<KnowledgeEvidence[]> {
		if (!this.plugin.ragSearch) return [];
		return new RagKnowledgeRetriever(this.plugin.ragSearch).retrieve({
			query,
			maxResults: count,
			tokenBudget: 3000,
			diversifyBySource: true,
		});
	}
}
