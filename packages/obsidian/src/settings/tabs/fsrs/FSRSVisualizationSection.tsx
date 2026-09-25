import {
	ActionButton,
	FormCard,
	FormField,
	InfoBlock,
} from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";
import type TrueRecallPlugin from "@true-recall/obsidian/main";

interface FSRSVisualizationSectionProps {
	plugin: TrueRecallPlugin;
}

export function FSRSVisualizationSection({
	plugin,
}: FSRSVisualizationSectionProps) {
	return (
		<FormCard title={t("FSRS visualization")}>
			<InfoBlock>
				<p>
					{t("FSRS schedules cards using three predicted variables —")}{" "}
					<strong>{t("stability")}</strong> {t("(how long memory lasts),")}{" "}
					<strong>{t("difficulty")}</strong>{" "}
					{t("(per-card forgetting rate), and")}{" "}
					<strong>{t("retrievability")}</strong>{" "}
					{t(
						"(probability of recall right now). Intervals are picked so retrievability stays close to your target retention.",
					)}
				</p>
				<p>
					{t(
						"Open the Simulator to play with parameters, sequences, and target retention, and to see how scheduling reacts before you change anything in your live presets.",
					)}
				</p>
			</InfoBlock>

			<FormField
				name={t("Open FSRS Simulator")}
				description={t(
					"Interactive what-if tool: tweak weights and watch projected retention, workload and review count over time",
				)}
			>
				<ActionButton
					label={t("Open Simulator")}
					variant="secondary"
					class="ep:whitespace-nowrap"
					onClick={() => void plugin.openSimulator()}
				/>
			</FormField>
		</FormCard>
	);
}
