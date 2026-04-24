import type { CardAIContext, CardAIPreset, CardFields } from "./card-ai.types";
import type { CardAITarget } from "./card-ai-target";

export interface CardAIContextCollector {
	collect(
		preset: CardAIPreset,
		target: CardAITarget,
	): Promise<CardAIContext | undefined>;
}

export interface SourceNoteContextDeps {
	readSourceNote(
		sourceUid: string,
	): Promise<{ path: string; content: string } | null>;
	listRelatedCards(
		sourceUid: string,
	): Array<{ id: string; fields: CardFields; noteType: string }>;
}

const MAX_RELATED_CARDS = 10;

export class SourceNoteContextCollector implements CardAIContextCollector {
	constructor(private readonly deps: SourceNoteContextDeps) {}

	async collect(
		preset: CardAIPreset,
		target: CardAITarget,
	): Promise<CardAIContext | undefined> {
		if (!preset.includeSourceNote && !preset.includeRelatedCards)
			return undefined;
		const ctx: CardAIContext = {};
		const sourceUid = target.getSourceUid();
		if (!sourceUid) return ctx;

		if (preset.includeSourceNote) {
			const note = await this.deps.readSourceNote(sourceUid);
			if (note) {
				ctx.sourceNotePath = note.path;
				ctx.sourceNoteContent = note.content;
			}
		}
		if (preset.includeRelatedCards) {
			const all = this.deps.listRelatedCards(sourceUid);
			const currentId = target.getCurrentCardId();
			ctx.relatedCards = all
				.filter((c) => c.id !== currentId)
				.slice(0, MAX_RELATED_CARDS)
				.map(({ fields, noteType }) => ({ fields, noteType }));
		}
		return ctx;
	}
}
