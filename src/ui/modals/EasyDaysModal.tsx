import { render } from "preact";
import { useState } from "preact/hooks";
import { App } from "obsidian";
import { BasePromiseModal, type CancellableResult } from "./BasePromiseModal";
import type { EasyDaysConfig } from "../../types";

export interface EasyDaysResult extends CancellableResult {
	easyDays?: EasyDaysConfig;
	multiplier?: number;
	applyNow?: boolean;
}

interface EasyDaysModalOptions {
	easyDays: EasyDaysConfig;
	multiplier: number;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function DayButton({
	name,
	isSelected,
	onToggle,
}: {
	name: string;
	isSelected: boolean;
	onToggle: () => void;
}) {
	const base =
		"ep:px-3 ep:py-1.5 ep:rounded-md ep:border ep:cursor-pointer ep:text-ui-small ep:font-medium ep:transition-colors";
	const cls = isSelected
		? `${base} ep:bg-obs-interactive ep:text-obs-on-accent ep:border-obs-interactive`
		: `${base} ep:bg-transparent ep:border-obs-border ep:text-obs-normal ep:hover:bg-obs-modifier-hover`;

	return (
		<button type="button" class={cls} onClick={onToggle}>
			{name}
		</button>
	);
}

function formatDate(dateStr: string): string {
	const date = new Date(dateStr + "T00:00:00");
	return date.toLocaleDateString(undefined, {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
	});
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
		() => new Date().toISOString().split("T")[0]!,
	);

	const today = new Date().toISOString().split("T")[0]!;

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

	const sortedDates = Array.from(specificDates).sort();

	return (
		<>
			{/* Recurring Days */}
			<div class="ep:mb-5">
				<h4 class="ep:text-ui-small ep:font-semibold ep:mb-2 ep:text-obs-normal">
					Recurring days
				</h4>
				<p class="ep:text-ui-smaller ep:text-obs-muted ep:mb-3">
					Select days of the week with reduced workload
				</p>
				<div class="ep:flex ep:gap-1.5 ep:flex-wrap">
					{DAY_NAMES.map((name, index) => (
						<DayButton
							key={index}
							name={name}
							isSelected={recurringDays.has(index)}
							onToggle={() => toggleDay(index)}
						/>
					))}
				</div>
			</div>

			{/* Specific Dates */}
			<div class="ep:mb-5">
				<h4 class="ep:text-ui-small ep:font-semibold ep:mb-2 ep:text-obs-normal">
					Specific dates
				</h4>
				<p class="ep:text-ui-smaller ep:text-obs-muted ep:mb-3">
					Add individual dates with reduced workload
				</p>

				<div class="ep:flex ep:gap-2 ep:mb-3">
					<input
						type="date"
						class="ep:flex-1 ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small"
						min={today}
						value={dateInputValue}
						onChange={(e) =>
							setDateInputValue(
								(e.target as HTMLInputElement).value,
							)
						}
					/>
					<button
						type="button"
						class="ep:px-4 ep:py-2 ep:rounded-md ep:bg-obs-interactive ep:text-obs-on-accent ep:border-none ep:text-ui-small ep:font-medium ep:cursor-pointer ep:hover:opacity-90"
						onClick={addDate}
					>
						+ add
					</button>
				</div>

				<div class="ep:border ep:border-obs-border ep:rounded-md ep:max-h-[150px] ep:overflow-y-auto">
					{sortedDates.length === 0 ? (
						<div class="ep:py-4 ep:px-3 ep:text-center ep:text-obs-muted ep:text-ui-smaller ep:italic">
							No specific dates added
						</div>
					) : (
						sortedDates.map((dateStr) => (
							<div
								key={dateStr}
								class="ep:flex ep:items-center ep:justify-between ep:py-2 ep:px-3 ep:border-b ep:border-obs-border ep:last:border-b-0"
							>
								<span class="ep:text-ui-small ep:text-obs-normal">
									{formatDate(dateStr)}
								</span>
								<button
									type="button"
									class="ep:w-6 ep:h-6 ep:rounded-md ep:bg-transparent ep:border-none ep:text-obs-muted ep:cursor-pointer ep:text-lg ep:hover:text-obs-red ep:hover:bg-obs-red/10"
									onClick={() => removeDate(dateStr)}
								>
									&times;
								</button>
							</div>
						))
					)}
				</div>
			</div>

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
								parseInt(
									(e.target as HTMLInputElement).value,
								) / 100,
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

			{/* Buttons */}
			<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border">
				<button
					class="ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:hover:bg-obs-modifier-hover"
					onClick={() => onResolve({ cancelled: true })}
				>
					Cancel
				</button>
				<button
					class="ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:hover:bg-obs-modifier-hover"
					onClick={() => handleSave(false)}
				>
					Save
				</button>
				<button
					class="mod-cta ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all"
					onClick={() => handleSave(true)}
				>
					Apply Now
				</button>
			</div>
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
