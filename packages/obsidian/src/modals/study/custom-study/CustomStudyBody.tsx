import { useCustomStudyConfig } from "@features/study/modals/custom-study/hooks/useCustomStudyConfig";
import { NumberField } from "@features/study/modals/custom-study/NumberField";
import type { CustomStudyModalResult } from "@features/study/modals/custom-study/types";
import type { ReviewOrder } from "@shared/types/settings.types";
import {
	Clickable,
	FormCard,
	FormField,
	SelectInput,
} from "@shared/ui/components";
import { ModalFooter } from "@shared/ui/components/ModalFooter";
import { useRef } from "preact/hooks";

const REVIEW_ORDER_OPTIONS = [
	{ value: "due-date", label: "Due date" },
	{ value: "random", label: "Random" },
	{ value: "due-date-random", label: "Due date (randomized)" },
	{ value: "by-retrievability", label: "Retrievability" },
	{ value: "most-lapses", label: "Most lapses" },
	{ value: "relative-overdueness", label: "Relative overdueness" },
	{ value: "lowest-stability", label: "Lowest stability" },
	{ value: "order-added", label: "Order added" },
];

const STATE_FILTER_OPTIONS = [
	{ value: "all", label: "All states" },
	{ value: "new", label: "New only" },
	{ value: "learning", label: "Learning only" },
	{ value: "due", label: "Due only" },
];

const NUM_INPUT_CLS =
	"ep:w-16 ep:py-1.5 ep:px-2 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:text-right";

const PRESET_INPUT_CLS =
	"ep:w-full ep:py-1.5 ep:px-2.5 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted";

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

			<FormCard title="Filters">
				<FormField name="Card state">
					<SelectInput
						value={config.stateFilter}
						onChange={(v) =>
							updateConfig(
								"stateFilter",
								v as "all" | "new" | "learning" | "due",
							)
						}
						options={STATE_FILTER_OPTIONS}
					/>
				</FormField>

				<FormField name="Difficulty range" description="1-10">
					<div class="ep:flex ep:gap-2 ep:items-center">
						<input
							type="number"
							class={NUM_INPUT_CLS}
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
							class={NUM_INPUT_CLS}
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
				</FormField>

				<NumberField
					id="cs-lapses"
					label="Minimum lapses"
					value={config.lapsesMin}
					onChange={(v) => updateConfig("lapsesMin", v)}
					min={0}
					step={1}
				/>
			</FormCard>

			<FormCard title="Session" class="ep:mt-4">
				<FormField name="Sort order">
					<SelectInput
						value={config.reviewOrder}
						onChange={(v) => updateConfig("reviewOrder", v as ReviewOrder)}
						options={REVIEW_ORDER_OPTIONS}
					/>
				</FormField>

				<NumberField
					id="cs-ahead"
					label="Study ahead"
					description="Days (0 = off)"
					value={config.studyAheadDays}
					onChange={(v) => updateConfig("studyAheadDays", v)}
					min={0}
					step={1}
				/>

				<NumberField
					id="cs-limit"
					label="Card limit"
					description="0 = no limit"
					value={config.cardLimit}
					onChange={(v) => updateConfig("cardLimit", v)}
					min={0}
					step={10}
				/>

				<FormField name="Cramming mode" description="No scheduling changes">
					<Clickable
						class="ep:flex ep:items-center ep:gap-2 ep:p-0"
						onClick={() => updateConfig("crammingMode", !config.crammingMode)}
					>
						<input
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
					</Clickable>
				</FormField>
			</FormCard>

			<FormField name="Save as preset" description="Optional" class="ep:mt-4">
				<input
					id="cs-preset"
					ref={presetInputRef}
					type="text"
					class={PRESET_INPUT_CLS}
					placeholder="Preset name..."
				/>
			</FormField>

			<ModalFooter
				onCancel={() => onResolve({ cancelled: true })}
				onConfirm={handleStart}
				confirmLabel="Start session"
			/>
		</>
	);
}
