import type { RetentionPolicy } from "../../../../shared/types/settings.types";
import {
	InfoBlock,
	SettingRow,
	SliderInput,
} from "../../../../shared/ui/components";
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
		<SettingRow name={name} description={description}>
			<SliderInput
				value={policy[field]}
				onChange={(v) => onSave({ ...policy, [field]: v })}
				min={0}
				max={max}
				step={1}
			/>
		</SettingRow>
	);
}

export function SmartRetentionSection() {
	const { settings, save } = useSettings();
	const { hourlyBackupsToKeep, dailyBackupsToKeep, weeklyBackupsToKeep } =
		settings.retentionPolicy;

	const handleSave = (retentionPolicy: RetentionPolicy) =>
		save({ retentionPolicy });

	return (
		<>
			<SettingRow heading name="Smart retention" />

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
		</>
	);
}
