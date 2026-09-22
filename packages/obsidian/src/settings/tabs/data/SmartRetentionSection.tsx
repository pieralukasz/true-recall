import type { RetentionPolicy } from "@true-recall/core/types/settings.types";

import {
	FormCard,
	FormField,
	InfoBlock,
	SliderInput,
} from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";

import { useSettings } from "../../hooks/useSettings";

interface RetentionPolicySliderProps {
	name: string;
	description: string;
	field: keyof RetentionPolicy;
	policy: RetentionPolicy;
	max: number;
	onSave: (policy: RetentionPolicy) => void;
}

function RetentionPolicySlider({
	name,
	description,
	field,
	policy,
	max,
	onSave,
}: RetentionPolicySliderProps) {
	return (
		<FormField name={name} description={description}>
			<SliderInput
				value={policy[field]}
				onChange={(v) => onSave({ ...policy, [field]: v })}
				min={0}
				max={max}
				step={1}
			/>
		</FormField>
	);
}

export function SmartRetentionSection() {
	const { settings, save } = useSettings();
	const { hourlyBackupsToKeep, dailyBackupsToKeep, weeklyBackupsToKeep } =
		settings.retentionPolicy;

	const handleSave = (retentionPolicy: RetentionPolicy) =>
		void save({ retentionPolicy });

	return (
		<FormCard title={t("Smart retention")}>
			<InfoBlock>
				<p>
					{t(
						"Multi-tier retention keeps recent backups densely and older ones sparsely.",
					)}
				</p>
				<p>
					{t("Current policy:")}{" "}
					<strong>
						{hourlyBackupsToKeep}
						{t("h /")}
						{dailyBackupsToKeep}
						{t("d /")} {weeklyBackupsToKeep}
						{t("w")}
					</strong>
				</p>
			</InfoBlock>

			<RetentionPolicySlider
				name={t("Hourly backups")}
				description={t(
					"Keep one backup per hour for the last N hours (0 = disabled)",
				)}
				field="hourlyBackupsToKeep"
				policy={settings.retentionPolicy}
				max={48}
				onSave={handleSave}
			/>

			<RetentionPolicySlider
				name={t("Daily backups")}
				description={t(
					"Keep one backup per day for the last N days (0 = disabled)",
				)}
				field="dailyBackupsToKeep"
				policy={settings.retentionPolicy}
				max={30}
				onSave={handleSave}
			/>

			<RetentionPolicySlider
				name={t("Weekly backups")}
				description={t(
					"Keep one backup per week for the last N weeks (0 = disabled)",
				)}
				field="weeklyBackupsToKeep"
				policy={settings.retentionPolicy}
				max={12}
				onSave={handleSave}
			/>
		</FormCard>
	);
}
