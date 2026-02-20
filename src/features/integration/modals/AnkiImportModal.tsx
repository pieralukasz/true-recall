import type { App } from "obsidian";
import { render } from "preact";
import { useCallback, useRef, useState } from "preact/hooks";
import { AnkiConverterService } from "../services/anki/anki-converter.service";
import { AnkiImportService } from "../services/anki/anki-import.service";
import { ApkgParserService } from "../services/anki/apkg-parser.service";
import type { FSRSService } from "../../../features/core/services/fsrs.service";
import type { SqliteStoreService } from "../../../features/core/persistence/sqlite/SqliteStoreService";
import type { AnkiImportResult, ApkgData } from "../../../shared/types";
import { BaseModal } from "../../../shared/ui/modals/BaseModal";

interface ImportPreview {
	totalCards: number;
	basicCards: number;
	clozeCards: number;
	reversedCards: number;
	decks: string[];
	mediaCount: number;
}

type ImportPhase =
	| { type: "file-select" }
	| { type: "parsing" }
	| { type: "preview"; preview: ImportPreview }
	| { type: "importing" }
	| { type: "result"; result: AnkiImportResult }
	| { type: "error"; message: string; canRetry: boolean };

function OptionCheckbox({
	label,
	description,
	initialChecked,
	onChange,
}: {
	label: string;
	description: string;
	initialChecked: boolean;
	onChange: (val: boolean) => void;
}) {
	const [checked, setChecked] = useState(initialChecked);

	return (
		<div class="ep:flex ep:items-start ep:gap-3 ep:py-2">
			<input
				type="checkbox"
				class="ep:w-4 ep:h-4 ep:accent-obs-interactive ep:shrink-0 ep:mt-0.5"
				checked={checked}
				onChange={() => {
					const next = !checked;
					setChecked(next);
					onChange(next);
				}}
			/>
			<div>
				<div class="ep:text-ui-small ep:font-medium">{label}</div>
				<div class="ep:text-ui-smaller ep:text-obs-muted">{description}</div>
			</div>
		</div>
	);
}

function StatBadge({ label, count }: { label: string; count: number }) {
	return (
		<div class="ep:bg-obs-secondary ep:rounded-md ep:p-2 ep:text-center">
			<div class="ep:text-lg ep:font-bold">{count}</div>
			<div class="ep:text-ui-smaller ep:text-obs-muted">{label}</div>
		</div>
	);
}

const PRIMARY_BTN =
	"mod-cta ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all";
