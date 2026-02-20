import type { App } from "obsidian";
import { render } from "preact";
import { useCallback, useRef, useState } from "preact/hooks";
import type { FrontmatterIndexService } from "../../../features/core/services/frontmatter-index.service";
import {
	CsvExportService,
	type CsvSeparator,
} from "../services/csv-export.service";
import type { SqliteStoreService } from "../../../features/core/persistence/sqlite/SqliteStoreService";
import { BaseModal } from "../../../shared/ui/modals/BaseModal";
import { OptionCheckbox } from "../../../shared/ui/components/OptionCheckbox";
import {
	ModalFooter,
	PRIMARY_BTN,
	SECONDARY_BTN,
} from "../../../shared/ui/components/ModalFooter";
import {
	ExportScopeSelector,
	type ExportMode,
} from "../components/ExportScopeSelector";
import {
	type NoteEntry,
	resolveProjects,
	resolveNotes,
	downloadBlob,
} from "../utils/export-helpers";

type ExportPhase =
	| { type: "form" }
	| { type: "success"; filename: string }
	| { type: "error"; message: string };

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
		exportMode: ExportMode;
		selectedProjects: Set<string>;
		selectedSourceUids: Set<string>;
		includeScheduling: boolean;
		separator: CsvSeparator;
	}) => Promise<ExportPhase>;
	onClose: () => void;
}) {
	const [phase, setPhase] = useState<ExportPhase>({ type: "form" });
	const [exportMode, setExportMode] = useState<ExportMode>("all");
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
			<ExportScopeSelector
				exportMode={exportMode}
				onModeChange={setExportMode}
				totalCards={totalCards}
				allProjects={allProjects}
				allNotes={allNotes}
				selectedProjects={selectedProjects.current}
				selectedSourceUids={selectedSourceUids.current}
				onToggleProject={handleToggleProject}
				onToggleNote={handleToggleNote}
			/>

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

			<ModalFooter
				onCancel={onClose}
				onConfirm={() => void handleExport()}
				cancelLabel="Cancel"
				confirmLabel="Export"
			/>
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
		this.allProjects = resolveProjects(this.frontmatterIndex);
		this.allNotes = resolveNotes(this.app);
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
		exportMode: ExportMode;
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

			downloadBlob(content, filename, "text/plain;charset=utf-8");
			return { type: "success", filename };
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			return { type: "error", message: errMsg };
		}
	}
}
