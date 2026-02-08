import { App } from "obsidian";
import {
	BasePromiseModal,
	type CancellableResult,
} from "./BasePromiseModal";
import type { BaseModalOptions } from "./BaseModal";
import type { SessionResult } from "../../types/events.types";
import type { ReviewOrder } from "../../types/settings.types";

export interface CustomStudyModalResult extends CancellableResult {
	sessionResult?: SessionResult;
	saveAsPreset?: boolean;
	presetName?: string;
}

export interface CustomStudyModalScope {
	projectFilters?: string[];
	sourceNoteFilters?: string[];
	scopeLabel?: string;
}

interface CustomStudyConfig {
	stateFilter: "all" | "new" | "learning" | "due";
	difficultyMin: number;
	difficultyMax: number;
	lapsesMin: number;
	reviewOrder: ReviewOrder;
	cardLimit: number;
	studyAheadDays: number;
	crammingMode: boolean;
}

const REVIEW_ORDER_LABELS: Record<ReviewOrder, string> = {
	"due-date": "Due date",
	random: "Random",
	"due-date-random": "Due date (randomized)",
	"by-retrievability": "Retrievability",
	"most-lapses": "Most lapses",
	"relative-overdueness": "Relative overdueness",
	"lowest-stability": "Lowest stability",
	"order-added": "Order added",
};

export class CustomStudyModal extends BasePromiseModal<CustomStudyModalResult> {
	private config: CustomStudyConfig = {
		stateFilter: "all",
		difficultyMin: 1,
		difficultyMax: 10,
		lapsesMin: 0,
		reviewOrder: "due-date",
		cardLimit: 0,
		studyAheadDays: 0,
		crammingMode: false,
	};
	private studyScope?: CustomStudyModalScope;

	constructor(app: App, options: BaseModalOptions, studyScope?: CustomStudyModalScope) {
		super(app, options);
		this.studyScope = studyScope;
	}

	protected getDefaultResult(): CustomStudyModalResult {
		return { cancelled: true };
	}

