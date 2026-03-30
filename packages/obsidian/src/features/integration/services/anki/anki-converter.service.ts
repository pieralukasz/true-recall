import { renderTemplate } from "@features/core/services/template-engine";
import { stripHtmlFromTemplate } from "./anki-note-type-mapper";
import type {
	AnkiCard,
	AnkiModel,
	AnkiNote,
	ApkgData,
	ConvertedCard,
} from "@shared/types";

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
			const rawFields = note.flds.split(FIELD_SEPARATOR);

			// Build named field values from model's field definitions
			const fieldValues: Record<string, string> = {};
			for (const fieldDef of model.flds) {
				const rawValue = rawFields[fieldDef.ord] ?? "";
				fieldValues[fieldDef.name] = this.htmlToMarkdown(rawValue);
			}

			const converted = this.convertCard(
				card,
				note,
				model,
				rawFields,
				fieldValues,
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
		rawFields: string[],
		fieldValues: Record<string, string>,
		deckName: string,
		tags: string[],
	): ConvertedCard | null {
		const tmpl = model.tmpls[card.ord] ?? model.tmpls[0];
		const allContent = rawFields.join("");

		if (model.type === 1) {
			return this.convertClozeCard(
				card,
				note,
				model,
				tmpl,
				fieldValues,
				allContent,
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
				model,
				tmpl,
				fieldValues,
				allContent,
				deckName,
				tags,
			);
		}

		return this.convertBasicCard(
			card,
			note,
			model,
			tmpl,
			fieldValues,
			allContent,
			deckName,
			tags,
		);
	}

	private convertBasicCard(
		card: AnkiCard,
		note: AnkiNote,
		model: AnkiModel,
		tmpl: { qfmt: string; afmt: string } | undefined,
		fieldValues: Record<string, string>,
		allContent: string,
		deckName: string,
		tags: string[],
	): ConvertedCard {
		const { question, answer } = this.renderAnkiTemplate(tmpl, fieldValues);

		return {
			ankiCardId: card.id,
			ankiNoteId: note.id,
			ankiModelId: model.id,
			question,
			answer,
			cardType: "basic",
			tags,
			deckName,
			mediaFiles: this.extractMediaFiles(allContent),
			fieldValues,
			templateOrd: card.ord,
		};
	}

	private convertClozeCard(
		card: AnkiCard,
		note: AnkiNote,
		model: AnkiModel,
		tmpl: { qfmt: string; afmt: string } | undefined,
		fieldValues: Record<string, string>,
		allContent: string,
		deckName: string,
		tags: string[],
	): ConvertedCard {
		// card.ord is 0-based, cloze numbers are 1-based
		const clozeIndex = card.ord + 1;

		const { question, answer } = this.renderAnkiTemplate(
			tmpl,
			fieldValues,
			clozeIndex,
		);

		// clozeTemplate stores the raw cloze field for editing
		const clozeFieldName = this.findClozeFieldName(tmpl?.qfmt ?? "");
		const clozeTemplate = fieldValues[clozeFieldName] ?? question;

		return {
			ankiCardId: card.id,
			ankiNoteId: note.id,
			ankiModelId: model.id,
			question,
			answer,
			cardType: "cloze",
			clozeTemplate,
			clozeIndex,
			tags,
			deckName,
			mediaFiles: this.extractMediaFiles(allContent),
			fieldValues,
			templateOrd: card.ord,
		};
	}

	private convertReversedCard(
		card: AnkiCard,
		note: AnkiNote,
		model: AnkiModel,
		tmpl: { qfmt: string; afmt: string } | undefined,
		fieldValues: Record<string, string>,
		allContent: string,
		deckName: string,
		tags: string[],
	): ConvertedCard {
		const { question, answer } = this.renderAnkiTemplate(tmpl, fieldValues);

		return {
			ankiCardId: card.id,
			ankiNoteId: note.id,
			ankiModelId: model.id,
			question,
			answer,
			cardType: "reversed",
			tags,
			deckName,
			mediaFiles: this.extractMediaFiles(allContent),
			fieldValues,
			templateOrd: card.ord,
		};
	}

	private renderAnkiTemplate(
		tmpl: { qfmt: string; afmt: string } | undefined,
		fieldValues: Record<string, string>,
		clozeIndex?: number,
	): { question: string; answer: string } {
		if (!tmpl) {
			// Fallback: use first two fields directly
			const values = Object.values(fieldValues);
			return {
				question: values[0] ?? "",
				answer: values[1] ?? values[0] ?? "",
			};
		}

		const qfmt = stripHtmlFromTemplate(tmpl.qfmt);
		const afmt = stripHtmlFromTemplate(tmpl.afmt);

		const question = renderTemplate(qfmt, {
			fields: fieldValues,
			clozeIndex,
		});

		const answer = renderTemplate(afmt, {
			fields: fieldValues,
			frontSide: "",
			clozeIndex,
		});

		return { question, answer };
	}

	private findClozeFieldName(qfmt: string): string {
		const match = /\{\{\s*cloze:([\w][\w ]*?)\s*\}\}/.exec(qfmt);
		return match?.[1] ?? "Text";
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
