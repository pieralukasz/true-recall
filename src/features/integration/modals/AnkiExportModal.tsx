import type { SqliteStoreService } from "@features/core/persistence/sqlite/SqliteStoreService";
import type { FSRSService } from "@features/core/services/fsrs.service";
import {
	ErrorPhase,
	type ExportFormValues,
	ExportingPhase,
	FormPhase,
	SuccessPhase,
} from "@features/integration/modals/anki-export";
import { AnkiExportService } from "@features/integration/services/anki/anki-export.service";
import {
	downloadBlob,
	type NoteEntry,
	resolveNotes,
} from "@features/integration/utils/export-helpers";
import type { AnkiExportOptions } from "@shared/types";
import { BaseModal } from "@shared/ui/modals/BaseModal";
import type { App } from "obsidian";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";

type ExportPhase =
	| { type: "form" }
	| { type: "exporting" }
	| { type: "success"; filename: string }
	| { type: "error"; message: string };

function AnkiExportBody({
	totalCards,
	allNotes,
	onExport,
	onClose,
}: {
	totalCards: number;
	allNotes: NoteEntry[];
	onExport: (opts: ExportFormValues) => Promise<ExportPhase>;
	onClose: () => void;
}) {
	const [phase, setPhase] = useState<ExportPhase>({ type: "form" });

	const handleExport = useCallback(
		async (values: ExportFormValues) => {
			setPhase({ type: "exporting" });
			const result = await onExport(values);
			setPhase(result);
		},
		[onExport],
	);

	switch (phase.type) {
		case "exporting":
			return <ExportingPhase />;
		case "success":
			return <SuccessPhase filename={phase.filename} onClose={onClose} />;
		case "error":
			return <ErrorPhase message={phase.message} onClose={onClose} />;
		case "form":
			return (
				<FormPhase
					totalCards={totalCards}
					allNotes={allNotes}
					onExport={(values) => void handleExport(values)}
					onClose={onClose}
				/>
			);
	}
}

export class AnkiExportModal extends BaseModal {
	private store: SqliteStoreService;
	private fsrsService: FSRSService;
	private allNotes: NoteEntry[] = [];

	constructor(app: App, store: SqliteStoreService, fsrsService: FSRSService) {
		super(app, { title: "Export to Anki", width: "520px" });
		this.store = store;
		this.fsrsService = fsrsService;
		this.allNotes = resolveNotes(app);
	}

	protected renderBody(container: HTMLElement): void {
		const totalCards = this.store.size();
		this.updateTitle(`Export to Anki (${totalCards} cards)`);

		render(
			<AnkiExportBody
				totalCards={totalCards}
				allNotes={this.allNotes}
				onExport={(opts) => this.startExport(opts)}
				onClose={() => this.close()}
			/>,
			container,
		);
	}

	private async startExport(opts: ExportFormValues): Promise<ExportPhase> {
		try {
			const exportService = new AnkiExportService(
				this.app,
				this.store,
				this.fsrsService,
			);

			const options: AnkiExportOptions = {
				exportMode: opts.exportMode,
				sourceUids:
					opts.exportMode === "notes"
						? [...opts.selectedSourceUids]
						: undefined,
				includeScheduling: opts.includeScheduling,
				includeMedia: opts.includeMedia,
			};

			const { data, filename } = await exportService.exportApkg(options);
			downloadBlob(data, filename);
			return { type: "success", filename };
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			return { type: "error", message: errMsg };
		}
	}
}
