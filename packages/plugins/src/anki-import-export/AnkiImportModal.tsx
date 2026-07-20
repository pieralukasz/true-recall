import type { App } from "obsidian";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";

import {
	hasAIKey,
	resolveAIClientConfig,
} from "@true-recall/core/ai/config/ai-client-config";
import { normalizeDeckName } from "@true-recall/core/integration/anki/anki-converter.service";
import { AnkiImportService } from "@true-recall/core/integration/anki/anki-import.service";
import { AnkiNoteTypeMapper } from "@true-recall/core/integration/anki/anki-note-type-mapper";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type {
	ApkgData,
	ConvertedCard,
	ModelMapping,
	NoteTypeMapping,
} from "@true-recall/core/types";
import type { NoteType } from "@true-recall/core/types/note.types";
import type { TrueRecallSettings } from "@true-recall/core/types/settings.types";

import { ObsidianAnkiImportVault } from "@true-recall/obsidian/adapters/ObsidianAnkiImportVault";
import { ObsidianHttpClient } from "@true-recall/obsidian/adapters/ObsidianHttpClient";
import { ObsidianPersistence } from "@true-recall/obsidian/adapters/ObsidianPersistence";
import { ObsidianVaultFileReader } from "@true-recall/obsidian/adapters/ObsidianVaultFileReader";
import { mutate } from "@true-recall/obsidian/data";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";

import {
	ErrorPhase,
	FileSelectPhase,
	type ImportPhase,
	type ImportPreview,
	MappingPhase,
	PreviewPhase,
	ProgressPhase,
	ResultPhase,
	resolveAnkiMediaFolder,
} from "./anki-import";
import {
	AnkiImportAIService,
	shouldClassifyDecks,
} from "./services/anki-import-ai.service";

const DEFAULT_IMPORT_FOLDER = "Anki Import";

