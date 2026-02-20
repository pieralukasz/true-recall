import type { App } from "obsidian";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";
import type { AnkiExportOptions } from "shared/types";
import { AnkiExportService } from "../services/anki/anki-export.service";
import type { FrontmatterIndexService } from "../../../features/core/services/frontmatter-index.service";
import type { FSRSService } from "../../../features/core/services/fsrs.service";
import type { SqliteStoreService } from "../../../features/core/persistence/sqlite/SqliteStoreService";
import { BaseModal } from "../../../shared/ui/modals/BaseModal";
import {
	resolveProjects,
	resolveNotes,
	downloadBlob,
	type NoteEntry,
} from "../utils/export-helpers";
import {
	ExportingPhase,
	SuccessPhase,
	ErrorPhase,
	FormPhase,
	type ExportFormValues,
} from "./anki-export";

type ExportPhase =
	| { type: "form" }
	| { type: "exporting" }
	| { type: "success"; filename: string }
	| { type: "error"; message: string };

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
					allProjects={allProjects}
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
		this.allProjects = resolveProjects(frontmatterIndex);
		this.allNotes = resolveNotes(app);
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

	private async startExport(opts: ExportFormValues): Promise<ExportPhase> {
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
			downloadBlob(data, filename);
			return { type: "success", filename };
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			return { type: "error", message: errMsg };
		}
	}
}
