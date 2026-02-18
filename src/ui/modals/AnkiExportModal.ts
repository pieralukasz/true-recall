import { App } from "obsidian";
import { BaseModal } from "./BaseModal";
import type { SqliteStoreService } from "../../services/persistence/sqlite/SqliteStoreService";
import type { FSRSService } from "../../services/core/fsrs.service";
import type { FrontmatterIndexService } from "../../services/core/frontmatter-index.service";
import { AnkiExportService } from "../../services/anki/anki-export.service";
import type { AnkiExportOptions } from "types";

interface NoteEntry {
	uid: string;
	name: string;
}

export class AnkiExportModal extends BaseModal {
	private store: SqliteStoreService;
	private fsrsService: FSRSService;
	private frontmatterIndex: FrontmatterIndexService;
	private allProjects: string[] = [];
	private allNotes: NoteEntry[] = [];
	private selectedProjects = new Set<string>();
	private selectedSourceUids = new Set<string>();
	private includeScheduling = true;
	private includeMedia = true;
	private exportMode: "all" | "projects" | "notes" = "all";

	private bodyEl: HTMLElement | null = null;
	private projectListEl: HTMLElement | null = null;
	private noteListEl: HTMLElement | null = null;

	constructor(app: App, store: SqliteStoreService, fsrsService: FSRSService, frontmatterIndex: FrontmatterIndexService) {
		super(app, { title: "Export to Anki", width: "520px" });
		this.store = store;
		this.fsrsService = fsrsService;
		this.frontmatterIndex = frontmatterIndex;
		this.allProjects = this.resolveProjects();
		this.allNotes = this.resolveNotes();
	}

	protected renderBody(container: HTMLElement): void {
		this.bodyEl = container;

		const totalCards = this.store.size();
		this.updateTitle(`Export to Anki (${totalCards} cards)`);

		// Scope selection
		const scopeSection = container.createDiv({ cls: "ep:mb-4" });
		scopeSection.createDiv({
			text: "Scope",
			cls: "ep:text-ui-small ep:font-medium ep:mb-2",
		});

		const allRadio = this.createRadio(
			scopeSection,
			"export-scope",
			`All cards (${totalCards})`,
			true,
		);
		const projectRadio = this.createRadio(
			scopeSection,
			"export-scope",
			"Selected projects only",
			false,
		);
		const noteRadio = this.createRadio(
			scopeSection,
			"export-scope",
			"Selected notes only",
			false,
		);

		const setMode = (mode: "all" | "projects" | "notes") => {
			this.exportMode = mode;
			this.projectListEl?.toggleClass("ep-hidden", mode !== "projects");
			this.noteListEl?.toggleClass("ep-hidden", mode !== "notes");
		};

		this.addDomEvent(allRadio, "change", () => {
			if (allRadio.checked) setMode("all");
		});
		this.addDomEvent(projectRadio, "change", () => {
			if (projectRadio.checked) setMode("projects");
		});
		this.addDomEvent(noteRadio, "change", () => {
			if (noteRadio.checked) setMode("notes");
		});

		// Project list (hidden by default)
		if (this.allProjects.length > 0) {
			this.projectListEl = scopeSection.createDiv({
				cls: "ep-hidden ep:border ep:border-obs-border ep:rounded-md ep:max-h-[150px] ep:overflow-y-auto ep:mt-2 ep:ml-6",
			});
			for (const project of this.allProjects) {
				this.renderCheckboxItem(this.projectListEl, project, this.selectedProjects);
			}
		}

		// Note list (hidden by default)
		if (this.allNotes.length > 0) {
			this.noteListEl = scopeSection.createDiv({
				cls: "ep-hidden ep:border ep:border-obs-border ep:rounded-md ep:max-h-[150px] ep:overflow-y-auto ep:mt-2 ep:ml-6",
			});
			for (const note of this.allNotes) {
				const label = note.name;
				this.renderCheckboxItem(this.noteListEl, label, this.selectedSourceUids, note.uid);
			}
		}

		// Options
		const optionsSection = container.createDiv({ cls: "ep:mb-4" });
		optionsSection.createDiv({
			text: "Options",
			cls: "ep:text-ui-small ep:font-medium ep:mb-2",
		});

		this.renderOptionCheckbox(
			optionsSection,
			"Include scheduling data",
			"Export review history and card progress",
			this.includeScheduling,
			(val) => (this.includeScheduling = val),
		);

		this.renderOptionCheckbox(
			optionsSection,
			"Include media",
			"Export images and audio files",
			this.includeMedia,
			(val) => (this.includeMedia = val),
		);

		// Buttons
		this.createButtonsSection(container, [
			{
				text: "Cancel",
				type: "secondary",
				onClick: () => this.close(),
			},
			{
				text: "Export",
				type: "primary",
				onClick: () => void this.startExport(),
			},
		]);
	}

