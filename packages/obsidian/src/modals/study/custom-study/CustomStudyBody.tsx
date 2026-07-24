import { ModalFooter } from "@true-recall/obsidian/components";
import { CustomStudyDetails } from "@true-recall/obsidian/modals/study/custom-study/CustomStudyDetails";
import { CustomStudyOptions } from "@true-recall/obsidian/modals/study/custom-study/CustomStudyOptions";
import { useCustomStudyConfig } from "@true-recall/obsidian/modals/study/custom-study/hooks/useCustomStudyConfig";
import type { CustomStudyModalResult } from "@true-recall/obsidian/modals/study/custom-study/types";

interface CustomStudyBodyProps {
	scopeLabel?: string;
	availableTags?: string[];
	onResolve: (result: CustomStudyModalResult) => void;
}

export function CustomStudyBody({
	scopeLabel,
	availableTags = [],
	onResolve,
}: CustomStudyBodyProps) {
	const { config, updateConfig, buildResult } = useCustomStudyConfig();

	return (
		<>
			{scopeLabel ? (
				<div class="ep:mb-4 ep:flex ep:items-center ep:gap-2">
					<span class="ep:text-ui-smaller ep:font-medium ep:px-2.5 ep:py-1 ep:rounded-full ep:bg-obs-accent/15 ep:text-obs-accent">
						{scopeLabel}
					</span>
				</div>
			) : null}

			<CustomStudyOptions
				value={config.mode}
				onChange={(mode) => updateConfig("mode", mode)}
			/>

			<CustomStudyDetails
				config={config}
				availableTags={availableTags}
				onChange={updateConfig}
			/>

			<ModalFooter
				onCancel={() => onResolve({ cancelled: true })}
				onConfirm={() => onResolve(buildResult())}
				confirmLabel="Start session"
			/>
		</>
	);
}
