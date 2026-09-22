import type { Note } from "../../types/note.types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
} from "../../types/note.types";
import {
	type ContentBase,
	type MarkdownCard,
	parseMarkdownCards,
	writeMarkers,
} from "./parser";
import type { MarkdownFlashcardsSettings } from "./settings";

export interface CardContent {
	front: string;
	back: string;
	reversed: boolean;
}
export interface ContentPlan {
	original: MarkdownCard;
	merged: CardContent;
	base: ContentBase;
}

export function noteContent(note: Note): CardContent {
	if (
		![BUILTIN_BASIC_ID, BUILTIN_BASIC_REVERSED_ID].includes(note.noteTypeId)
	) {
		throw new Error(
			"Markdown cards support Basic and Basic (reversed) note types. Restore the note type before syncing.",
		);
	}
	return {
		front: note.fields.Front ?? "",
		back: note.fields.Back ?? "",
		reversed: note.noteTypeId === BUILTIN_BASIC_REVERSED_ID,
	};
}

async function digest(text: string): Promise<string> {
	const hash = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(text),
	);
	return Array.from(new Uint8Array(hash), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}
async function fingerprint(content: CardContent): Promise<ContentBase> {
	const [front, back] = await Promise.all([
		digest(content.front),
		digest(content.back),
	]);
	return { front, back, reversed: content.reversed };
}

function mergeField<T extends string | boolean>(
	field: string,
	file: T,
	panel: T,
	fileHash: string | boolean,
	panelHash: string | boolean,
	base: string | boolean | undefined,
	card: MarkdownCard,
): T {
	if (file === panel) return file;
	if (base !== undefined && panelHash === base) return file;
	if (base !== undefined && fileHash === base) return panel;
	throw new Error(
		`Sync conflict in ${field} of "${card.front.slice(0, 60)}". The note and panel contain different edits. Both versions are kept. Make that field match in the note and panel, then run Sync Markdown flashcards.`,
	);
}

/** Each device keeps its own baseline: a remote file update must not make an older local database look like a new panel edit. */
export async function planContent(
	card: MarkdownCard,
	note: Note | undefined,
	deviceId: string,
): Promise<ContentPlan> {
	const file = { front: card.front, back: card.back, reversed: card.reversed };
	if (!note)
		return { original: card, merged: file, base: await fingerprint(file) };
	const panel = noteContent(note);
	const [fileHash, panelHash] = await Promise.all([
		fingerprint(file),
		fingerprint(panel),
	]);
	const base = card.marker?.bases?.[deviceId];
	const merged = {
		front: mergeField(
			"question",
			file.front,
			panel.front,
			fileHash.front,
			panelHash.front,
			base?.front,
			card,
		),
		back: mergeField(
			"answer",
			file.back,
			panel.back,
			fileHash.back,
			panelHash.back,
			base?.back,
			card,
		),
		reversed: mergeField(
			"card direction",
			file.reversed,
			panel.reversed,
			fileHash.reversed,
			panelHash.reversed,
			base?.reversed,
			card,
		),
	};
	return { original: card, merged, base: await fingerprint(merged) };
}

/** Changes only fields that differ, preserving surrounding prose, markers, line endings and other cards. */
export function writeContent(
	text: string,
	plans: ContentPlan[],
	settings: MarkdownFlashcardsSettings,
): string {
	const newline = text.includes("\r\n") ? "\r\n" : "\n";
	const edits: { start: number; end: number; value: string }[] = [];
	for (const { original, merged } of plans) {
		for (const field of ["front", "back"] as const) {
			if (original[field] !== merged[field])
				edits.push({
					start: original[`${field}Start`],
					end: original[`${field}End`],
					value: merged[field].replace(/\r\n|\r|\n/g, newline),
				});
		}
		if (original.reversed !== merged.reversed)
			edits.push({
				start: original.separatorStart,
				end: original.separatorEnd,
				value: merged.reversed
					? settings.reversedSeparator
					: settings.basicSeparator,
			});
	}
	for (const edit of edits.sort((a, b) => b.start - a.start))
		text = text.slice(0, edit.start) + edit.value + text.slice(edit.end);
	let parsed: MarkdownCard[];
	try {
		parsed = parseMarkdownCards(text, settings);
	} catch {
		throw new Error(
			"The panel edit cannot be represented by this Markdown card format. Keep both fields nonempty, without blank paragraph breaks or separator lines. Your panel edit has been kept; the note has not been changed.",
		);
	}
	if (
		parsed.length !== plans.length ||
		parsed.some((card, i) => {
			const expected = plans[i]?.merged;
			return (
				card.front !== expected?.front ||
				card.back !== expected.back ||
				card.reversed !== expected.reversed ||
				card.marker?.id !== plans[i]?.original.marker?.id
			);
		})
	)
		throw new Error(
			"The panel edit changes Markdown card boundaries. Your panel edit has been kept; the note has not been changed.",
		);
	return writeMarkers(
		text,
		parsed,
		(card) => card.marker ?? { v: 1, id: crypto.randomUUID() },
	);
}
