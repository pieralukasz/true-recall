import type { FSRSPreset, LeechAction } from "@shared/types";
import { FormCard, FormField, SelectInput, TextInput } from "@shared/ui/components";

interface LapsesSectionProps {
	preset: FSRSPreset;
	updatePreset: (c: Partial<FSRSPreset>) => Promise<void>;
}

const LEECH_ACTION_OPTIONS = [
	{ value: "tag-only", label: "Tag only" },
	{ value: "suspend", label: "Suspend card" },
];

export function LapsesSection({
	preset,
	updatePreset,
}: LapsesSectionProps) {
	return (
		<FormCard title="Lapses">
			<FormField
				name="Relearning steps (minutes)"
				description="Steps after a lapse (Again on a review card). Leave empty to skip relearning."
			>
				<TextInput
					value={preset.relearningSteps.join(", ")}
					onChange={(v) => {
						const trimmed = v.trim();
						if (trimmed === "") {
							void updatePreset({ relearningSteps: [] });
							return;
						}
						const steps = trimmed
							.split(",")
							.map((s) => parseFloat(s.trim()))
							.filter((n) => !Number.isNaN(n) && n > 0);
						void updatePreset({ relearningSteps: steps });
					}}
					placeholder="10"
				/>
			</FormField>

			<FormField
				name="Leech threshold"
				description="Number of lapses before a card is flagged as a leech (0 = disabled)"
			>
				<TextInput
					value={String(preset.leechThreshold ?? 8)}
					onChange={(v) => {
						const num = parseInt(v, 10);
						if (!Number.isNaN(num)) {
							void updatePreset({
								leechThreshold: Math.max(0, num),
							});
						}
					}}
					placeholder="8"
				/>
			</FormField>

			<FormField
				name="Leech action"
				description="What happens when a card exceeds the leech threshold"
			>
				<SelectInput
					value={preset.leechAction ?? "tag-only"}
					onChange={(v) =>
						void updatePreset({ leechAction: v as LeechAction })
					}
					options={LEECH_ACTION_OPTIONS}
				/>
			</FormField>
		</FormCard>
	);
}