	private async startExport(): Promise<void> {
		if (!this.bodyEl) return;
		const container = this.bodyEl;
		container.empty();

		const progressEl = container.createDiv({
			cls: "ep:text-center ep:py-6",
		});
		progressEl.createDiv({
			text: "Building .apkg file...",
			cls: "ep:text-ui-small ep:font-medium ep:mb-2",
		});
		progressEl.createDiv({
			text: "This may take a moment for large collections",
			cls: "ep:text-ui-smaller ep:text-obs-muted",
		});

		try {
			const exportService = new AnkiExportService(
				this.app,
				this.store,
				this.fsrsService,
			);

			const options: AnkiExportOptions = {
				exportMode: this.exportMode,
				projects: this.exportMode === "projects" ? [...this.selectedProjects] : undefined,
				sourceUids: this.exportMode === "notes" ? [...this.selectedSourceUids] : undefined,
				includeScheduling: this.includeScheduling,
				includeMedia: this.includeMedia,
			};

			const { data, filename } = await exportService.exportApkg(options);

			this.downloadFile(data, filename);

			container.empty();
			container.createDiv({
				cls: "ep:text-center ep:py-6",
			}).createDiv({
				text: `Exported as ${filename}`,
				cls: "ep:text-ui-small ep:font-medium ep:text-green-500",
			});

			this.createButtonsSection(container, [
				{
					text: "Done",
					type: "primary",
					onClick: () => this.close(),
				},
			]);
		} catch (err) {
			container.empty();
			const errMsg = err instanceof Error ? err.message : String(err);
			container.createDiv({
				text: `Export failed: ${errMsg}`,
				cls: "ep:text-ui-small ep:text-red-500 ep:py-4 ep:text-center",
			});
			this.createButtonsSection(container, [
				{
					text: "Close",
					type: "secondary",
					onClick: () => this.close(),
				},
			]);
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

			const uid = cache.frontmatter["flashcard_uid"] as string | undefined;
			if (!uid) continue;

			notes.push({ uid, name: file.basename });
		}

		return notes.sort((a, b) => a.name.localeCompare(b.name));
	}

	private createRadio(
		container: HTMLElement,
		name: string,
		label: string,
		checked: boolean,
	): HTMLInputElement {
		const row = container.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2 ep:py-1",
		});
		const radio = row.createEl("input", {
			type: "radio",
			cls: "ep:w-4 ep:h-4 ep:accent-obs-interactive",
			attr: { name },
		});
		radio.checked = checked;
		row.createEl("label", {
			text: label,
			cls: "ep:text-ui-small",
		});
		return radio;
	}

	private renderCheckboxItem(
		container: HTMLElement,
		label: string,
		selectedSet: Set<string>,
		key?: string,
	): void {
		const itemKey = key ?? label;
		const row = container.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2 ep:p-2 ep:border-b ep:border-obs-border ep:last:border-b-0 ep:cursor-pointer ep:hover:bg-obs-modifier-hover",
		});

		const checkbox = row.createEl("input", {
			type: "checkbox",
			cls: "ep:w-4 ep:h-4 ep:accent-obs-interactive",
		});
		row.createEl("span", {
			text: label,
			cls: "ep:text-ui-small",
		});

		this.addDomEvent(checkbox, "change", () => {
			if (checkbox.checked) {
				selectedSet.add(itemKey);
			} else {
				selectedSet.delete(itemKey);
			}
		});

		this.addDomEvent(row, "click", (e: MouseEvent) => {
			if (e.target !== checkbox) {
				checkbox.checked = !checkbox.checked;
				if (checkbox.checked) {
					selectedSet.add(itemKey);
				} else {
					selectedSet.delete(itemKey);
				}
			}
		});
	}

	private renderOptionCheckbox(
		container: HTMLElement,
		label: string,
		description: string,
		checked: boolean,
		onChange: (val: boolean) => void,
	): void {
		const row = container.createDiv({
			cls: "ep:flex ep:items-start ep:gap-3 ep:py-2",
		});

		const checkbox = row.createEl("input", {
			type: "checkbox",
			cls: "ep:w-4 ep:h-4 ep:accent-obs-interactive ep:shrink-0 ep:mt-0.5",
		});
		checkbox.checked = checked;
		this.addDomEvent(checkbox, "change", () => onChange(checkbox.checked));

		const textEl = row.createDiv();
		textEl.createDiv({
			text: label,
			cls: "ep:text-ui-small ep:font-medium",
		});
		textEl.createDiv({
			text: description,
			cls: "ep:text-ui-smaller ep:text-obs-muted",
		});
	}
}
