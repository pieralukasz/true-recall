import { z } from "zod";

import type { MarkdownFlashcardsSettings } from "./settings";

export const ScheduleSchema = z.object({
	updatedAt: z.number().nonnegative().finite(),
	due: z.iso.datetime({ offset: true }),
	stability: z.number().nonnegative().finite(),
	difficulty: z.number().min(0).max(10),
	reps: z.number().int().nonnegative(),
	lapses: z.number().int().nonnegative(),
	state: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
	lastReview: z.iso.datetime({ offset: true }).nullable(),
	scheduledDays: z.number().nonnegative().finite(),
	learningStep: z.number().int().nonnegative(),
	suspended: z.boolean().optional(),
	buriedUntil: z.iso.datetime({ offset: true }).optional(),
	createdAt: z.number().nonnegative().optional(),
});
export const CardMarkerSchema = z.object({
	v: z.literal(1),
	id: z.uuid(),
	schedules: z.array(ScheduleSchema.nullable()).max(2).optional(),
});
export type CardMarker = z.infer<typeof CardMarkerSchema>;
export interface MarkdownCard {
	front: string;
	back: string;
	reversed: boolean;
	marker?: CardMarker;
	/** Byte offsets in the original JS string, excluding the trailing line break. */
	markerStart: number;
	markerEnd: number;
}
const PREFIX = "<!-- true-recall:";
export function serializeMarker(marker: CardMarker): string {
	return `${PREFIX} ${JSON.stringify(marker)} -->`;
}

/** Blank lines separate cards; fields may contain multiple consecutive lines. */
export function parseMarkdownCards(
	text: string,
	settings: MarkdownFlashcardsSettings,
): MarkdownCard[] {
	const lines = [...text.matchAll(/[^\r\n]*(?:\r\n|\n|\r|$)/g)].filter(
		(m) => m[0].length > 0,
	);
	const cards: MarkdownCard[] = [];
	let block: { text: string; start: number; end: number; code: boolean }[] = [];
	let fence = "";
	let frontmatter = lines[0]?.[0].trim() === "---";
	const flush = () => {
		const separators = block.flatMap((line, i) =>
			!line.code &&
			[settings.basicSeparator, settings.reversedSeparator].includes(
				line.text.trim(),
			)
				? [i]
				: [],
		);
		const markers = block.filter(
			(line) => !line.code && line.text.trim().startsWith(PREFIX),
		);
		if (!separators.length) {
			if (markers.length)
				throw new Error(
					"A flashcard marker has no matching separator. Keep its question, separator, answer and marker together.",
				);
			block = [];
			return;
		}
		if (separators.length !== 1)
			throw new Error("Separate Markdown flashcards with a blank line.");
		const split = separators[0] ?? 0;
		const last = block.at(-1);
		if (!last) return;
		if (markers.length > 1 || (markers.length === 1 && markers[0] !== last))
			throw new Error(
				"Place one True Recall marker directly after each answer.",
			);
		let marker: CardMarker | undefined;
		if (markers.length) {
			const match = /^<!-- true-recall:\s*(.*?)\s*-->$/.exec(last.text.trim());
			if (!match?.[1])
				throw new Error(
					"Invalid True Recall marker; the note was not imported.",
				);
			marker = CardMarkerSchema.parse(JSON.parse(match[1]));
		}
		const front = block
			.slice(0, split)
			.map((line) => line.text)
			.join("\n")
			.trim();
		const back = block
			.slice(split + 1, marker ? -1 : undefined)
			.map((line) => line.text)
			.join("\n")
			.trim();
		if (!front || !back)
			throw new Error(
				"Each Markdown flashcard needs both a question and an answer.",
			);
		cards.push({
			front,
			back,
			reversed: block[split]?.text.trim() === settings.reversedSeparator,
			marker,
			markerStart: marker ? last.start : last.end,
			markerEnd: last.end,
		});
		block = [];
	};
	for (let i = 0; i < lines.length; i++) {
		const match = lines[i];
		if (!match) continue;
		const line = match[0].replace(/[\r\n]+$/, "");
		if (frontmatter) {
			if (i > 0 && /^(---|\.\.\.)$/.test(line.trim())) frontmatter = false;
			continue;
		}
		const matchFence = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
		const code = Boolean(fence || matchFence);
		if (matchFence && !fence) fence = matchFence;
		else if (
			matchFence &&
			fence &&
			matchFence[0] === fence[0] &&
			matchFence.length >= fence.length
		)
			fence = "";
		if (!line.trim() && !code) {
			flush();
			continue;
		}
		block.push({
			text: line,
			start: match.index,
			end: match.index + line.length,
			code,
		});
	}
	if (fence || frontmatter)
		throw new Error(
			"Close the code fence or frontmatter before importing flashcards.",
		);
	flush();
	const ids = cards.flatMap((card) => (card.marker ? [card.marker.id] : []));
	if (new Set(ids).size !== ids.length)
		throw new Error(
			"Duplicate True Recall IDs: remove the marker from the copied card to give it a new ID.",
		);
	return cards;
}

export function writeMarkers(
	text: string,
	cards: MarkdownCard[],
	markerFor: (card: MarkdownCard) => CardMarker,
): string {
	const newline = text.includes("\r\n") ? "\r\n" : "\n";
	for (const card of [...cards].reverse()) {
		const replacement = `${card.marker ? "" : newline}${serializeMarker(markerFor(card))}`;
		text =
			text.slice(0, card.markerStart) +
			replacement +
			text.slice(card.markerEnd);
	}
	return text;
}

export function hasInlineTag(text: string, tag: string): boolean {
	let fence = "";
	for (const line of text.split(/\r?\n/)) {
		const match = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
		if (match) {
			if (!fence) fence = match;
			else if (match[0] === fence[0] && match.length >= fence.length)
				fence = "";
			continue;
		}
		if (fence) continue;
		const plain = line.replace(/`+[^`]*`+/g, "").replace(/<!--.*?-->/g, "");
		if (
			[...plain.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)].some(
				(match) => match[1] === tag,
			)
		)
			return true;
	}
	return false;
}
