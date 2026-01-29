/**
 * Refine Preset Editor Modal
 * Add or edit custom AI refine presets
 */
import { App } from "obsidian";
import { BasePromiseModal } from "./BasePromiseModal";
import type { RefinePreset } from "../../types";

export interface RefinePresetEditorModalOptions {
	preset?: RefinePreset;
	mode: "add" | "edit";
}

export interface RefinePresetEditorResult {
	cancelled: boolean;
	preset?: RefinePreset;
}

export class RefinePresetEditorModal extends BasePromiseModal<RefinePresetEditorResult> {
	private options: RefinePresetEditorModalOptions;

	// UI refs
	private labelInput: HTMLInputElement | null = null;
	private instructionTextarea: HTMLTextAreaElement | null = null;
	private saveButton: HTMLButtonElement | null = null;

	constructor(app: App, options: RefinePresetEditorModalOptions) {
		super(app, {
			title: options.mode === "add" ? "Add Refine Preset" : "Edit Refine Preset",
			width: "500px",
		});
		this.options = options;
	}

	protected getDefaultResult(): RefinePresetEditorResult {
		return { cancelled: true };
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("true-recall-preset-editor-modal");
	}

	protected renderBody(container: HTMLElement): void {
		// Label input
		const labelSection = container.createDiv({ cls: "ep:mb-4" });
		labelSection.createEl("label", {
			text: "Label",
			cls: "ep:block ep:font-medium ep:text-ui-small ep:text-obs-normal ep:mb-1.5",
		});
		this.labelInput = labelSection.createEl("input", {
			type: "text",
			placeholder: "e.g., Add context",
			cls: "ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive",
		});
		this.labelInput.value = this.options.preset?.label ?? "";
		this.labelInput.addEventListener("input", () => this.validateForm());

		// Instruction textarea
		const instructionSection = container.createDiv({ cls: "ep:mb-4" });
		instructionSection.createEl("label", {
			text: "Instruction",
			cls: "ep:block ep:font-medium ep:text-ui-small ep:text-obs-normal ep:mb-1.5",
		});
		this.instructionTextarea = instructionSection.createEl("textarea", {
			placeholder:
				"e.g., Add more context and background information to the answers",
			cls: "ep:w-full ep:min-h-32 ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:resize-y ep:focus:outline-none ep:focus:border-obs-interactive",
		});
		this.instructionTextarea.value = this.options.preset?.instruction ?? "";
		this.instructionTextarea.addEventListener("input", () => this.validateForm());

		// Buttons
		this.renderButtons(container);

		// Focus label input
		setTimeout(() => this.labelInput?.focus(), 50);
	}

	private renderButtons(container: HTMLElement): void {
		const buttonsEl = container.createDiv({
			cls: "ep:flex ep:justify-end ep:gap-3 ep:pt-4 ep:border-t ep:border-obs-border",
		});

		const cancelBtn = buttonsEl.createEl("button", {
			text: "Cancel",
			cls: "ep:py-2.5 ep:px-5 ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:font-medium ep:transition-colors ep:hover:bg-obs-modifier-hover",
		});
		cancelBtn.addEventListener("click", () => this.close());

		this.saveButton = buttonsEl.createEl("button", {
			text: this.options.mode === "add" ? "Add Preset" : "Save Changes",
			cls: "ep:py-2.5 ep:px-5 ep:bg-obs-interactive ep:text-white ep:border-none ep:rounded-md ep:cursor-pointer ep:font-medium ep:transition-colors ep:hover:bg-obs-interactive-hover ep:disabled:opacity-50 ep:disabled:cursor-not-allowed",
		});
		this.saveButton.disabled = !this.isFormValid();
		this.saveButton.addEventListener("click", () => this.handleSave());
	}

	private isFormValid(): boolean {
		const label = this.labelInput?.value.trim() ?? "";
		const instruction = this.instructionTextarea?.value.trim() ?? "";
		return label.length > 0 && instruction.length > 0;
	}

	private validateForm(): void {
		if (this.saveButton) {
			this.saveButton.disabled = !this.isFormValid();
		}
	}

	private handleSave(): void {
		const label = this.labelInput?.value.trim() ?? "";
		const instruction = this.instructionTextarea?.value.trim() ?? "";

		if (!label || !instruction) return;

		const preset: RefinePreset = {
			id: this.options.preset?.id ?? crypto.randomUUID(),
			label,
			instruction,
			isDefault: false,
		};

		this.resolve({
			cancelled: false,
			preset,
		});
	}
}
