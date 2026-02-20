import { useCallback, useState } from "preact/hooks";
import { useApp } from "../../../shared/ui/preact";
import { usePreset, useSettings } from "../hooks/useSettings";
import {
	PresetSection,
	AlgorithmSection,
	DailyLimitsSection,
	ParametersSection,
	EasyDaysSection,
	LoadBalanceSection,
	SiblingDisperseSection,
	ScheduledBreaksSection,
	BulkOperationsSection,
} from "./fsrs";

interface FSRSTabProps {
	selectedPresetId: string;
	onPresetChange: (id: string) => void;
}

export function FSRSTab({ selectedPresetId, onPresetChange }: FSRSTabProps) {
	const { settings, save, plugin } = useSettings();
	const { preset, updatePreset } = usePreset(selectedPresetId);
	const app = useApp();
	const [version, setVersion] = useState(0);

	const refresh = useCallback(() => setVersion((v) => v + 1), []);

	const presets = settings.fsrsPresets;
	const isDefault = preset.id === settings.defaultPresetId;

	// Force re-read on version changes
	void version;

	// ── Preset CRUD ──

	const handleCreatePreset = useCallback(async () => {
		const newPreset = await plugin.presetService.createPreset({
			name: `${preset.name} (copy)`,
			requestRetention: preset.requestRetention,
			maximumInterval: preset.maximumInterval,
			weights: preset.weights ? [...preset.weights] : null,
			learningSteps: [...preset.learningSteps],
			relearningSteps: [...preset.relearningSteps],
			newCardsPerDay: preset.newCardsPerDay,
			reviewsPerDay: preset.reviewsPerDay,
			lastOptimization: null,
			lastOptimizationReviewCount: null,
			lastOptimizationMetrics: null,
		});
		onPresetChange(newPreset.id);
		refresh();
	}, [plugin, preset, onPresetChange, refresh]);

	const handleDeletePreset = useCallback(async () => {
		await plugin.presetService.deletePreset(preset.id);
		onPresetChange(settings.defaultPresetId);
		refresh();
	}, [plugin, preset.id, settings.defaultPresetId, onPresetChange, refresh]);

	return (
		<>
			<PresetSection
				presets={presets}
				preset={preset}
				isDefault={isDefault}
				selectedPresetId={selectedPresetId}
				onPresetChange={onPresetChange}
				onCreate={handleCreatePreset}
				onDelete={handleDeletePreset}
				onRename={(name) => updatePreset({ name })}
			/>

			<AlgorithmSection preset={preset} updatePreset={updatePreset} />

			<DailyLimitsSection preset={preset} updatePreset={updatePreset} />

			<ParametersSection
				preset={preset}
				updatePreset={updatePreset}
				plugin={plugin}
				onRefresh={refresh}
			/>

			<EasyDaysSection
				plugin={plugin}
				settings={settings}
				save={save}
				app={app}
				onRefresh={refresh}
			/>

			<LoadBalanceSection settings={settings} save={save} plugin={plugin} />

			<SiblingDisperseSection settings={settings} save={save} plugin={plugin} />

			<ScheduledBreaksSection
				settings={settings}
				save={save}
				onRefresh={refresh}
			/>

			<BulkOperationsSection plugin={plugin} />
		</>
	);
}
