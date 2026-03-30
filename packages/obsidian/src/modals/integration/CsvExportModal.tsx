import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import {
	type ExportMode,
	ExportScopeSelector,
} from "@true-recall/obsidian/features/integration/components/ExportScopeSelector";
import {
	CsvExportService,
	type CsvSeparator,
} from "@true-recall/obsidian/features/integration/services/csv-export.service";
import {
	downloadBlob,
	type NoteEntry,
	resolveNotes,
} from "@true-recall/obsidian/features/integration/utils/export-helpers";
import { Clickable } from "@true-recall/obsidian/components";
import {
	ModalFooter,
	PRIMARY_BTN,
	SECONDARY_BTN,
} from "@true-recall/obsidian/components/ModalFooter";
import { OptionCheckbox } from "@true-recall/obsidian/components/OptionCheckbox";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import type { App } from "obsidian";
import { render } from "preact";
import { useCallback, useRef, useState } from "preact/hooks";

type ExportPhase =
	| { type: "form" }
	| { type: "success"; filename: string }
	| { type: "error"; message: string };

function CsvExportBody({
	totalCards,
	allNotes,
	onExport,
	onClose,
}: {
	totalCards: number;
	allNotes: NoteEntry[];
	onExport: (opts: {
		exportMode: ExportMode;
		selectedSourceUids: Set<string>;
		includeScheduling: boolean;
		separator: CsvSeparator;
	}) => ExportPhase | Promise<ExportPhase>;
	onClose: () => void;
}) {
	const [phase, setPhase] = useState<ExportPhase>({ type: "form" });
	const [exportMode, setExportMode] = useState<ExportMode>("all");
	const [separator, setSeparator] = useState<CsvSeparator>(",");
	const [includeScheduling, setIncludeScheduling] = useState(false);
	const selectedSourceUids = useRef(new Set<string>());

	const handleToggleNote = useCallback((key: string, checked: boolean) => {
		if (checked) selectedSourceUids.current.add(key);
		else selectedSourceUids.current.delete(key);
	}, []);

	const handleExport = useCallback(async () => {
		const result = await onExport({
			exportMode,
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
				<div class="ep-modal-footer ep:flex ep:justify-end ep:gap-2">
					<Clickable
						stopPropagation={false}
						class={PRIMARY_BTN}
						onClick={onClose}
					>
						Done
					</Clickable>
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
				<div class="ep-modal-footer ep:flex ep:justify-end ep:gap-2">
					<Clickable
						stopPropagation={false}
						class={SECONDARY_BTN}
						onClick={onClose}
					>
						Close
					</Clickable>
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
				allNotes={allNotes}
				selectedSourceUids={selectedSourceUids.current}
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
					checked={includeScheduling}
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
	private allNotes: NoteEntry[] = [];

	constructor(app: App, store: SqliteStoreService) {
		super(app, { title: "Export as CSV", width: "520px" });
		this.store = store;
		this.allNotes = resolveNotes(this.app);
	}

	protected renderBody(container: HTMLElement): void {
		const totalCards = this.store.size();
		this.updateTitle(`Export as CSV (${totalCards} cards)`);

		render(
			<CsvExportBody
				totalCards={totalCards}
				allNotes={this.allNotes}
				onExport={(opts) => this.startExport(opts)}
				onClose={() => this.close()}
			/>,
			container,
		);
	}

	private startExport(opts: {
		exportMode: ExportMode;
		selectedSourceUids: Set<string>;
		includeScheduling: boolean;
		separator: CsvSeparator;
	}): ExportPhase {
		try {
			const service = new CsvExportService(this.app, this.store);

			const { content, filename } = service.export({
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
