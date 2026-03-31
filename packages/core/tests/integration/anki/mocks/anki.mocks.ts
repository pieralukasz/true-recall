import type {
	AnkiNote,
	AnkiCard,
	AnkiRevlogEntry,
	AnkiModel,
	AnkiDeck,
	ApkgData,
	ConvertedCard,
} from "../../../../src/types";

export function createAnkiNote(overrides: Partial<AnkiNote> = {}): AnkiNote {
	return {
		id: 1,
		mid: 1000,
		flds: "What is X?\x1fIt is Y",
		tags: "tag1 tag2",
		sfld: "What is X?",
		...overrides,
	};
}

export function createAnkiCard(overrides: Partial<AnkiCard> = {}): AnkiCard {
	return {
		id: 100,
		nid: 1,
		did: 1,
		ord: 0,
		type: 0,
		queue: 0,
		due: 0,
		ivl: 0,
		factor: 0,
		reps: 0,
		lapses: 0,
		...overrides,
	};
}

export function createAnkiRevlog(
	overrides: Partial<AnkiRevlogEntry> = {}
): AnkiRevlogEntry {
	return {
		id: 1700000000000,
		cid: 100,
		ease: 3,
		ivl: 1,
		lastIvl: 0,
		factor: 2500,
		time: 5000,
		type: 0,
		...overrides,
	};
}

export function createAnkiModel(
	overrides: Partial<AnkiModel> = {}
): AnkiModel {
	return {
		id: 1000,
		name: "Basic",
		type: 0,
		flds: [
			{ name: "Front", ord: 0 },
			{ name: "Back", ord: 1 },
		],
		tmpls: [
			{ name: "Card 1", qfmt: "{{Front}}", afmt: "{{Back}}", ord: 0 },
		],
		...overrides,
	};
}

export function createClozeModel(
	overrides: Partial<AnkiModel> = {}
): AnkiModel {
	return {
		id: 2000,
		name: "Cloze",
		type: 1,
		flds: [
			{ name: "Text", ord: 0 },
			{ name: "Extra", ord: 1 },
		],
		tmpls: [
			{
				name: "Cloze",
				qfmt: "{{cloze:Text}}",
				afmt: "{{cloze:Text}}<br>{{Extra}}",
				ord: 0,
			},
		],
		...overrides,
	};
}

export function createReversedModel(
	overrides: Partial<AnkiModel> = {}
): AnkiModel {
	return {
		id: 3000,
		name: "Basic (and reversed card)",
		type: 0,
		flds: [
			{ name: "Front", ord: 0 },
			{ name: "Back", ord: 1 },
		],
		tmpls: [
			{ name: "Card 1", qfmt: "{{Front}}", afmt: "{{Back}}", ord: 0 },
			{ name: "Card 2", qfmt: "{{Back}}", afmt: "{{Front}}", ord: 1 },
		],
		...overrides,
	};
}

export function createAnkiDeck(overrides: Partial<AnkiDeck> = {}): AnkiDeck {
	return {
		id: 1,
		name: "Default",
		...overrides,
	};
}

interface ApkgDataInput {
	notes?: AnkiNote[];
	cards?: AnkiCard[];
	revlog?: AnkiRevlogEntry[];
	models?: AnkiModel[];
	decks?: AnkiDeck[];
	media?: Map<string, ArrayBuffer>;
	mediaMap?: Record<string, string>;
}

export function createApkgData(overrides: ApkgDataInput = {}): ApkgData {
	const models = new Map<number, AnkiModel>();
	for (const m of overrides.models ?? []) {
		models.set(m.id, m);
	}

	const decks = new Map<number, AnkiDeck>();
	for (const d of overrides.decks ?? []) {
		decks.set(d.id, d);
	}

	return {
		notes: overrides.notes ?? [],
		cards: overrides.cards ?? [],
		revlog: overrides.revlog ?? [],
		models,
		decks,
		media: overrides.media ?? new Map(),
		mediaMap: overrides.mediaMap ?? {},
	};
}

export function createConvertedCard(
	overrides: Partial<ConvertedCard> = {}
): ConvertedCard {
	return {
		ankiCardId: 100,
		ankiNoteId: 1,
		ankiModelId: 1000,
		question: "Q",
		answer: "A",
		cardType: "basic",
		tags: [],
		deckName: "Default",
		mediaFiles: [],
		fieldValues: { Front: "Q", Back: "A" },
		templateOrd: 0,
		...overrides,
	};
}
