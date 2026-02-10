import { App } from "obsidian";
import { BaseModal } from "./BaseModal";
import type { SqliteStoreService } from "../../services/persistence/sqlite/SqliteStoreService";
import type { FrontmatterIndexService } from "../../services/core/frontmatter-index.service";
import { CsvExportService, type CsvSeparator } from "../../services/export/csv-export.service";

interface NoteEntry {
	uid: string;
	name: string;
	project: string;
}

export class CsvExportModal extends BaseModal {
	private store: SqliteStoreService;
	private frontmatterIndex: FrontmatterIndexService;
	private allProjects: string[] = [];
	private allNotes: NoteEntry[] = [];
	private selectedProjects = new Set<string>();
	private selectedSourceUids = new Set<string>();
	private includeScheduling = false;
	private separator: CsvSeparator = ",";
	private exportMode: "all" | "projects" | "notes" = "all";

	private bodyEl: HTMLElement | null = null;
	private projectListEl: HTMLElement | null = null;
	private noteListEl: HTMLElement | null = null;

	constructor(app: App, store: SqliteStoreService, frontmatterIndex: FrontmatterIndexService) {
		super(app, { title: "Export as CSV", width: "520px" });
		this.store = store;
		this.frontmatterIndex = frontmatterIndex;
		this.allProjects = this.resolveProjects();
		this.allNotes = this.resolveNotes();
	}

	protected renderBody(container: HTMLElement): void {
		this.bodyEl = container;

		const totalCards = this.store.size();
		this.updateTitle(`Export as CSV (${totalCards} cards)`);

		// Scope selection
		const scopeSection = container.createDiv({ cls: "ep:mb-4" });
		scopeSection.createDiv({
			text: "Scope",
			cls: "ep:text-ui-small ep:font-medium ep:mb-2",
		});

		const allRadio = this.createRadio(
			scopeSection,
			"csv-scope",
			`All cards (${totalCards})`,
			true,
		);
		const projectRadio = this.createRadio(
			scopeSection,
			"csv-scope",
			"Selected projects only",
			false,
		);
		const noteRadio = this.createRadio(
			scopeSection,
			"csv-scope",
			"Selected notes only",
			false,
		);

		const setMode = (mode: "all" | "projects" | "notes") => {
			this.exportMode = mode;
			if (this.projectListEl) {
				this.projectListEl.style.display = mode === "projects" ? "block" : "none";
			}
			if (this.noteListEl) {
				this.noteListEl.style.display = mode === "notes" ? "block" : "none";
			}
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

		if (this.allProjects.length > 0) {
			this.projectListEl = scopeSection.createDiv({
				cls: "ep:border ep:border-obs-border ep:rounded-md ep:max-h-[150px] ep:overflow-y-auto ep:mt-2 ep:ml-6",
				attr: { style: "display: none" },
			});
			for (const project of this.allProjects) {
				this.renderCheckboxItem(this.projectListEl, project, this.selectedProjects);
			}
		}

		if (this.allNotes.length > 0) {
			this.noteListEl = scopeSection.createDiv({
				cls: "ep:border ep:border-obs-border ep:rounded-md ep:max-h-[150px] ep:overflow-y-auto ep:mt-2 ep:ml-6",
				attr: { style: "display: none" },
			});
			for (const note of this.allNotes) {
				const label = note.project ? `${note.name} (${note.project})` : note.name;
				this.renderCheckboxItem(this.noteListEl, label, this.selectedSourceUids, note.uid);
			}
		}

		// Separator selection
		const sepSection = container.createDiv({ cls: "ep:mb-4" });
		sepSection.createDiv({
			text: "Separator",
			cls: "ep:text-ui-small ep:font-medium ep:mb-2",
		});

		const separators: { label: string; value: CsvSeparator }[] = [
			{ label: "Comma (,)", value: "," },
			{ label: "Tab", value: "\t" },
			{ label: "Semicolon (;)", value: ";" },
		];

		for (const sep of separators) {
			const radio = this.createRadio(
				sepSection,
				"csv-separator",
				sep.label,
				sep.value === this.separator,
			);
			this.addDomEvent(radio, "change", () => {
				if (radio.checked) this.separator = sep.value;
			});
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
			"Adds State, Due, Interval, Lapses columns",
			this.includeScheduling,
			(val) => (this.includeScheduling = val),
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

		try {
			const service = new CsvExportService(this.app, this.store);

			const { content, filename } = service.export({
				projects: this.exportMode === "projects" ? [...this.selectedProjects] : undefined,
				sourceUids: this.exportMode === "notes" ? [...this.selectedSourceUids] : undefined,
				includeScheduling: this.includeScheduling,
				separator: this.separator,
			});

			this.downloadFile(content, filename);

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

			const uid = cache.frontmatter["flashcard_uid"] as string | undefined;
			if (!uid) continue;

			let project = "";
			const tags = cache.frontmatter["tags"] as unknown;
			if (Array.isArray(tags)) {
				for (const tag of tags) {
					if (typeof tag !== "string") continue;
					const match = tag.match(/^(?:mind|input)\/(.+)$/);
					if (match?.[1]) {
						project = match[1];
						break;
					}
				}
			}

			notes.push({ uid, name: file.basename, project });
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