	protected renderBody(container: HTMLElement): void {
		const sectionCls = "ep:mb-4";
		const labelCls = "ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:mb-1.5 ep:block";
		const inputCls = "ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive";
		const selectCls = inputCls;

		// Scope badge
		if (this.studyScope?.scopeLabel) {
			const scopeSection = container.createDiv({ cls: "ep:mb-4 ep:flex ep:items-center ep:gap-2" });
			scopeSection.createSpan({
				text: this.studyScope.scopeLabel,
				cls: "ep:text-ui-smaller ep:font-medium ep:px-2.5 ep:py-1 ep:rounded-full ep:bg-obs-accent/15 ep:text-obs-accent",
			});
		}

		// State filter
		const stateSection = container.createDiv({ cls: sectionCls });
		stateSection.createEl("label", { text: "Card state", cls: labelCls });
		const stateSelect = stateSection.createEl("select", { cls: selectCls });
		for (const [value, label] of [
			["all", "All states"],
			["new", "New only"],
			["learning", "Learning only"],
			["due", "Due only"],
		] as const) {
			stateSelect.createEl("option", { text: label, value });
		}
		stateSelect.value = this.config.stateFilter;
		this.addDomEvent(stateSelect, "change", () => {
			this.config.stateFilter = stateSelect.value as CustomStudyConfig["stateFilter"];
		});

		// Difficulty range
		const diffSection = container.createDiv({ cls: sectionCls });
		diffSection.createEl("label", { text: "Difficulty range (1-10)", cls: labelCls });
		const diffRow = diffSection.createDiv({ cls: "ep:flex ep:gap-2 ep:items-center" });
		const diffMin = diffRow.createEl("input", {
			type: "number",
			cls: inputCls,
			attr: { min: "1", max: "10", step: "1" },
		});
		diffMin.value = String(this.config.difficultyMin);
		diffRow.createSpan({ text: "to", cls: "ep:text-ui-smaller ep:text-obs-muted" });
		const diffMax = diffRow.createEl("input", {
			type: "number",
			cls: inputCls,
			attr: { min: "1", max: "10", step: "1" },
		});
		diffMax.value = String(this.config.difficultyMax);
		this.addDomEvent(diffMin, "change", () => {
			this.config.difficultyMin = Math.max(1, Math.min(10, Number(diffMin.value) || 1));
		});
		this.addDomEvent(diffMax, "change", () => {
			this.config.difficultyMax = Math.max(1, Math.min(10, Number(diffMax.value) || 10));
		});

		// Minimum lapses
		const lapsesSection = container.createDiv({ cls: sectionCls });
		lapsesSection.createEl("label", { text: "Minimum lapses", cls: labelCls });
		const lapsesInput = lapsesSection.createEl("input", {
			type: "number",
			cls: inputCls,
			attr: { min: "0", step: "1" },
		});
		lapsesInput.value = String(this.config.lapsesMin);
		this.addDomEvent(lapsesInput, "change", () => {
			this.config.lapsesMin = Math.max(0, Number(lapsesInput.value) || 0);
		});

		// Study ahead days
		const aheadSection = container.createDiv({ cls: sectionCls });
		aheadSection.createEl("label", { text: "Study ahead (days, 0 = off)", cls: labelCls });
		const aheadInput = aheadSection.createEl("input", {
			type: "number",
			cls: inputCls,
			attr: { min: "0", step: "1" },
		});
		aheadInput.value = String(this.config.studyAheadDays);
		this.addDomEvent(aheadInput, "change", () => {
			this.config.studyAheadDays = Math.max(0, Number(aheadInput.value) || 0);
		});

		// Sort order
		const orderSection = container.createDiv({ cls: sectionCls });
		orderSection.createEl("label", { text: "Sort order", cls: labelCls });
		const orderSelect = orderSection.createEl("select", { cls: selectCls });
		for (const [value, label] of Object.entries(REVIEW_ORDER_LABELS)) {
			orderSelect.createEl("option", { text: label, value });
		}
		orderSelect.value = this.config.reviewOrder;
		this.addDomEvent(orderSelect, "change", () => {
			this.config.reviewOrder = orderSelect.value as ReviewOrder;
		});

		// Card limit
		const limitSection = container.createDiv({ cls: sectionCls });
		limitSection.createEl("label", { text: "Card limit (0 = no limit)", cls: labelCls });
		const limitInput = limitSection.createEl("input", {
			type: "number",
			cls: inputCls,
			attr: { min: "0", step: "10" },
		});
		limitInput.value = String(this.config.cardLimit);
		this.addDomEvent(limitInput, "change", () => {
			this.config.cardLimit = Math.max(0, Number(limitInput.value) || 0);
		});

		// Cramming mode toggle
		const cramSection = container.createDiv({ cls: sectionCls });
		const cramRow = cramSection.createDiv({ cls: "ep:flex ep:items-center ep:gap-2" });
		const cramCheckbox = cramRow.createEl("input", {
			type: "checkbox",
			cls: "ep:w-4 ep:h-4",
		});
		cramCheckbox.checked = this.config.crammingMode;
		cramRow.createEl("label", {
			text: "Cramming mode (no scheduling changes)",
			cls: "ep:text-ui-small ep:text-obs-normal ep:cursor-pointer",
		});
		this.addDomEvent(cramCheckbox, "change", () => {
			this.config.crammingMode = cramCheckbox.checked;
		});
		this.addDomEvent(cramRow.querySelector("label")!, "click", () => {
			cramCheckbox.checked = !cramCheckbox.checked;
			this.config.crammingMode = cramCheckbox.checked;
		});

		// Preset name (for saving)
		const presetSection = container.createDiv({ cls: sectionCls });
		presetSection.createEl("label", { text: "Save as preset (optional)", cls: labelCls });
		const presetInput = presetSection.createEl("input", {
			type: "text",
			cls: inputCls,
			placeholder: "Preset name...",
		});

		// Buttons
		this.createButtonsSection(container, [
			{
				text: "Cancel",
				type: "secondary",
				onClick: () => this.resolve({ cancelled: true }),
			},
			{
				text: "Start session",
				type: "primary",
				onClick: () => {
					const result = this.buildResult();
					if (presetInput.value.trim()) {
						result.saveAsPreset = true;
						result.presetName = presetInput.value.trim();
					}
					this.resolve(result);
				},
			},
		]);
	}

	private buildResult(): CustomStudyModalResult {
		const hasDifficultyFilter =
			this.config.difficultyMin > 1 || this.config.difficultyMax < 10;
		const hasLapsesFilter = this.config.lapsesMin > 0;

		const sessionResult: SessionResult = {
			cancelled: false,
			sessionType: "custom-study",
			ignoreDailyLimits: true,
			bypassScheduling: true,
			reviewOrder: this.config.reviewOrder,
			stateFilter:
				this.config.stateFilter === "all"
					? undefined
					: this.config.stateFilter,
			difficultyRange: hasDifficultyFilter
				? { min: this.config.difficultyMin, max: this.config.difficultyMax }
				: undefined,
			lapsesRange: hasLapsesFilter
				? { min: this.config.lapsesMin, max: Infinity }
				: undefined,
			cardLimit: this.config.cardLimit > 0
				? this.config.cardLimit
				: undefined,
			studyAheadDays: this.config.studyAheadDays > 0
				? this.config.studyAheadDays
				: undefined,
			crammingMode: this.config.crammingMode || undefined,
			projectFilters: this.studyScope?.projectFilters,
			sourceNoteFilters: this.studyScope?.sourceNoteFilters,
		};

		return { cancelled: false, sessionResult };
	}
}
