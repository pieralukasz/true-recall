import { useCustomStudyConfig } from "@features/study/modals/custom-study/hooks/useCustomStudyConfig";
import {
	INPUT_CLS,
	LABEL_CLS,
	NumberField,
	SECTION_CLS,
} from "@features/study/modals/custom-study/NumberField";
import type { CustomStudyModalResult } from "@features/study/modals/custom-study/types";
import type { ReviewOrder } from "@shared/types/settings.types";
import { Clickable } from "@shared/ui/components";
import { ModalFooter } from "@shared/ui/components/ModalFooter";
import { useRef } from "preact/hooks";

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

export interface CustomStudyBodyProps {
	scopeLabel?: string;
	onResolve: (result: CustomStudyModalResult) => void;
}

export function CustomStudyBody({
	scopeLabel,
	onResolve,
}: CustomStudyBodyProps) {
	const { config, updateConfig, buildResult } = useCustomStudyConfig();
	const presetInputRef = useRef<HTMLInputElement>(null);

	const handleStart = () => {
		const presetName = presetInputRef.current?.value.trim();
		onResolve(buildResult(presetName));
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

			<div class={SECTION_CLS}>
				<label htmlFor="cs-state" class={LABEL_CLS}>
					Card state
				</label>
				<select
					id="cs-state"
					class={INPUT_CLS}
					value={config.stateFilter}
					onChange={(e) =>
						updateConfig(
							"stateFilter",
							(e.target as HTMLSelectElement).value as
								| "all"
								| "new"
								| "learning"
								| "due",
						)
					}
				>
					<option value="all">All states</option>
					<option value="new">New only</option>
					<option value="learning">Learning only</option>
					<option value="due">Due only</option>
				</select>
			</div>

			<div class={SECTION_CLS}>
				<span class={LABEL_CLS}>Difficulty range (1-10)</span>
				<div class="ep:flex ep:gap-2 ep:items-center">
					<input
						type="number"
						class={INPUT_CLS}
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
						class={INPUT_CLS}
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

			<NumberField
				id="cs-lapses"
				label="Minimum lapses"
				value={config.lapsesMin}
				onChange={(v) => updateConfig("lapsesMin", v)}
				min={0}
				step={1}
			/>

			<NumberField
				id="cs-ahead"
				label="Study ahead (days, 0 = off)"
				value={config.studyAheadDays}
				onChange={(v) => updateConfig("studyAheadDays", v)}
				min={0}
				step={1}
			/>

			<div class={SECTION_CLS}>
				<label htmlFor="cs-order" class={LABEL_CLS}>
					Sort order
				</label>
				<select
					id="cs-order"
					class={INPUT_CLS}
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

			<NumberField
				id="cs-limit"
				label="Card limit (0 = no limit)"
				value={config.cardLimit}
				onChange={(v) => updateConfig("cardLimit", v)}
				min={0}
				step={10}
			/>

			<div class={SECTION_CLS}>
				<Clickable
					class="ep:flex ep:items-center ep:gap-2 ep:p-0 ep:text-left ep:w-full"
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
				</Clickable>
			</div>

			<div class={SECTION_CLS}>
				<label htmlFor="cs-preset" class={LABEL_CLS}>
					Save as preset (optional)
				</label>
				<input
					id="cs-preset"
					ref={presetInputRef}
					type="text"
					class={INPUT_CLS}
					placeholder="Preset name..."
				/>
			</div>

			<ModalFooter
				onCancel={() => onResolve({ cancelled: true })}
				onConfirm={handleStart}
				confirmLabel="Start session"
			/>
		</>
	);
}
