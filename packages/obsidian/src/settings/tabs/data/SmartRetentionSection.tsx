import { useSettings } from "../../hooks/useSettings";
import type { RetentionPolicy } from "@true-recall/core/types/settings.types";
import {
	FormCard,
	FormField,
	InfoBlock,
	SliderInput,
} from "@true-recall/obsidian/components";

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
		<FormCard title="Smart retention">
			<InfoBlock>
				<p>
					Multi-tier retention keeps recent backups densely and older ones
					sparsely.
				</p>
				<p>
					Current policy:{" "}
					<strong>
						{hourlyBackupsToKeep}h / {dailyBackupsToKeep}d /{" "}
						{weeklyBackupsToKeep}w
					</strong>
				</p>
			</InfoBlock>

			<RetentionPolicySlider
				name="Hourly backups"
				description="Keep one backup per hour for the last N hours (0 = disabled)"
				field="hourlyBackupsToKeep"
				policy={settings.retentionPolicy}
				max={48}
				onSave={handleSave}
			/>

			<RetentionPolicySlider
				name="Daily backups"
				description="Keep one backup per day for the last N days (0 = disabled)"
				field="dailyBackupsToKeep"
				policy={settings.retentionPolicy}
				max={30}
				onSave={handleSave}
			/>

			<RetentionPolicySlider
				name="Weekly backups"
				description="Keep one backup per week for the last N weeks (0 = disabled)"
				field="weeklyBackupsToKeep"
				policy={settings.retentionPolicy}
				max={12}
				onSave={handleSave}
			/>
		</FormCard>
	);
}
