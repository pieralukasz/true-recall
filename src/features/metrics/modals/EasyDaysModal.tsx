import { DayOfWeekSelector } from "@features/metrics/modals/easy-days/DayOfWeekSelector";
import { SpecificDatesList } from "@features/metrics/modals/easy-days/SpecificDatesList";
import type { EasyDaysConfig } from "@shared/types";
import { ModalFooter, SECONDARY_BTN } from "@shared/ui/components/ModalFooter";
import {
	BasePromiseModal,
	type CancellableResult,
} from "@shared/ui/modals/BasePromiseModal";
import type { App } from "obsidian";
import { render } from "preact";
import { useState } from "preact/hooks";

export interface EasyDaysResult extends CancellableResult {
	easyDays?: EasyDaysConfig;
	multiplier?: number;
	applyNow?: boolean;
}

interface EasyDaysModalOptions {
	easyDays: EasyDaysConfig;
	multiplier: number;
}

function EasyDaysBody({
	initialRecurringDays,
	initialSpecificDates,
	initialMultiplier,
	onResolve,
}: {
	initialRecurringDays: number[];
	initialSpecificDates: string[];
	initialMultiplier: number;
	onResolve: (result: EasyDaysResult) => void;
}) {
	const [recurringDays, setRecurringDays] = useState<Set<number>>(
		() => new Set(initialRecurringDays),
	);
	const [specificDates, setSpecificDates] = useState<Set<string>>(
		() => new Set(initialSpecificDates),
	);
	const [multiplier, setMultiplier] = useState(initialMultiplier);
	const [dateInputValue, setDateInputValue] = useState(
		() => new Date().toISOString().split("T")[0] ?? "",
	);

	const today = new Date().toISOString().split("T")[0] ?? "";

	const toggleDay = (index: number) => {
		setRecurringDays((prev) => {
			const next = new Set(prev);
			if (next.has(index)) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	};

	const addDate = () => {
		if (dateInputValue && !specificDates.has(dateInputValue)) {
			setSpecificDates((prev) => new Set([...prev, dateInputValue]));
		}
	};

	const removeDate = (dateStr: string) => {
		setSpecificDates((prev) => {
			const next = new Set(prev);
			next.delete(dateStr);
			return next;
		});
	};

	const handleSave = (applyNow: boolean) => {
		onResolve({
			cancelled: false,
			easyDays: {
				recurringDays: Array.from(recurringDays).sort((a, b) => a - b),
				specificDates: Array.from(specificDates).sort(),
			},
			multiplier,
			applyNow,
		});
	};

	return (
		<>
			<DayOfWeekSelector selectedDays={recurringDays} onToggleDay={toggleDay} />

			<SpecificDatesList
				dates={specificDates}
				dateInputValue={dateInputValue}
				today={today}
				onDateInputChange={setDateInputValue}
				onAddDate={addDate}
				onRemoveDate={removeDate}
			/>

			{/* Workload Multiplier */}
			<div class="ep:mb-5">
				<h4 class="ep:text-ui-small ep:font-semibold ep:mb-2 ep:text-obs-normal">
					Workload reduction
				</h4>
				<div class="ep:flex ep:items-center ep:gap-3">
					<input
						type="range"
						class="ep:flex-1 ep:accent-obs-interactive"
						min="0"
						max="100"
						step="10"
						value={Math.round(multiplier * 100)}
						onInput={(e) =>
							setMultiplier(
								parseInt((e.target as HTMLInputElement).value, 10) / 100,
							)
						}
					/>
					<span class="ep:text-ui-small ep:text-obs-normal ep:w-12 ep:text-right ep:font-medium">
						{Math.round(multiplier * 100)}%
					</span>
				</div>
				<p class="ep:text-ui-smaller ep:text-obs-muted ep:mt-2">
					Percentage of normal workload on easy days (0% = no reviews)
				</p>
			</div>

			<ModalFooter
				onCancel={() => onResolve({ cancelled: true })}
				onConfirm={() => handleSave(true)}
				confirmLabel="Apply Now"
			>
				<button
					type="button"
					class={SECONDARY_BTN}
					onClick={() => handleSave(false)}
				>
					Save
				</button>
			</ModalFooter>
		</>
	);
}

export class EasyDaysModal extends BasePromiseModal<EasyDaysResult> {
	private initialRecurringDays: number[];
	private initialSpecificDates: string[];
	private initialMultiplier: number;
	private unmountBody?: () => void;

	constructor(app: App, options: EasyDaysModalOptions) {
		super(app, { title: "Easy Days Configuration", width: "450px" });
		this.initialRecurringDays = [...options.easyDays.recurringDays];
		this.initialSpecificDates = [...options.easyDays.specificDates];
		this.initialMultiplier = options.multiplier;
	}

	protected getDefaultResult(): EasyDaysResult {
		return { cancelled: true };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<EasyDaysBody
				initialRecurringDays={this.initialRecurringDays}
				initialSpecificDates={this.initialSpecificDates}
				initialMultiplier={this.initialMultiplier}
				onResolve={(result) => this.resolve(result)}
			/>,
			container,
		);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		super.onClose();
	}
}
