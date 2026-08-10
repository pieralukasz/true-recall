import type { CustomStudyMode } from "@true-recall/obsidian/modals/study/custom-study/hooks/useCustomStudyConfig";

const OPTIONS: { value: CustomStudyMode; label: string }[] = [
	{ value: "increase-new", label: "Increase today's new card limit" },
	{ value: "increase-review", label: "Increase today's review card limit" },
	{ value: "forgotten", label: "Review forgotten cards" },
	{ value: "actual-learning", label: "Review actual learning" },
	{ value: "review-ahead", label: "Review ahead" },
	{ value: "preview-new", label: "Preview new cards" },
	{ value: "state-or-tag", label: "Study by card state or tag" },
];

interface CustomStudyOptionsProps {
	value: CustomStudyMode;
	onChange: (value: CustomStudyMode) => void;
}

export function CustomStudyOptions({
	value,
	onChange,
}: CustomStudyOptionsProps) {
	return (
		<fieldset class="ep:flex ep:flex-col ep:gap-2 ep:border-0 ep:p-0 ep:m-0">
			<legend class="ep:sr-only">Custom study type</legend>
			{OPTIONS.map((option) => (
				<label
					key={option.value}
					class="ep:flex ep:items-center ep:gap-3 ep:px-2 ep:py-1.5 ep:rounded-md ep:cursor-pointer ep:hover:bg-obs-modifier-hover"
				>
					<input
						type="radio"
						name="custom-study-mode"
						value={option.value}
						checked={value === option.value}
						onChange={() => onChange(option.value)}
					/>
					<span class="ep:text-ui-small ep:text-obs-normal">
						{option.label}
					</span>
				</label>
			))}
		</fieldset>
	);
}
