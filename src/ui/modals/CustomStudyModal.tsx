import type { App } from "obsidian";
import { render } from "preact";
import { useRef, useState } from "preact/hooks";
import type { SessionResult } from "../../types/events.types";
import type { ReviewOrder } from "../../types/settings.types";
import type { BaseModalOptions } from "./BaseModal";
import { BasePromiseModal, type CancellableResult } from "./BasePromiseModal";

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

const DEFAULT_CONFIG: CustomStudyConfig = {
	stateFilter: "all",
	difficultyMin: 1,
	difficultyMax: 10,
	lapsesMin: 0,
	reviewOrder: "due-date",
	cardLimit: 0,
	studyAheadDays: 0,
	crammingMode: false,
};

function CustomStudyBody({
	scopeLabel,
	onResolve,
}: {
	scopeLabel?: string;
	onResolve: (result: CustomStudyModalResult) => void;
}) {
	const [config, setConfig] = useState<CustomStudyConfig>({
		...DEFAULT_CONFIG,
	});
	const presetInputRef = useRef<HTMLInputElement>(null);

	const sectionCls = "ep:mb-4";
	const labelCls =
		"ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:mb-1.5 ep:block";
	const inputCls =
		"ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive";

	const updateConfig = <K extends keyof CustomStudyConfig>(
		key: K,
		value: CustomStudyConfig[K],
	) => {
		setConfig((prev) => ({ ...prev, [key]: value }));
	};

	const handleStart = () => {
		const hasDifficultyFilter =
			config.difficultyMin > 1 || config.difficultyMax < 10;
		const hasLapsesFilter = config.lapsesMin > 0;

		const sessionResult: SessionResult = {
			cancelled: false,
			sessionType: "custom-study",
			ignoreDailyLimits: true,
			bypassScheduling: true,
			reviewOrder: config.reviewOrder,
			stateFilter:
				config.stateFilter === "all" ? undefined : config.stateFilter,
			difficultyRange: hasDifficultyFilter
				? { min: config.difficultyMin, max: config.difficultyMax }
				: undefined,
			lapsesRange: hasLapsesFilter
				? { min: config.lapsesMin, max: Infinity }
				: undefined,
			cardLimit: config.cardLimit > 0 ? config.cardLimit : undefined,
			studyAheadDays:
				config.studyAheadDays > 0 ? config.studyAheadDays : undefined,
			crammingMode: config.crammingMode || undefined,
		};

		const result: CustomStudyModalResult = {
			cancelled: false,
			sessionResult,
		};

		const presetName = presetInputRef.current?.value.trim();
		if (presetName) {
			result.saveAsPreset = true;
			result.presetName = presetName;
		}

		onResolve(result);
	};

	return (
		<>
			{scopeLabel && (
				<div class="ep:mb-4 ep:flex ep:items-center ep:gap-2">
					<span class="ep:text-ui-smaller ep:font-medium ep:px-2.5 ep:py-1 ep:rounded-full ep:bg-obs-accent/15 ep:text-obs-accent">
						{scopeLabel}
					</span>
				</div>
			)}

			<div class={sectionCls}>
				<label htmlFor="cs-state" class={labelCls}>
					Card state
				</label>
				<select
					id="cs-state"
					class={inputCls}
					value={config.stateFilter}
					onChange={(e) =>
						updateConfig(
							"stateFilter",
							(e.target as HTMLSelectElement)
								.value as CustomStudyConfig["stateFilter"],
						)
					}
				>
					<option value="all">All states</option>
					<option value="new">New only</option>
					<option value="learning">Learning only</option>
					<option value="due">Due only</option>
				</select>
			</div>

			<div class={sectionCls}>
				<span class={labelCls}>Difficulty range (1-10)</span>
				<div class="ep:flex ep:gap-2 ep:items-center">
					<input
						type="number"
						class={inputCls}
						min="1"
						max="10"
						step="1"
						value={config.difficultyMin}
						onChange={(e) =>
							updateConfig(
								"difficultyMin",
								Math.max(
									1,
									Math.min(
										10,
										Number((e.target as HTMLInputElement).value) || 1,
									),
								),
							)
						}
					/>
					<span class="ep:text-ui-smaller ep:text-obs-muted">to</span>
					<input
						type="number"
						class={inputCls}
						min="1"
						max="10"
						step="1"
						value={config.difficultyMax}
						onChange={(e) =>
							updateConfig(
								"difficultyMax",
								Math.max(
									1,
									Math.min(
										10,
										Number((e.target as HTMLInputElement).value) || 10,
									),
								),
							)
						}
					/>
				</div>
			</div>

			<div class={sectionCls}>
				<label htmlFor="cs-lapses" class={labelCls}>
					Minimum lapses
				</label>
				<input
					id="cs-lapses"
					type="number"
					class={inputCls}
					min="0"
					step="1"
					value={config.lapsesMin}
					onChange={(e) =>
						updateConfig(
							"lapsesMin",
							Math.max(0, Number((e.target as HTMLInputElement).value) || 0),
						)
					}
				/>
			</div>

			<div class={sectionCls}>
				<label htmlFor="cs-ahead" class={labelCls}>
					Study ahead (days, 0 = off)
				</label>
				<input
					id="cs-ahead"
					type="number"
					class={inputCls}
					min="0"
					step="1"
					value={config.studyAheadDays}
					onChange={(e) =>
						updateConfig(
							"studyAheadDays",
							Math.max(0, Number((e.target as HTMLInputElement).value) || 0),
						)
					}
				/>
			</div>

			<div class={sectionCls}>
				<label htmlFor="cs-order" class={labelCls}>
					Sort order
				</label>
				<select
					id="cs-order"
					class={inputCls}
					value={config.reviewOrder}
					onChange={(e) =>
						updateConfig(
							"reviewOrder",
							(e.target as HTMLSelectElement).value as ReviewOrder,
						)
					}
				>
					{Object.entries(REVIEW_ORDER_LABELS).map(([value, label]) => (
						<option key={value} value={value}>
							{label}
						</option>
					))}
				</select>
			</div>

			<div class={sectionCls}>
				<label htmlFor="cs-limit" class={labelCls}>
					Card limit (0 = no limit)
				</label>
				<input
					id="cs-limit"
					type="number"
					class={inputCls}
					min="0"
					step="10"
					value={config.cardLimit}
					onChange={(e) =>
						updateConfig(
							"cardLimit",
							Math.max(0, Number((e.target as HTMLInputElement).value) || 0),
						)
					}
				/>
			</div>

			<div class={sectionCls}>
				<button
					type="button"
					class="ep:flex ep:items-center ep:gap-2 ep:cursor-pointer ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:text-left ep:w-full"
					onClick={() => updateConfig("crammingMode", !config.crammingMode)}
				>
					<input
						id="cs-cramming"
						type="checkbox"
						class="ep:w-4 ep:h-4"
						checked={config.crammingMode}
						onClick={(e) => e.stopPropagation()}
						onChange={(e) =>
							updateConfig(
								"crammingMode",
								(e.target as HTMLInputElement).checked,
							)
						}
					/>
					<label
						htmlFor="cs-cramming"
						class="ep:text-ui-small ep:text-obs-normal ep:cursor-pointer"
					>
						Cramming mode (no scheduling changes)
					</label>
				</button>
			</div>

			<div class={sectionCls}>
				<label htmlFor="cs-preset" class={labelCls}>
					Save as preset (optional)
				</label>
				<input
					id="cs-preset"
					ref={presetInputRef}
					type="text"
					class={inputCls}
					placeholder="Preset name..."
				/>
			</div>

			<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border">
				<button
					type="button"
					class="ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:hover:bg-obs-modifier-hover"
					onClick={() => onResolve({ cancelled: true })}
				>
					Cancel
				</button>
				<button
					type="button"
					class="mod-cta ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all"
					onClick={handleStart}
				>
					Start session
				</button>
			</div>
		</>
	);
}

export class CustomStudyModal extends BasePromiseModal<CustomStudyModalResult> {
	private studyScope?: CustomStudyModalScope;
	private unmountBody?: () => void;

	constructor(
		app: App,
		options: BaseModalOptions,
		studyScope?: CustomStudyModalScope,
	) {
		super(app, options);
		this.studyScope = studyScope;
	}

	protected getDefaultResult(): CustomStudyModalResult {
		return { cancelled: true };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<CustomStudyBody
				scopeLabel={this.studyScope?.scopeLabel}
				onResolve={(result) => {
					// Attach scope filters from the class-level studyScope
					if (result.sessionResult && this.studyScope) {
						result.sessionResult.projectFilters =
							this.studyScope.projectFilters;
						result.sessionResult.sourceNoteFilters =
							this.studyScope.sourceNoteFilters;
					}
					this.resolve(result);
				}}
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
