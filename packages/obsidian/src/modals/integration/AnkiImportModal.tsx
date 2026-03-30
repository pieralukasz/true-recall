import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { FSRSService } from "@true-recall/core/services/fsrs.service";
import {
	ErrorPhase,
	FileSelectPhase,
	type ImportPhase,
	type ImportPreview,
	PreviewPhase,
	ProgressPhase,
	ResultPhase,
} from "@true-recall/obsidian/modals/integration/anki-import";
import { AnkiConverterService } from "@true-recall/core/integration/anki-converter.service";
import { AnkiImportService } from "@true-recall/obsidian/features/integration/services/anki/anki-import.service";
import { ApkgParserService } from "@true-recall/obsidian/features/integration/services/anki/apkg-parser.service";
import type { ApkgData } from "@true-recall/core/types";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import type { App } from "obsidian";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";

function AnkiImportBody({
	onFileSelected,
	onImport,
	onClose,
	onUpdateTitle,
}: {
	onFileSelected: (file: File) => Promise<ImportPhase>;
	onImport: (opts: {
		importScheduling: boolean;
		importMedia: boolean;
		createProject: boolean;
	}) => Promise<ImportPhase>;
	onClose: () => void;
	onUpdateTitle: (title: string) => void;
}) {
	const [phase, setPhase] = useState<ImportPhase>({ type: "file-select" });
	const [importScheduling, setImportScheduling] = useState(true);
	const [importMedia, setImportMedia] = useState(true);
	const [createProject, setCreateProject] = useState(true);

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

	const handleImport = useCallback(async () => {
		setPhase({ type: "importing" });
		const result = await onImport({
			importScheduling,
			importMedia,
			createProject,
		});
		setPhase(result);
		if (result.type === "result") {
			onUpdateTitle("Import complete");
		}
	}, [onImport, importScheduling, importMedia, createProject, onUpdateTitle]);

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
					createProject={createProject}
					onSchedulingChange={setImportScheduling}
					onMediaChange={setImportMedia}
					onCreateProjectChange={setCreateProject}
					onImport={() => void handleImport()}
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
	private deckNames: string[] = [];

	constructor(app: App, store: SqliteStoreService, fsrsService: FSRSService) {
		super(app, { title: "Import Anki deck", width: "520px" });
		this.store = store;
		this.fsrsService = fsrsService;
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<AnkiImportBody
				onFileSelected={(file) => this.handleFileSelected(file)}
				onImport={(opts) => this.startImport(opts)}
				onClose={() => this.close()}
				onUpdateTitle={(title) => this.updateTitle(title)}
			/>,
			container,
		);
	}

	private async handleFileSelected(file: File): Promise<ImportPhase> {
		try {
			this.fileData = await file.arrayBuffer();

			const parser = new ApkgParserService(this.app);
			const apkgData = await parser.parseApkg(this.fileData);

			const converter = new AnkiConverterService();
			const convertedCards = converter.convert(apkgData);

			this.deckNames = this.getUniqueDecks(apkgData);

			const preview: ImportPreview = {
				totalCards: convertedCards.length,
				basicCards: convertedCards.filter((c) => c.cardType === "basic").length,
				clozeCards: convertedCards.filter((c) => c.cardType === "cloze").length,
				reversedCards: convertedCards.filter((c) => c.cardType === "reversed")
					.length,
				decks: this.deckNames,
				mediaCount: Object.keys(apkgData.mediaMap).length,
			};

			return { type: "preview", preview };
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			return { type: "error", message: errMsg, canRetry: true };
		}
	}

	private async startImport(opts: {
		importScheduling: boolean;
		importMedia: boolean;
		createProject: boolean;
	}): Promise<ImportPhase> {
		if (!this.fileData) {
			return { type: "error", message: "No file data", canRetry: true };
		}

		try {
			const importService = new AnkiImportService(
				this.app,
				this.store,
				this.fsrsService,
			);

			const topDeck = (this.deckNames[0] ?? "anki-import")
				.split("/")[0]!
				.replace(/[\\/:*?"<>|]/g, "-")
				.trim();
			const mediaFolder = `Attachments/anki-import/${topDeck}`;

			const result = await importService.importApkg(this.fileData, {
				importScheduling: opts.importScheduling,
				importMedia: opts.importMedia,
				mediaFolder,
				createProject: opts.createProject,
			});

			return { type: "result", result };
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			return { type: "error", message: errMsg, canRetry: false };
		}
	}

	private getUniqueDecks(data: ApkgData): string[] {
		const names = new Set<string>();
		for (const [, deck] of data.decks) {
			if (deck.name !== "Default") {
				names.add(deck.name.replace(/::/g, "/"));
			}
		}
		return [...names].sort();
	}
}
