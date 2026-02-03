/**
 * Easy Days Modal
 * Configure recurring weekdays and specific dates with reduced workload
 */
import { App } from "obsidian";
import { BasePromiseModal, type CancellableResult } from "./BasePromiseModal";
import type { EasyDaysConfig } from "../../types";

/**
 * Result returned when the modal closes
 */
export interface EasyDaysResult extends CancellableResult {
	easyDays?: EasyDaysConfig;
	multiplier?: number;
	applyNow?: boolean;
}

interface EasyDaysModalOptions {
	easyDays: EasyDaysConfig;
	multiplier: number;
}

/**
 * Modal for configuring Easy Days (recurring weekdays + specific dates)
 */
export class EasyDaysModal extends BasePromiseModal<EasyDaysResult> {
	private recurringDays: Set<number>;
	private specificDates: Set<string>;
	private multiplier: number;
	private datesListEl: HTMLElement | null = null;

	constructor(app: App, options: EasyDaysModalOptions) {
		super(app, { title: "Easy Days Configuration", width: "450px" });
		this.recurringDays = new Set(options.easyDays.recurringDays);
		this.specificDates = new Set(options.easyDays.specificDates);
		this.multiplier = options.multiplier;
	}

	protected getDefaultResult(): EasyDaysResult {
		return { cancelled: true };
	}

	protected renderBody(container: HTMLElement): void {
		// Recurring Days Section
		this.renderRecurringDaysSection(container);

		// Specific Dates Section
		this.renderSpecificDatesSection(container);

		// Workload Multiplier Section
		this.renderMultiplierSection(container);

		// Buttons
		this.createButtonsSection(container, [
			{
				text: "Cancel",
				type: "secondary",
				onClick: () => this.resolve({ cancelled: true }),
			},
			{
				text: "Save",
				type: "secondary",
				onClick: () => this.handleSave(false),
			},
			{
				text: "Apply Now",
				type: "primary",
				onClick: () => this.handleSave(true),
			},
		]);
	}

	private renderRecurringDaysSection(container: HTMLElement): void {
		const section = container.createDiv({ cls: "ep:mb-5" });

		section.createEl("h4", {
			text: "Recurring days",
			cls: "ep:text-ui-small ep:font-semibold ep:mb-2 ep:text-obs-normal",
		});

		section.createEl("p", {
			text: "Select days of the week with reduced workload",
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:mb-3",
		});

		const daysContainer = section.createDiv({
			cls: "ep:flex ep:gap-1.5 ep:flex-wrap",
		});

		const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

		dayNames.forEach((name, index) => {
			const isSelected = this.recurringDays.has(index);
			const dayBtn = daysContainer.createEl("button", {
				text: name,
				attr: { type: "button" },
				cls: this.getDayButtonClass(isSelected),
			});

			this.addDomEvent(dayBtn, "click", () => {
				if (this.recurringDays.has(index)) {
					this.recurringDays.delete(index);
				} else {
					this.recurringDays.add(index);
				}
				dayBtn.className = this.getDayButtonClass(this.recurringDays.has(index));
			});
		});
	}

	private getDayButtonClass(isSelected: boolean): string {
		const base = "ep:px-3 ep:py-1.5 ep:rounded ep:border ep:cursor-pointer ep:text-ui-small ep:font-medium ep:transition-colors";
		if (isSelected) {
			return `${base} ep:bg-obs-interactive ep:text-on-accent ep:border-obs-interactive`;
		}
		return `${base} ep:bg-transparent ep:border-obs-border ep:text-obs-normal ep:hover:bg-obs-modifier-hover`;
	}

