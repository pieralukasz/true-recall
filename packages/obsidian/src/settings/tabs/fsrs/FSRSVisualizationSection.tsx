import type TrueRecallPlugin from "@true-recall/obsidian/main";

import {
	ActionButton,
	FormCard,
	FormField,
	InfoBlock,
} from "@true-recall/obsidian/components";

interface FSRSVisualizationSectionProps {
	plugin: TrueRecallPlugin;
}

export function FSRSVisualizationSection({
	plugin,
}: FSRSVisualizationSectionProps) {
	return (
		<FormCard title="FSRS visualization">
			<InfoBlock>
				<p>
					FSRS schedules cards using three predicted variables —{" "}
					<strong>stability</strong> (how long memory lasts),{" "}
					<strong>difficulty</strong> (per-card forgetting rate), and{" "}
					<strong>retrievability</strong> (probability of recall right now).
					Intervals are picked so retrievability stays close to your target
					retention.
				</p>
				<p>
					Open the Simulator to play with parameters, sequences, and target
					retention, and to see how scheduling reacts before you change anything
					in your live presets.
				</p>
			</InfoBlock>

			<FormField
				name="Open FSRS Simulator"
				description="Interactive what-if tool: tweak weights and watch projected retention, workload and review count over time"
			>
				<ActionButton
					label="Open Simulator"
					variant="secondary"
					onClick={() => void plugin.openSimulator()}
				/>
			</FormField>
		</FormCard>
	);
}
