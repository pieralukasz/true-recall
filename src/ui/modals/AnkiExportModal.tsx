import type { App } from "obsidian";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";
import type { AnkiExportOptions } from "types";
import { AnkiExportService } from "../../services/anki/anki-export.service";
import type { FrontmatterIndexService } from "../../services/core/frontmatter-index.service";
import type { FSRSService } from "../../services/core/fsrs.service";
import type { SqliteStoreService } from "../../services/persistence/sqlite/SqliteStoreService";
import { BaseModal } from "./BaseModal";

interface NoteEntry {
	uid: string;
	name: string;
}

type ExportPhase =
	| { type: "form" }
	| { type: "exporting" }
	| { type: "success"; filename: string }
	| { type: "error"; message: string };

function CheckboxItem({
	label,
	itemKey,
	selectedSet,
	onToggle,
}: {
	label: string;
	itemKey: string;
	selectedSet: Set<string>;
	onToggle: (key: string, checked: boolean) => void;
}) {
	const [checked, setChecked] = useState(selectedSet.has(itemKey));

	const toggle = useCallback(() => {
		const next = !checked;
		setChecked(next);
		onToggle(itemKey, next);
	}, [checked, itemKey, onToggle]);

	return (
		<div
			class="ep:flex ep:items-center ep:gap-2 ep:p-2 ep:border-b ep:border-obs-border ep:last:border-b-0 ep:cursor-pointer ep:hover:bg-obs-modifier-hover"
			role="option"
			tabIndex={0}
			aria-selected={checked}
			onClick={toggle}
			onKeyDown={(e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					toggle();
				}
			}}
		>
			<input
				type="checkbox"
				class="ep:w-4 ep:h-4 ep:accent-obs-interactive"
				checked={checked}
				onClick={(e) => e.stopPropagation()}
				onChange={toggle}
			/>
			<span class="ep:text-ui-small">{label}</span>
		</div>
	);
}

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

const PRIMARY_BTN =
	"mod-cta ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all";
const SECONDARY_BTN =
	"ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:hover:bg-obs-modifier-hover";

function AnkiExportBody({
	totalCards,
	allProjects,
	allNotes,
	onExport,
	onClose,
}: {
	totalCards: number;
	allProjects: string[];
	allNotes: NoteEntry[];
	onExport: (opts: {
		exportMode: "all" | "projects" | "notes";
		selectedProjects: Set<string>;
		selectedSourceUids: Set<string>;
		includeScheduling: boolean;
		includeMedia: boolean;
	}) => Promise<ExportPhase>;
	onClose: () => void;
}) {
	const [phase, setPhase] = useState<ExportPhase>({ type: "form" });
	const [exportMode, setExportMode] = useState<"all" | "projects" | "notes">(
		"all",
	);
	const [includeScheduling, setIncludeScheduling] = useState(true);
	const [includeMedia, setIncludeMedia] = useState(true);
	const [selectedProjects] = useState(() => new Set<string>());
	const [selectedSourceUids] = useState(() => new Set<string>());

	const handleToggleProject = useCallback(
		(key: string, checked: boolean) => {
			if (checked) selectedProjects.add(key);
			else selectedProjects.delete(key);
		},
		[selectedProjects],
	);

	const handleToggleNote = useCallback(
		(key: string, checked: boolean) => {
			if (checked) selectedSourceUids.add(key);
			else selectedSourceUids.delete(key);
		},
		[selectedSourceUids],
	);

	const handleExport = useCallback(async () => {
		setPhase({ type: "exporting" });
		const result = await onExport({
			exportMode,
			selectedProjects,
			selectedSourceUids,
			includeScheduling,
			includeMedia,
		});
		setPhase(result);
	}, [
		exportMode,
		selectedProjects,
		selectedSourceUids,
		includeScheduling,
		includeMedia,
		onExport,
	]);

	if (phase.type === "exporting") {
		return (
			<div class="ep:text-center ep:py-6">
				<div class="ep:text-ui-small ep:font-medium ep:mb-2">
					Building .apkg file...
				</div>
				<div class="ep:text-ui-smaller ep:text-obs-muted">
					This may take a moment for large collections
				</div>
			</div>
		);
	}

	if (phase.type === "success") {
		return (
			<>
				<div class="ep:text-center ep:py-6">
					<div class="ep:text-ui-small ep:font-medium ep:text-green-500">
						Exported as {phase.filename}
					</div>
				</div>
				<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border">
					<button type="button" class={PRIMARY_BTN} onClick={onClose}>
						Done
					</button>
				</div>
			</>
		);
	}

	if (phase.type === "error") {
		return (
			<>
				<div class="ep:text-ui-small ep:text-red-500 ep:py-4 ep:text-center">
					Export failed: {phase.message}
				</div>
				<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border">
					<button type="button" class={SECONDARY_BTN} onClick={onClose}>
						Close
					</button>
				</div>
			</>
		);
	}

	return (
		<>
			{/* Scope selection */}
			<div class="ep:mb-4">
				<div class="ep:text-ui-small ep:font-medium ep:mb-2">Scope</div>

				<div class="ep:flex ep:items-center ep:gap-2 ep:py-1">
					<input
						id="export-scope-all"
						type="radio"
						name="export-scope"
						class="ep:w-4 ep:h-4 ep:accent-obs-interactive"
						checked={exportMode === "all"}
						onChange={() => setExportMode("all")}
					/>
					<label htmlFor="export-scope-all" class="ep:text-ui-small">
						All cards ({totalCards})
					</label>
				</div>
				<div class="ep:flex ep:items-center ep:gap-2 ep:py-1">
					<input
						id="export-scope-projects"
						type="radio"
						name="export-scope"
						class="ep:w-4 ep:h-4 ep:accent-obs-interactive"
						checked={exportMode === "projects"}
						onChange={() => setExportMode("projects")}
					/>
					<label htmlFor="export-scope-projects" class="ep:text-ui-small">
						Selected projects only
					</label>
				</div>
				<div class="ep:flex ep:items-center ep:gap-2 ep:py-1">
					<input
						id="export-scope-notes"
						type="radio"
						name="export-scope"
						class="ep:w-4 ep:h-4 ep:accent-obs-interactive"
						checked={exportMode === "notes"}
						onChange={() => setExportMode("notes")}
					/>
					<label htmlFor="export-scope-notes" class="ep:text-ui-small">
						Selected notes only
					</label>
				</div>

				{allProjects.length > 0 && exportMode === "projects" && (
					<div class="ep:border ep:border-obs-border ep:rounded-md ep:max-h-[150px] ep:overflow-y-auto ep:mt-2 ep:ml-6">
						{allProjects.map((project) => (
							<CheckboxItem
								key={project}
								label={project}
								itemKey={project}
								selectedSet={selectedProjects}
								onToggle={handleToggleProject}
							/>
						))}
					</div>
				)}

				{allNotes.length > 0 && exportMode === "notes" && (
					<div class="ep:border ep:border-obs-border ep:rounded-md ep:max-h-[150px] ep:overflow-y-auto ep:mt-2 ep:ml-6">
						{allNotes.map((note) => (
							<CheckboxItem
								key={note.uid}
								label={note.name}
								itemKey={note.uid}
								selectedSet={selectedSourceUids}
								onToggle={handleToggleNote}
							/>
						))}
					</div>
				)}
			</div>

			{/* Options */}
			<div class="ep:mb-4">
				<div class="ep:text-ui-small ep:font-medium ep:mb-2">Options</div>
				<OptionCheckbox
					label="Include scheduling data"
					description="Export review history and card progress"
					initialChecked={includeScheduling}
					onChange={setIncludeScheduling}
				/>
				<OptionCheckbox
					label="Include media"
					description="Export images and audio files"
					initialChecked={includeMedia}
					onChange={setIncludeMedia}
				/>
			</div>

			{/* Buttons */}
			<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border">
				<button type="button" class={SECONDARY_BTN} onClick={onClose}>
					Cancel
				</button>
				<button
					type="button"
					class={PRIMARY_BTN}
					onClick={() => void handleExport()}
				>
					Export
				</button>
			</div>
		</>
	);
}

