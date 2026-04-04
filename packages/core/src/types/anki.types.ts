export interface AnkiNote {
	id: number;
	mid: number;
	flds: string;
	tags: string;
	sfld: string;
}

export interface AnkiCard {
	id: number;
	nid: number;
	did: number;
	ord: number;
	type: number;
	queue: number;
	due: number;
	ivl: number;
	factor: number;
	reps: number;
	lapses: number;
}

export interface AnkiRevlogEntry {
	id: number;
	cid: number;
	ease: number;
	ivl: number;
	lastIvl: number;
	factor: number;
	time: number;
	type: number;
}

export interface AnkiModel {
	id: number;
	name: string;
	flds: { name: string; ord: number }[];
	type: number; // 0 = standard, 1 = cloze
	tmpls: { name: string; qfmt: string; afmt: string; ord: number }[];
	css?: string;
}

export interface AnkiDeck {
	id: number;
	name: string;
}

export interface ApkgData {
	notes: AnkiNote[];
	cards: AnkiCard[];
	revlog: AnkiRevlogEntry[];
	models: Map<number, AnkiModel>;
	decks: Map<number, AnkiDeck>;
	media: Map<string, ArrayBuffer>;
	mediaMap: Record<string, string>;
}

export interface AnkiImportOptions {
	importScheduling: boolean;
	importMedia: boolean;
	mediaFolder: string;
	/** Vault folder where deck notes are created (default: "Anki Import") */
	importFolder: string;
	/** User-chosen note type mappings: ankiModelId → mapping config */
	modelMappings?: Map<number, ModelMapping>;
}

export interface ModelMapping {
	/** Target note type ID, or "auto" to auto-create from Anki model */
	noteTypeId: string;
	/** Optional field remapping: ankiFieldName → trFieldName. Fields not in map are dropped. */
	fieldMapping?: Map<string, string>;
}

export interface NoteTypeMapping {
	ankiModelId: number;
	ankiModelName: string;
	ankiFields: string[];
	ankiType: 0 | 1;
	cardCount: number;
	suggestedNoteTypeId: string | null;
	suggestedNoteTypeName: string | null;
}

export interface AnkiImportResult {
	imported: number;
	skipped: number;
	duplicates: number;
	errors: string[];
	noteTypesCreated: number;
	fieldsDropped: number;
}

export interface AnkiExportOptions {
	sourceUids?: string[];
	exportMode?: "all" | "notes";
	includeScheduling: boolean;
	includeMedia: boolean;
}

export interface ConvertedCard {
	ankiCardId: number;
	ankiNoteId: number;
	ankiModelId: number;
	question: string;
	answer: string;
	cardType: "basic" | "cloze" | "reversed";
	clozeTemplate?: string;
	clozeIndex?: number;
	reverseOfAnkiCardId?: number;
	tags: string[];
	deckName: string;
	mediaFiles: string[];
	fieldValues: Record<string, string>;
	templateOrd: number;
}