function AnkiImportBody({
	app,
	initialImportFolder,
	attachmentFolderOverride,
	onFileSelected,
	onShowMapping,
	onImport,
	onClose,
	onUpdateTitle,
	existingNoteTypes,
	aiKeyAvailable,
}: {
	app: App;
	initialImportFolder: string;
	attachmentFolderOverride: string;
	onFileSelected: (file: File) => Promise<ImportPhase>;
	onShowMapping: (preview: ImportPreview) => ImportPhase;
	onImport: (opts: {
		importScheduling: boolean;
		importMedia: boolean;
		useAI: boolean;
		importFolder: string;
		modelMappings: Map<number, ModelMapping>;
		setPhase: (phase: ImportPhase) => void;
	}) => Promise<ImportPhase>;
	onClose: () => void;
	onUpdateTitle: (title: string) => void;
	existingNoteTypes: NoteType[];
	aiKeyAvailable: boolean;
}) {
	const [phase, setPhase] = useState<ImportPhase>({ type: "file-select" });
	const [importScheduling, setImportScheduling] = useState(true);
	const [importMedia, setImportMedia] = useState(true);
	const [useAI, setUseAI] = useState(false);
	const [importFolder, setImportFolder] = useState(initialImportFolder);

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
		async (modelMappings: Map<number, ModelMapping>) => {
			setPhase({ type: "importing" });
			const result = await onImport({
				importScheduling,
				importMedia,
				useAI,
				importFolder,
				modelMappings,
				setPhase,
			});
			setPhase(result);
			if (result.type === "result") {
				onUpdateTitle("Import complete");
			}
		},
		[
			onImport,
			importScheduling,
			importMedia,
			useAI,
			importFolder,
			onUpdateTitle,
		],
	);

	switch (phase.type) {
		case "parsing":
		case "importing":
			return <ProgressPhase type={phase.type} />;

		case "ai-classifying":
		case "ai-cleaning":
			return <ProgressPhase type={phase.type} progress={phase.progress} />;

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
					app={app}
					preview={phase.preview}
					importScheduling={importScheduling}
					importMedia={importMedia}
					useAI={useAI}
					hasAIKey={aiKeyAvailable}
					importFolder={importFolder}
					attachmentFolderOverride={attachmentFolderOverride}
					onSchedulingChange={setImportScheduling}
					onMediaChange={setImportMedia}
					onUseAIChange={setUseAI}
					onImportFolderChange={setImportFolder}
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
	private getSettings: () => TrueRecallSettings;
	private apkgData: ApkgData | null = null;
	private convertedCards: ConvertedCard[] = [];
	private deckNames: string[] = [];
	private mappingSuggestions: NoteTypeMapping[] = [];

	constructor(
		app: App,
		store: SqliteStoreService,
		fsrsService: FSRSService,
		getSettings?: () => TrueRecallSettings,
	) {
		super(app, { title: "Import Anki deck", width: "520px" });
		this.store = store;
		this.fsrsService = fsrsService;
		this.getSettings = getSettings ?? (() => ({}) as TrueRecallSettings);
	}

	protected renderBody(container: HTMLElement): void {
		const existingNoteTypes = this.store.noteTypes.getAll();
		const settings = this.getSettings();
		const aiKeyAvailable = hasAIKey(settings);

		render(
			<AnkiImportBody
				app={this.app}
				initialImportFolder={
					settings.defaultAnkiImportFolder || DEFAULT_IMPORT_FOLDER
				}
				attachmentFolderOverride={settings.attachmentFolder}
				onFileSelected={(file) => this.handleFileSelected(file)}
				onShowMapping={(preview) => this.buildMappingPhase(preview)}
				onImport={(opts) => this.startImport(opts)}
				onClose={() => this.close()}
				onUpdateTitle={(title) => this.updateTitle(title)}
				existingNoteTypes={existingNoteTypes}
				aiKeyAvailable={aiKeyAvailable}
			/>,
			container,
		);
	}

	private async handleFileSelected(file: File): Promise<ImportPhase> {
		try {
			const fileData = await file.arrayBuffer();

			const { apkgData, convertedCards } =
				await AnkiImportService.parseAndConvert(fileData);
			this.apkgData = apkgData;
			this.convertedCards = convertedCards;

			this.deckNames = this.getDecksWithCards(convertedCards);

			const mapper = new AnkiNoteTypeMapper(this.store.noteTypes);
			const cardCountByModel = this.countCardsByModel(convertedCards);
			this.mappingSuggestions = mapper.suggestMappings(
				apkgData.models,
				cardCountByModel,
			);

			let basicCards = 0;
			let clozeCards = 0;
			let reversedCards = 0;
			for (const c of convertedCards) {
				if (c.cardType === "basic") basicCards++;
				else if (c.cardType === "cloze") clozeCards++;
				else if (c.cardType === "reversed") reversedCards++;
			}

			const preview: ImportPreview = {
				totalCards: convertedCards.length,
				basicCards,
				clozeCards,
				reversedCards,
				decks: this.deckNames,
				mediaCount: Object.keys(apkgData.mediaMap).length,
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
		useAI: boolean;
		importFolder: string;
		modelMappings: Map<number, ModelMapping>;
		setPhase: (phase: ImportPhase) => void;
	}): Promise<ImportPhase> {
		if (!this.apkgData || this.convertedCards.length === 0) {
			return { type: "error", message: "No file data", canRetry: true };
		}

		try {
			// Run AI enhancement before import
			if (opts.useAI) {
				await this.runAIEnhancement(
					this.convertedCards,
					this.apkgData,
					opts.setPhase,
				);
			}

			opts.setPhase({ type: "importing" });

			const importService = new AnkiImportService(
				this.store,
				this.fsrsService,
				new ObsidianPersistence(this.app),
				new ObsidianAnkiImportVault(this.app),
				new ObsidianVaultFileReader(this.app),
				() => mutate("cards:imported", () => {}),
			);

			const mediaFolder = resolveAnkiMediaFolder(
				this.getSettings().attachmentFolder,
				opts.importFolder,
				this.deckNames,
			);

			const result = await importService.importCards(
				this.apkgData,
				this.convertedCards,
				{
					importScheduling: opts.importScheduling,
					importMedia: opts.importMedia,
					importFolder: opts.importFolder,
					mediaFolder,
					modelMappings: opts.modelMappings,
				},
			);

			if (result.imported > 0) {
				window.setTimeout(() => mutate("hierarchy:changed", () => {}), 2000);
			}

			return { type: "result", result };
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			return { type: "error", message: errMsg, canRetry: false };
		}
	}

	private async runAIEnhancement(
		cards: ConvertedCard[],
		apkgData: ApkgData,
		setPhase: (phase: ImportPhase) => void,
	): Promise<void> {
		const settings = this.getSettings();
		if (!hasAIKey(settings)) return;

		const config = resolveAIClientConfig(settings);
		const httpClient = new ObsidianHttpClient();
		const aiService = new AnkiImportAIService(config, httpClient);

		// 1. Deck classification
		const allDeckNames = [...apkgData.decks.values()]
			.map((d) => normalizeDeckName(d.name))
			.filter((n) => n !== "Default");

		if (shouldClassifyDecks(cards, allDeckNames.length)) {
			setPhase({ type: "ai-classifying" });

			const cardSummaries = cards.map((c) => ({
				id: c.ankiNoteId,
				question: c.question,
			}));

			const deckMap = await aiService.classifyDecks(
				allDeckNames,
				cardSummaries,
				(done, total) => {
					setPhase({
						type: "ai-classifying",
						progress: `Batch ${done}/${total}`,
					});
				},
			);

			// Apply AI deck assignments
			for (const card of cards) {
				const newDeck = deckMap.get(card.ankiNoteId);
				if (newDeck) {
					card.deckName = newDeck;
				}
			}
		}

		// 2. Content cleanup
		setPhase({ type: "ai-cleaning" });

		const cardFields = cards.map((c) => ({
			id: c.ankiNoteId,
			fields: c.fieldValues,
		}));

		const cleanedMap = await aiService.cleanupContent(
			cardFields,
			(done, total) => {
				setPhase({
					type: "ai-cleaning",
					progress: `Batch ${done}/${total}`,
				});
			},
		);

		// Apply cleaned content
		for (const card of cards) {
			const cleaned = cleanedMap.get(card.ankiNoteId);
			if (cleaned) {
				card.fieldValues = cleaned;
			}
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
