import type {
	AnkiCard,
	AnkiModel,
	AnkiNote,
	ApkgData,
	ConvertedCard,
} from "../../types";

const FIELD_SEPARATOR = "\x1f";

const HTML_ENTITIES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&nbsp;": " ",
	"&quot;": '"',
	"&#39;": "'",
	"&apos;": "'",
};

const HTML_ENTITY_REGEX = new RegExp(
	Object.keys(HTML_ENTITIES).join("|"),
	"gi",
);

export class AnkiConverterService {
	convert(data: ApkgData): ConvertedCard[] {
		const results: ConvertedCard[] = [];
		const noteMap = new Map(data.notes.map((n) => [n.id, n]));

		for (const card of data.cards) {
			const note = noteMap.get(card.nid);
			if (!note) continue;

			const model = data.models.get(note.mid);
			if (!model) continue;

			const deck = data.decks.get(card.did);
			const deckName = deck ? deck.name.replace(/::/g, "/") : "Default";
			const tags = note.tags.trim().split(/\s+/).filter(Boolean);
			const fields = note.flds.split(FIELD_SEPARATOR);

			const converted = this.convertCard(
				card,
				note,
				model,
				fields,
				deckName,
				tags,
			);
			if (converted) results.push(converted);
		}

		this.linkReversedCards(results);

		return results;
	}

	private convertCard(
		card: AnkiCard,
		note: AnkiNote,
		model: AnkiModel,
		fields: string[],
		deckName: string,
		tags: string[],
	): ConvertedCard | null {
		const rawFront = fields[0] ?? "";
		const rawBack = fields[1] ?? "";

		if (model.type === 1) {
			return this.convertClozeCard(
				card,
				note,
				rawFront,
				rawBack,
				deckName,
				tags,
			);
		}

		const isReversed =
			model.type === 0 && model.tmpls.length > 1 && card.ord === 1;

		if (isReversed) {
			return this.convertReversedCard(
				card,
				note,
				rawFront,
				rawBack,
				deckName,
				tags,
			);
		}

		return this.convertBasicCard(card, note, rawFront, rawBack, deckName, tags);
	}

	private convertBasicCard(
		card: AnkiCard,
		note: AnkiNote,
		rawFront: string,
		rawBack: string,
		deckName: string,
		tags: string[],
	): ConvertedCard {
		const question = this.htmlToMarkdown(rawFront);
		const answer = this.htmlToMarkdown(rawBack);
		const allContent = rawFront + rawBack;

		return {
			ankiCardId: card.id,
			ankiNoteId: note.id,
			question,
			answer,
			cardType: "basic",
			tags,
			deckName,
			mediaFiles: this.extractMediaFiles(allContent),
		};
	}

	private convertClozeCard(
		card: AnkiCard,
		note: AnkiNote,
		rawTemplate: string,
		rawExtra: string,
		deckName: string,
		tags: string[],
	): ConvertedCard {
		// Anki cloze syntax is identical to True Recall: {{c1::text}} / {{c1::text::hint}}
		// card.ord is 0-based, cloze numbers are 1-based
		const clozeIndex = card.ord + 1;
		const template = this.htmlToMarkdown(rawTemplate);
		const extra = this.htmlToMarkdown(rawExtra);
		const answer = extra ? `${template}\n\n${extra}` : template;

		return {
			ankiCardId: card.id,
			ankiNoteId: note.id,
			question: template,
			answer,
			cardType: "cloze",
			clozeTemplate: template,
			clozeIndex,
			tags,
			deckName,
			mediaFiles: this.extractMediaFiles(rawTemplate + rawExtra),
		};
	}

	private convertReversedCard(
		card: AnkiCard,
		note: AnkiNote,
		rawFront: string,
		rawBack: string,
		deckName: string,
		tags: string[],
	): ConvertedCard {
		const question = this.htmlToMarkdown(rawBack);
		const answer = this.htmlToMarkdown(rawFront);
		const allContent = rawFront + rawBack;

		return {
			ankiCardId: card.id,
			ankiNoteId: note.id,
			question,
			answer,
			cardType: "reversed",
			tags,
			deckName,
			mediaFiles: this.extractMediaFiles(allContent),
		};
	}

	/**
	 * After all cards are converted, link each reversed card (ord=1) back to
	 * the basic card (ord=0) from the same note via reverseOfAnkiCardId.
	 */
	private linkReversedCards(cards: ConvertedCard[]): void {
		const basicByNote = new Map<number, number>();

		for (const card of cards) {
			if (card.cardType === "basic") {
				basicByNote.set(card.ankiNoteId, card.ankiCardId);
			}
		}

		for (const card of cards) {
			if (card.cardType === "reversed") {
				const basicId = basicByNote.get(card.ankiNoteId);
				if (basicId !== undefined) {
					card.reverseOfAnkiCardId = basicId;
				}
			}
		}
	}

	private htmlToMarkdown(html: string): string {
		let text = html;

		// Line breaks
		text = text.replace(/<br\s*\/?>/gi, "\n");

		// Pre-formatted blocks (before other tag stripping)
		text = text.replace(
			/<pre[^>]*>([\s\S]*?)<\/pre>/gi,
			(_match, content: string) => {
				const inner = this.stripTags(content);
				return `\n\`\`\`\n${inner}\n\`\`\`\n`;
			},
		);

		// Inline code
		text = text.replace(
			/<code[^>]*>([\s\S]*?)<\/code>/gi,
			(_match, content: string) => {
				const inner = this.stripTags(content);
				return `\`${inner}\``;
			},
		);

		// Bold
		text = text.replace(/<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/gi, "**$1**");

		// Italic
		text = text.replace(/<(?:i|em)>([\s\S]*?)<\/(?:i|em)>/gi, "*$1*");

		// Images → Obsidian embeds
		text = text.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, "![[$1]]");

		// Anki sound references → Obsidian embeds
		text = text.replace(/\[sound:([^\]]+)\]/g, "![[$1]]");

		// Strip remaining block-level tags, preserving content with newlines
		text = text.replace(/<\/(?:div|p)>/gi, "\n");
		text = text.replace(/<(?:div|p|span)[^>]*>/gi, "");

		// Underline tags are kept (Obsidian renders them natively)
		// Strip any remaining unknown HTML tags, preserving content
		text = text.replace(/<\/?(?!u\b)[a-z][a-z0-9]*[^>]*>/gi, "");

		// Decode HTML entities
		text = text.replace(HTML_ENTITY_REGEX, (entity) => {
			return HTML_ENTITIES[entity.toLowerCase()] ?? entity;
		});

		// Collapse excessive blank lines (3+ newlines → 2)
		text = text.replace(/\n{3,}/g, "\n\n");

		return text.trim();
	}

	private stripTags(html: string): string {
		return html.replace(/<[^>]+>/g, "");
	}

	private extractMediaFiles(content: string): string[] {
		const files = new Set<string>();

		// <img src="filename">
		const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
		for (
			let match = imgRegex.exec(content);
			match !== null;
			match = imgRegex.exec(content)
		) {
			if (match[1]) files.add(match[1]);
		}

		// [sound:filename.mp3]
		const soundRegex = /\[sound:([^\]]+)\]/g;
		for (
			let match = soundRegex.exec(content);
			match !== null;
			match = soundRegex.exec(content)
		) {
			if (match[1]) files.add(match[1]);
		}

		return [...files];
	}
}