const SECONDARY_BTN =
	"ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:hover:bg-obs-modifier-hover";

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
	}) => Promise<ImportPhase>;
	onClose: () => void;
	onUpdateTitle: (title: string) => void;
}) {
	const [phase, setPhase] = useState<ImportPhase>({ type: "file-select" });
	const [importScheduling, setImportScheduling] = useState(true);
	const [importMedia, setImportMedia] = useState(true);
	const [isDragging, setIsDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

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
		const result = await onImport({ importScheduling, importMedia });
		setPhase(result);
		if (result.type === "result") {
			onUpdateTitle("Import complete");
		}
	}, [onImport, importScheduling, importMedia, onUpdateTitle]);

	if (phase.type === "parsing") {
		return <div class="ep:text-center ep:py-6">Parsing deck...</div>;
	}

	if (phase.type === "importing") {
		return (
			<div class="ep:text-center ep:py-6">
				<div class="ep:text-ui-small ep:font-medium ep:mb-2">Importing...</div>
				<div class="ep:text-ui-smaller ep:text-obs-muted">
					This may take a moment for large decks
				</div>
			</div>
		);
	}

	if (phase.type === "error") {
		return (
			<>
				<div class="ep:text-ui-small ep:text-red-500 ep:py-4 ep:text-center">
					{phase.canRetry ? "Failed to parse file: " : "Import failed: "}
					{phase.message}
				</div>
				<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border">
					{phase.canRetry && (
						<button
							type="button"
							class={SECONDARY_BTN}
							onClick={() => setPhase({ type: "file-select" })}
						>
							Try again
						</button>
					)}
					<button type="button" class={SECONDARY_BTN} onClick={onClose}>
						Close
					</button>
				</div>
			</>
		);
	}

	if (phase.type === "result") {
		const { result } = phase;
		return (
			<>
				<div class="ep:mb-4">
					<div class="ep:grid ep:grid-cols-2 ep:gap-2 ep:mb-4">
						<StatBadge label="Imported" count={result.imported} />
						<StatBadge label="Duplicates" count={result.duplicates} />
						<StatBadge label="Skipped" count={result.skipped} />
						<StatBadge label="Errors" count={result.errors.length} />
					</div>

					{result.projects.length > 0 && (
						<div class="ep:mb-3">
							<div class="ep:text-ui-small ep:font-medium ep:mb-1">
								Projects created:
							</div>
							<div class="ep:text-ui-smaller ep:text-obs-muted">
								{result.projects.join(", ")}
							</div>
						</div>
					)}

					{result.errors.length > 0 && (
						<div class="ep:mb-3">
							<div class="ep:text-ui-small ep:font-medium ep:mb-1 ep:text-red-500">
								Errors:
							</div>
							<div class="ep:border ep:border-obs-border ep:rounded-md ep:max-h-[100px] ep:overflow-y-auto ep:p-2">
								{result.errors.slice(0, 20).map((err, i) => (
									<div
										key={i}
										class="ep:text-ui-smaller ep:text-obs-muted ep:py-0.5"
									>
										{err}
									</div>
								))}
								{result.errors.length > 20 && (
									<div class="ep:text-ui-smaller ep:text-obs-muted ep:italic">
										...and {result.errors.length - 20} more
									</div>
								)}
							</div>
						</div>
					)}
				</div>
				<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border">
					<button type="button" class={PRIMARY_BTN} onClick={onClose}>
						Done
					</button>
				</div>
			</>
		);
	}

	if (phase.type === "preview") {
		const { preview } = phase;
		return (
			<>
				<div class="ep:grid ep:grid-cols-2 ep:gap-2 ep:mb-4">
					<StatBadge label="Basic" count={preview.basicCards} />
					<StatBadge label="Cloze" count={preview.clozeCards} />
					<StatBadge label="Reversed" count={preview.reversedCards} />
					<StatBadge label="Media files" count={preview.mediaCount} />
				</div>

				{preview.decks.length > 0 && (
					<div class="ep:mb-4">
						<div class="ep:text-ui-small ep:font-medium ep:mb-2">
							Decks (will become projects):
						</div>
						<div class="ep:border ep:border-obs-border ep:rounded-md ep:max-h-[120px] ep:overflow-y-auto ep:p-2">
							{preview.decks.map((deck) => (
								<div
									key={deck}
									class="ep:text-ui-smaller ep:text-obs-muted ep:py-0.5"
								>
									{deck}
								</div>
							))}
						</div>
					</div>
				)}

				<div class="ep:mb-4">
					<div class="ep:text-ui-small ep:font-medium ep:mb-2">Options</div>
					<OptionCheckbox
						label="Import scheduling data"
						description="Replay review history to preserve your progress"
						initialChecked={importScheduling}
						onChange={setImportScheduling}
					/>
					<OptionCheckbox
						label="Import media files"
						description={`${preview.mediaCount} files will be saved to Attachments/anki-import`}
						initialChecked={importMedia}
						onChange={setImportMedia}
					/>
				</div>

				<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border">
					<button type="button" class={SECONDARY_BTN} onClick={onClose}>
						Cancel
					</button>
					<button
						type="button"
						class={PRIMARY_BTN}
						onClick={() => void handleImport()}
					>
						Import
					</button>
				</div>
			</>
		);
	}

	// file-select phase
	return (
		<>
			<div class="ep:text-ui-small ep:text-obs-muted ep:mb-4">
				Select an .apkg file exported from Anki to import your flashcards.
			</div>

			<button
				type="button"
				class={`ep:border-2 ep:border-dashed ep:rounded-lg ep:p-8 ep:text-center ep:cursor-pointer ep:transition-colors ep:bg-transparent ep:font-inherit ep:w-full ${
					isDragging
						? "ep:border-obs-interactive ep:bg-obs-modifier-hover"
						: "ep:border-obs-border ep:hover:border-obs-interactive ep:hover:bg-obs-modifier-hover"
				}`}
				onClick={() => fileInputRef.current?.click()}
				onDragOver={(e) => {
					e.preventDefault();
					setIsDragging(true);
				}}
				onDragLeave={() => setIsDragging(false)}
				onDrop={(e) => {
					e.preventDefault();
					setIsDragging(false);
					const file = e.dataTransfer?.files[0];
					if (file?.name.endsWith(".apkg")) {
						void handleFile(file);
					}
				}}
			>
				<input
					ref={fileInputRef}
					type="file"
					accept=".apkg"
					style="display: none"
					onChange={(e) => {
						const file = (e.target as HTMLInputElement).files?.[0];
						if (file) void handleFile(file);
					}}
				/>
				<div class="ep:text-ui-small ep:text-obs-muted">
					Click to select .apkg file
				</div>
			</button>
		</>
	);
}

export class AnkiImportModal extends BaseModal {
	private store: SqliteStoreService;
	private fsrsService: FSRSService;
	private fileData: ArrayBuffer | null = null;
	private unmountBody?: () => void;

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
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		super.onClose();
	}

	private async handleFileSelected(file: File): Promise<ImportPhase> {
		try {
			this.fileData = await file.arrayBuffer();

			const parser = new ApkgParserService(this.app);
			const apkgData = await parser.parseApkg(this.fileData);

			const converter = new AnkiConverterService();
			const convertedCards = converter.convert(apkgData);

			const preview: ImportPreview = {
				totalCards: convertedCards.length,
				basicCards: convertedCards.filter((c) => c.cardType === "basic").length,
				clozeCards: convertedCards.filter((c) => c.cardType === "cloze").length,
				reversedCards: convertedCards.filter((c) => c.cardType === "reversed")
					.length,
				decks: this.getUniqueDecks(apkgData),
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

			const result = await importService.importApkg(this.fileData, {
				importScheduling: opts.importScheduling,
				importMedia: opts.importMedia,
				mediaFolder: "Attachments/anki-import",
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
