import type { App } from "obsidian";
import { render } from "preact";
import { useCallback, useRef, useState } from "preact/hooks";
import type { FrontmatterIndexService } from "../../services/core/frontmatter-index.service";
import {
	CsvExportService,
	type CsvSeparator,
} from "../../services/export/csv-export.service";
import type { SqliteStoreService } from "../../services/persistence/sqlite/SqliteStoreService";
import { BaseModal } from "./BaseModal";

interface NoteEntry {
	uid: string;
	name: string;
}

type ExportPhase =
	| { type: "form" }
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

function CsvExportBody({
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
		separator: CsvSeparator;
	}) => Promise<ExportPhase>;
	onClose: () => void;
}) {
	const [phase, setPhase] = useState<ExportPhase>({ type: "form" });
	const [exportMode, setExportMode] = useState<"all" | "projects" | "notes">(
		"all",
	);
	const [separator, setSeparator] = useState<CsvSeparator>(",");
	const [includeScheduling, setIncludeScheduling] = useState(false);
	const selectedProjects = useRef(new Set<string>());
	const selectedSourceUids = useRef(new Set<string>());

	const handleToggleProject = useCallback(
		(key: string, checked: boolean) => {
			if (checked) selectedProjects.current.add(key);
			else selectedProjects.current.delete(key);
		},
		[],
	);

	const handleToggleNote = useCallback(
		(key: string, checked: boolean) => {
			if (checked) selectedSourceUids.current.add(key);
			else selectedSourceUids.current.delete(key);
		},
		[],
	);

	const handleExport = useCallback(async () => {
		const result = await onExport({
			exportMode,
			selectedProjects: selectedProjects.current,
			selectedSourceUids: selectedSourceUids.current,
			includeScheduling,
			separator,
		});
		setPhase(result);
	}, [exportMode, includeScheduling, separator, onExport]);

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

	const separators: { label: string; value: CsvSeparator }[] = [
		{ label: "Comma (,)", value: "," },
		{ label: "Tab", value: "\t" },
		{ label: "Semicolon (;)", value: ";" },
	];

	return (
		<>
			{/* Scope selection */}
			<div class="ep:mb-4">
				<div class="ep:text-ui-small ep:font-medium ep:mb-2">Scope</div>

				<div class="ep:flex ep:items-center ep:gap-2 ep:py-1">
					<input
						id="csv-scope-all"
						type="radio"
						name="csv-scope"
						class="ep:w-4 ep:h-4 ep:accent-obs-interactive"
						checked={exportMode === "all"}
						onChange={() => setExportMode("all")}
					/>
					<label htmlFor="csv-scope-all" class="ep:text-ui-small">
						All cards ({totalCards})
					</label>
				</div>
				<div class="ep:flex ep:items-center ep:gap-2 ep:py-1">
					<input
						id="csv-scope-projects"
						type="radio"
						name="csv-scope"
						class="ep:w-4 ep:h-4 ep:accent-obs-interactive"
						checked={exportMode === "projects"}
						onChange={() => setExportMode("projects")}
					/>
					<label htmlFor="csv-scope-projects" class="ep:text-ui-small">
						Selected projects only
					</label>
				</div>
				<div class="ep:flex ep:items-center ep:gap-2 ep:py-1">
					<input
						id="csv-scope-notes"
						type="radio"
						name="csv-scope"
						class="ep:w-4 ep:h-4 ep:accent-obs-interactive"
						checked={exportMode === "notes"}
						onChange={() => setExportMode("notes")}
					/>
					<label htmlFor="csv-scope-notes" class="ep:text-ui-small">
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
								selectedSet={selectedProjects.current}
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
								selectedSet={selectedSourceUids.current}
								onToggle={handleToggleNote}
							/>
						))}
					</div>
				)}
			</div>

			{/* Separator selection */}
			<div class="ep:mb-4">
				<div class="ep:text-ui-small ep:font-medium ep:mb-2">Separator</div>
				{separators.map((sep) => {
					const sepId = `csv-sep-${sep.label.replace(/[^a-zA-Z]/g, "")}`;
					return (
						<div
							key={sep.value}
							class="ep:flex ep:items-center ep:gap-2 ep:py-1"
						>
							<input
								id={sepId}
								type="radio"
								name="csv-separator"
								class="ep:w-4 ep:h-4 ep:accent-obs-interactive"
								checked={separator === sep.value}
								onChange={() => setSeparator(sep.value)}
							/>
							<label htmlFor={sepId} class="ep:text-ui-small">
								{sep.label}
							</label>
						</div>
					);
				})}
			</div>

			{/* Options */}
			<div class="ep:mb-4">
				<div class="ep:text-ui-small ep:font-medium ep:mb-2">Options</div>
				<OptionCheckbox
					label="Include scheduling data"
					description="Adds State, Due, Interval, Lapses columns"
					initialChecked={includeScheduling}
					onChange={setIncludeScheduling}
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

export class CsvExportModal extends BaseModal {
	private store: SqliteStoreService;
	private frontmatterIndex: FrontmatterIndexService;
	private allProjects: string[] = [];
	private allNotes: NoteEntry[] = [];
	private unmountBody?: () => void;

	constructor(
		app: App,
		store: SqliteStoreService,
		frontmatterIndex: FrontmatterIndexService,
	) {
		super(app, { title: "Export as CSV", width: "520px" });
		this.store = store;
		this.frontmatterIndex = frontmatterIndex;
		this.allProjects = this.resolveProjects();
		this.allNotes = this.resolveNotes();
	}

	protected renderBody(container: HTMLElement): void {
		const totalCards = this.store.size();
		this.updateTitle(`Export as CSV (${totalCards} cards)`);

		render(
			<CsvExportBody
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
		separator: CsvSeparator;
	}): Promise<ExportPhase> {
		try {
			const service = new CsvExportService(this.app, this.store);

			const { content, filename } = service.export({
				projects:
					opts.exportMode === "projects"
						? [...opts.selectedProjects]
						: undefined,
				sourceUids:
					opts.exportMode === "notes"
						? [...opts.selectedSourceUids]
						: undefined,
				includeScheduling: opts.includeScheduling,
				separator: opts.separator,
			});

			this.downloadFile(content, filename);
			return { type: "success", filename };
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			return { type: "error", message: errMsg };
		}
	}

	private downloadFile(content: string, filename: string): void {
		const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
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
