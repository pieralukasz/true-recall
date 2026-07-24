import { FormCard } from "@true-recall/obsidian/components";
import type { CustomStudyConfig } from "@true-recall/obsidian/modals/study/custom-study/hooks/useCustomStudyConfig";
import { NumberField } from "@true-recall/obsidian/modals/study/custom-study/NumberField";
import { PreviewNotice } from "@true-recall/obsidian/modals/study/custom-study/PreviewNotice";
import { StateOrTagDetails } from "@true-recall/obsidian/modals/study/custom-study/StateOrTagDetails";

interface CustomStudyDetailsProps {
	config: CustomStudyConfig;
	availableTags: string[];
	onChange: <K extends keyof CustomStudyConfig>(
		key: K,
		value: CustomStudyConfig[K],
	) => void;
}

export function CustomStudyDetails({
	config,
	availableTags,
	onChange,
}: CustomStudyDetailsProps) {
	const simpleField = {
		"increase-new": {
			id: "cs-new-limit",
			label: "Increase today's new card limit by",
			description: "cards",
			value: config.amount,
			key: "amount" as const,
		},
		"increase-review": {
			id: "cs-review-limit",
			label: "Increase today's review card limit by",
			description: "cards",
			value: config.amount,
			key: "amount" as const,
		},
		forgotten: {
			id: "cs-forgotten-days",
			label: "Review cards forgotten in last",
			description: "days",
			value: config.days,
			key: "days" as const,
			max: 30,
		},
		"review-ahead": {
			id: "cs-ahead-days",
			label: "Review ahead by",
			description: "days",
			value: config.days,
			key: "days" as const,
		},
		"preview-new": {
			id: "cs-preview-days",
			label: "Preview new cards added in the last",
			description: "days",
			value: config.days,
			key: "days" as const,
		},
	};

	const field =
		config.mode === "state-or-tag" ? null : simpleField[config.mode];
	const preview = config.mode === "forgotten" || config.mode === "preview-new";

	return (
		<FormCard title="" class="ep:mt-4">
			{field ? (
				<NumberField
					id={field.id}
					label={field.label}
					description={field.description}
					value={field.value}
					onChange={(value) => onChange(field.key, value)}
					min={1}
					max={config.mode === "forgotten" ? 30 : undefined}
				/>
			) : (
				<StateOrTagDetails
					config={config}
					availableTags={availableTags}
					onChange={onChange}
				/>
			)}
			{preview ? <PreviewNotice /> : null}
		</FormCard>
	);
}