export class AnkiExportModal extends BaseModal {
	private store: SqliteStoreService;
	private fsrsService: FSRSService;
	private frontmatterIndex: FrontmatterIndexService;
	private allProjects: string[] = [];
	private allNotes: NoteEntry[] = [];
	private unmountBody?: () => void;

	constructor(
		app: App,
		store: SqliteStoreService,
		fsrsService: FSRSService,
		frontmatterIndex: FrontmatterIndexService,
	) {
		super(app, { title: "Export to Anki", width: "520px" });
		this.store = store;
		this.fsrsService = fsrsService;
		this.frontmatterIndex = frontmatterIndex;
		this.allProjects = this.resolveProjects();
		this.allNotes = this.resolveNotes();
	}

	protected renderBody(container: HTMLElement): void {
		const totalCards = this.store.size();
		this.updateTitle(`Export to Anki (${totalCards} cards)`);

		render(
			<AnkiExportBody
				totalCards={totalCards}
				allProjects={this.allProjects}
				allNotes={this.allNotes}
				onExport={(opts) => this.startExport(opts)}
				onClose={() => this.close()}
			/>,
			container,
		);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		super.onClose();
	}

	private async startExport(opts: {
		exportMode: "all" | "projects" | "notes";
		selectedProjects: Set<string>;
		selectedSourceUids: Set<string>;
		includeScheduling: boolean;
		includeMedia: boolean;
	}): Promise<ExportPhase> {
		try {
			const exportService = new AnkiExportService(
				this.app,
				this.store,
				this.fsrsService,
			);

			const options: AnkiExportOptions = {
				exportMode: opts.exportMode,
				projects:
					opts.exportMode === "projects"
						? [...opts.selectedProjects]
						: undefined,
				sourceUids:
					opts.exportMode === "notes"
						? [...opts.selectedSourceUids]
						: undefined,
				includeScheduling: opts.includeScheduling,
				includeMedia: opts.includeMedia,
			};

			const { data, filename } = await exportService.exportApkg(options);
			this.downloadFile(data, filename);
			return { type: "success", filename };
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			return { type: "error", message: errMsg };
		}
	}

	private downloadFile(data: ArrayBuffer, filename: string): void {
		const blob = new Blob([data], { type: "application/octet-stream" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	private resolveProjects(): string[] {
		return [...this.frontmatterIndex.getAllValues("projects")].sort();
	}

	private resolveNotes(): NoteEntry[] {
		const notes: NoteEntry[] = [];
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const uid = cache.frontmatter.flashcard_uid as string | undefined;
			if (!uid) continue;

			notes.push({ uid, name: file.basename });
		}

		return notes.sort((a, b) => a.name.localeCompare(b.name));
	}
}
