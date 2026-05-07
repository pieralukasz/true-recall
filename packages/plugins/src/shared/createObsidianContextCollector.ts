import { TFile } from "obsidian";

import type TrueRecallPlugin from "@true-recall/obsidian/main";

import {
	type CardAIContextCollector,
	type CardFields,
	SourceNoteContextCollector,
} from "./card-ai";

export function createObsidianContextCollector(
	plugin: TrueRecallPlugin,
): CardAIContextCollector {
	return new SourceNoteContextCollector({
		readSourceNote: async (sourceUid) => {
			const path = plugin.frontmatterIndex?.getFileByValue(
				"flashcard_uid",
				sourceUid,
			);
			if (!path) return null;
			const file = plugin.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) return null;
			const content = await plugin.app.vault.cachedRead(file);
			return { path: file.path, content };
		},
		listRelatedCards: (sourceUid) => {
			const store = plugin.cardStore;
			if (!store) return [];
			const out: Array<{
				id: string;
				fields: CardFields;
				noteType: string;
			}> = [];
			const cards = store.cards.getCardsBySourceUid(sourceUid) ?? [];
			for (const c of cards) {
				if (!c.noteTypeId || !c.noteId) continue;
				const nt = store.noteTypes?.getById(c.noteTypeId);
				if (!nt) continue;
				const note = store.notes.getById(c.noteId);
				if (!note) continue;
				const fields: CardFields = {};
				for (const f of nt.fields) fields[f] = note.fields?.[f] ?? "";
				out.push({ id: c.id, fields, noteType: nt.name });
			}
			return out;
		},
	});
}
