import { AnkiConverterService } from "@true-recall/core/integration/anki/anki-converter.service";
import { AnkiImportService } from "@true-recall/core/integration/anki/anki-import.service";
import { AnkiNoteTypeMapper } from "@true-recall/core/integration/anki/anki-note-type-mapper";
import { ApkgParserService } from "@true-recall/core/integration/anki/apkg/apkg-parser.service";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type {
	ApkgData,
	ConvertedCard,
	NoteTypeMapping,
} from "@true-recall/core/types";
import type { NoteType } from "@true-recall/core/types/note.types";
import { ObsidianAnkiImportVault } from "@true-recall/obsidian/adapters/ObsidianAnkiImportVault";
import { ObsidianPersistence } from "@true-recall/obsidian/adapters/ObsidianPersistence";
import { ObsidianVaultFileReader } from "@true-recall/obsidian/adapters/ObsidianVaultFileReader";
import { mutate } from "@true-recall/obsidian/data";
import {
	ErrorPhase,
	FileSelectPhase,
	type ImportPhase,
	type ImportPreview,
	MappingPhase,
	PreviewPhase,
	ProgressPhase,
	ResultPhase,
} from "@true-recall/obsidian/modals/integration/anki-import";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import type { App } from "obsidian";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";

function AnkiImportBody({
	onFileSelected,
	onShowMapping,
	onImport,
	onClose,
	onUpdateTitle,
	existingNoteTypes,
}: {
	onFileSelected: (file: File) => Promise<ImportPhase>;
	onShowMapping: (preview: ImportPreview) => ImportPhase;
	onImport: (opts: {
		importScheduling: boolean;
		importMedia: boolean;
		modelMappings: Map<number, string>;
	}) => Promise<ImportPhase>;
	onClose: () => void;
	onUpdateTitle: (title: string) => void;
	existingNoteTypes: NoteType[];
}) {
	const [phase, setPhase] = useState<ImportPhase>({ type: "file-select" });
	const [importScheduling, setImportScheduling] = useState(true);
	const [importMedia, setImportMedia] = useState(true);

	const handleFile = useCallback(
		async (file: File) => {
			setPhase({ type: "parsing" });
			const result = await onFileSelected(file);
			setPhase(result);
			if (result.type === "preview") {
				onUpdateTitle(`Import Anki deck (${result.preview.totalCards} cards)`);
			}
		},
		[onFileSelected, onUpdateTitle],
	);

	const handleContinueToMapping = useCallback(
		(preview: ImportPreview) => {
			const mappingPhase = onShowMapping(preview);
			setPhase(mappingPhase);
		},
		[onShowMapping],
	);

	const handleImport = useCallback(
		async (modelMappings: Map<number, string>) => {
			setPhase({ type: "importing" });
			const result = await onImport({
				importScheduling,
				importMedia,
				modelMappings,
			});
			setPhase(result);
			if (result.type === "result") {
				onUpdateTitle("Import complete");
			}
		},
		[onImport, importScheduling, importMedia, onUpdateTitle],
	);

	switch (phase.type) {
		case "parsing":
		case "importing":
			return <ProgressPhase type={phase.type} />;

		case "error":
			return (
				<ErrorPhase
					message={phase.message}
					canRetry={phase.canRetry}
					onRetry={() => setPhase({ type: "file-select" })}
					onClose={onClose}
				/>
			);

		case "result":
			return <ResultPhase result={phase.result} onClose={onClose} />;

		case "preview":
			return (
				<PreviewPhase
					preview={phase.preview}
					importScheduling={importScheduling}
					importMedia={importMedia}
					onSchedulingChange={setImportScheduling}
					onMediaChange={setImportMedia}
					onContinue={() => handleContinueToMapping(phase.preview)}
					onCancel={onClose}
				/>
			);

		case "mapping":
			return (
				<MappingPhase
					suggestions={phase.suggestions}
					existingNoteTypes={existingNoteTypes}
					onImport={(mappings) => void handleImport(mappings)}
					onCancel={onClose}
				/>
			);

		case "file-select":
			return <FileSelectPhase onFile={(file) => void handleFile(file)} />;
	}
}