	private renderSpecificDatesSection(container: HTMLElement): void {
		const section = container.createDiv({ cls: "ep:mb-5" });

		section.createEl("h4", {
			text: "Specific dates",
			cls: "ep:text-ui-small ep:font-semibold ep:mb-2 ep:text-obs-normal",
		});

		section.createEl("p", {
			text: "Add individual dates with reduced workload",
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:mb-3",
		});

		// Date input row
		const inputRow = section.createDiv({
			cls: "ep:flex ep:gap-2 ep:mb-3",
		});

		const dateInput = inputRow.createEl("input", {
			type: "date",
			cls: "ep:flex-1 ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small",
		});

		// Set min date to today
		const today = new Date().toISOString().split("T")[0]!;
		dateInput.min = today;
		dateInput.value = today;

		const addBtn = inputRow.createEl("button", {
			text: "+ add",
			type: "button",
			cls: "ep:px-4 ep:py-2 ep:rounded-md ep:bg-obs-interactive ep:text-on-accent ep:border-none ep:text-ui-small ep:font-medium ep:cursor-pointer ep:hover:opacity-90",
		});

		this.addDomEvent(addBtn, "click", () => {
			const dateValue = dateInput.value;
			if (dateValue && !this.specificDates.has(dateValue)) {
				this.specificDates.add(dateValue);
				this.renderDatesList();
			}
		});

		// Dates list
		this.datesListEl = section.createDiv({
			cls: "ep:border ep:border-obs-border ep:rounded-md ep:max-h-[150px] ep:overflow-y-auto",
		});

		this.renderDatesList();
	}

	private renderDatesList(): void {
		if (!this.datesListEl) return;

		this.datesListEl.empty();

		const sortedDates = Array.from(this.specificDates).sort();

		if (sortedDates.length === 0) {
			this.datesListEl.createDiv({
				text: "No specific dates added",
				cls: "ep:py-4 ep:px-3 ep:text-center ep:text-obs-muted ep:text-ui-smaller ep:italic",
			});
			return;
		}

		for (const dateStr of sortedDates) {
			const dateItem = this.datesListEl.createDiv({
				cls: "ep:flex ep:items-center ep:justify-between ep:py-2 ep:px-3 ep:border-b ep:border-obs-border ep:last:border-b-0",
			});

			// Format date for display
			const date = new Date(dateStr + "T00:00:00");
			const formattedDate = date.toLocaleDateString(undefined, {
				weekday: "short",
				year: "numeric",
				month: "short",
				day: "numeric",
			});

			dateItem.createSpan({
				text: formattedDate,
				cls: "ep:text-ui-small ep:text-obs-normal",
			});

			const deleteBtn = dateItem.createEl("button", {
				text: "×",
				type: "button",
				cls: "ep:w-6 ep:h-6 ep:rounded ep:bg-transparent ep:border-none ep:text-obs-muted ep:cursor-pointer ep:text-lg ep:hover:text-red-500 ep:hover:bg-red-500/10",
			});

			this.addDomEvent(deleteBtn, "click", () => {
				this.specificDates.delete(dateStr);
				this.renderDatesList();
			});
		}
	}

	private renderMultiplierSection(container: HTMLElement): void {
		const section = container.createDiv({ cls: "ep:mb-5" });

		section.createEl("h4", {
			text: "Workload reduction",
			cls: "ep:text-ui-small ep:font-semibold ep:mb-2 ep:text-obs-normal",
		});

		const sliderRow = section.createDiv({
			cls: "ep:flex ep:items-center ep:gap-3",
		});

		const slider = sliderRow.createEl("input", {
			type: "range",
			cls: "ep:flex-1 ep:accent-obs-interactive",
		});
		slider.min = "0";
		slider.max = "100";
		slider.step = "10";
		slider.value = String(this.multiplier * 100);

		const valueLabel = sliderRow.createSpan({
			text: `${Math.round(this.multiplier * 100)}%`,
			cls: "ep:text-ui-small ep:text-obs-normal ep:w-12 ep:text-right ep:font-medium",
		});

		this.addDomEvent(slider, "input", () => {
			this.multiplier = parseInt(slider.value) / 100;
			valueLabel.textContent = `${slider.value}%`;
		});

		section.createEl("p", {
			text: "Percentage of normal workload on easy days (0% = no reviews)",
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:mt-2",
		});
	}

	private handleSave(applyNow: boolean): void {
		this.resolve({
			cancelled: false,
			easyDays: {
				recurringDays: Array.from(this.recurringDays).sort((a, b) => a - b),
				specificDates: Array.from(this.specificDates).sort(),
			},
			multiplier: this.multiplier,
			applyNow,
		});
	}
}
