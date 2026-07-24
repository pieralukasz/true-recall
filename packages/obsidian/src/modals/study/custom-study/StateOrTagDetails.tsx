import type { CustomStudyCardState } from "@true-recall/core/types/review-session.types";

import { FormField, SelectInput } from "@true-recall/obsidian/components";
import type { CustomStudyConfig } from "@true-recall/obsidian/modals/study/custom-study/hooks/useCustomStudyConfig";
import { NumberField } from "@true-recall/obsidian/modals/study/custom-study/NumberField";
import { PreviewNotice } from "@true-recall/obsidian/modals/study/custom-study/PreviewNotice";

const STATE_OPTIONS = [
	{ value: "new", label: "New cards only" },
	{ value: "due", label: "Due cards only" },
	{ value: "review", label: "All review cards in random order" },
	{ value: "all", label: "All cards in random order (no rescheduling)" },
];

const TEXT_INPUT_CLS =
	"ep:w-full ep:py-1.5 ep:px-2.5 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive";

interface StateOrTagDetailsProps {
	config: CustomStudyConfig;
	availableTags: string[];
	onChange: <K extends keyof CustomStudyConfig>(
		key: K,
		value: CustomStudyConfig[K],
	) => void;
}

export function StateOrTagDetails({
	config,
	availableTags,
	onChange,
}: StateOrTagDetailsProps) {
	return (
		<>
			<NumberField
				id="cs-card-limit"
				label="Select"
				description="cards from the current scope"
				value={config.cardLimit}
				onChange={(value) => onChange("cardLimit", value)}
				min={1}
			/>
			<FormField name="Card state">
				<SelectInput
					value={config.cardState}
					onChange={(value) =>
						onChange("cardState", value as CustomStudyCardState)
					}
					options={STATE_OPTIONS}
				/>
			</FormField>
			<TagField
				label="Include tags"
				description="Any match; comma-separated"
				value={config.includeTags}
				onChange={(value) => onChange("includeTags", value)}
			/>
			<TagField
				label="Exclude tags"
				description="Comma-separated"
				value={config.excludeTags}
				onChange={(value) => onChange("excludeTags", value)}
			/>
			<datalist id="custom-study-tags">
				{availableTags.map((tag) => (
					<option key={tag} value={tag} />
				))}
			</datalist>
			{config.cardState === "all" ? <PreviewNotice /> : null}
		</>
	);
}

function TagField({
	label,
	description,
	value,
	onChange,
}: {
	label: string;
	description: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<FormField name={label} description={description}>
			<input
				type="text"
				class={TEXT_INPUT_CLS}
				value={value}
				list="custom-study-tags"
				onInput={(event) => onChange((event.target as HTMLInputElement).value)}
			/>
		</FormField>
	);
}