export class AnkiImportModal extends BaseModal {
	private store: SqliteStoreService;
	private fsrsService: FSRSService;
	private fileData: ArrayBuffer | null = null;
	private apkgData: ApkgData | null = null;
	private deckNames: string[] = [];
	private mappingSuggestions: NoteTypeMapping[] = [];

	constructor(app: App, store: SqliteStoreService, fsrsService: FSRSService) {
		super(app, { title: "Import Anki deck", width: "520px" });
		this.store = store;
		this.fsrsService = fsrsService;
	}

	protected renderBody(container: HTMLElement): void {
		const existingNoteTypes = this.store.noteTypes.getAll();

		render(
			<AnkiImportBody
				onFileSelected={(file) => this.handleFileSelected(file)}
				onShowMapping={(preview) => this.buildMappingPhase(preview)}
				onImport={(opts) => this.startImport(opts)}
				onClose={() => this.close()}
				onUpdateTitle={(title) => this.updateTitle(title)}
				existingNoteTypes={existingNoteTypes}
			/>,
			container,
		);
	}

	private async handleFileSelected(file: File): Promise<ImportPhase> {
		try {
			this.fileData = await file.arrayBuffer();

			const parser = new ApkgParserService();
			this.apkgData = await parser.parseApkg(this.fileData);

			const converter = new AnkiConverterService();
			const convertedCards = converter.convert(this.apkgData);

			this.deckNames = this.getDecksWithCards(convertedCards);

			// Pre-compute note type mapping suggestions
			const mapper = new AnkiNoteTypeMapper(this.store.noteTypes);
			const cardCountByModel = this.countCardsByModel(convertedCards);
			this.mappingSuggestions = mapper.suggestMappings(
				this.apkgData.models,
				cardCountByModel,
			);

			const preview: ImportPreview = {
				totalCards: convertedCards.length,
				basicCards: convertedCards.filter((c) => c.cardType === "basic").length,
				clozeCards: convertedCards.filter((c) => c.cardType === "cloze").length,
				reversedCards: convertedCards.filter((c) => c.cardType === "reversed")
					.length,
				decks: this.deckNames,
				mediaCount: Object.keys(this.apkgData.mediaMap).length,
			};

			return { type: "preview", preview };
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			return { type: "error", message: errMsg, canRetry: true };
		}
	}

	private buildMappingPhase(preview: ImportPreview): ImportPhase {
		return {
			type: "mapping",
			suggestions: this.mappingSuggestions,
			preview,
		};
	}

	private async startImport(opts: {
		importScheduling: boolean;
		importMedia: boolean;
		modelMappings: Map<number, string>;
	}): Promise<ImportPhase> {
		if (!this.fileData) {
			return { type: "error", message: "No file data", canRetry: true };
		}

		try {
			const importService = new AnkiImportService(
				this.store,
				this.fsrsService,
				new ObsidianPersistence(this.app),
				new ObsidianAnkiImportVault(this.app),
				new ObsidianVaultFileReader(this.app),
				() => mutate("cards:imported", () => {}),
			);

			const topDeck = (
				(this.deckNames[0] ?? "anki-import").split("/").at(0) ?? "anki-import"
			)
				.replace(/[\\/:*?"<>|]/g, "-")
				.trim();
			const mediaFolder = `Attachments/anki-import/${topDeck}`;

			const result = await importService.importApkg(this.fileData, {
				importScheduling: opts.importScheduling,
				importMedia: opts.importMedia,
				mediaFolder,
				modelMappings: opts.modelMappings,
			});

			if (result.imported > 0) {
				setTimeout(() => mutate("hierarchy:changed", () => {}), 2000);
			}

			return { type: "result", result };
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			return { type: "error", message: errMsg, canRetry: false };
		}
	}

	private getDecksWithCards(convertedCards: ConvertedCard[]): string[] {
		const names = new Set<string>();
		for (const card of convertedCards) {
			if (card.deckName !== "Default") {
				names.add(card.deckName);
			}
		}
		return [...names].sort();
	}

	private countCardsByModel(
		convertedCards: ConvertedCard[],
	): Map<number, number> {
		const counts = new Map<number, number>();
		for (const card of convertedCards) {
			counts.set(card.ankiModelId, (counts.get(card.ankiModelId) ?? 0) + 1);
		}
		return counts;
	}
}
