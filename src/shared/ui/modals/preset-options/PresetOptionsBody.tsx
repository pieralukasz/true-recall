import type { FSRSPreset } from "@shared/types";
import { Clickable } from "@shared/ui/components/Clickable";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useState } from "preact/hooks";
import { DailyLimitsSection } from "./DailyLimitsSection";
import { LapsesSection } from "./LapsesSection";
import { NewCardsSection } from "./NewCardsSection";
import { ParametersSection } from "./ParametersSection";
import { PresetSelector } from "./PresetSelector";
import { SchedulingSection } from "./SchedulingSection";
import { UsageSection } from "./UsageSection";

export interface PresetOptionsContext {
	contextPath?: string;
	contextName?: string;
}

interface PresetOptionsBodyProps {
	initialPresetId?: string;
	context?: PresetOptionsContext;
	onClose: () => void;
}

export function PresetOptionsBody({
	initialPresetId,
	context,
	onClose,
}: PresetOptionsBodyProps) {
	const plugin = usePlugin();
	const settings = plugin.settings;

	const [selectedPresetId, setSelectedPresetId] = useState(
		initialPresetId ?? settings.defaultPresetId,
	);
	const [version, setVersion] = useState(0);

	// Re-read on version bump
	void version;
	const presets = settings.fsrsPresets;
	const preset =
		presets.find((p) => p.id === selectedPresetId) ?? presets[0];
	if (!preset) return null;

	const isDefault = preset.id === settings.defaultPresetId;

	const updatePreset = useCallback(
		async (changes: Partial<FSRSPreset>) => {
			await plugin.presetService.updatePreset(preset.id, changes);
			setVersion((v) => v + 1);
		},
		[plugin, preset.id],
	);

	const refresh = useCallback(() => setVersion((v) => v + 1), []);

	const handleCreate = useCallback(async () => {
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
			leechThreshold: preset.leechThreshold,
			leechAction: preset.leechAction,
			newCardOrder: preset.newCardOrder,
			reviewOrder: preset.reviewOrder,
			newReviewMix: preset.newReviewMix,
		});
		setSelectedPresetId(newPreset.id);
		refresh();
	}, [plugin, preset, refresh]);

	const handleDelete = useCallback(async () => {
		await plugin.presetService.deletePreset(preset.id);
		setSelectedPresetId(settings.defaultPresetId);
		refresh();
	}, [plugin, preset.id, settings.defaultPresetId, refresh]);

	const handleSetForContext = useCallback(async () => {
		if (!context?.contextPath) return;
		const file = plugin.app.vault.getFileByPath(context.contextPath);
		if (!file) return;

		const frontmatterService =
			plugin.flashcardManager?.getFrontmatterService();
		if (!frontmatterService) return;

		await frontmatterService.setFsrsPreset(file, preset.name);
		refresh();
	}, [plugin, context, preset.name, refresh]);

	return (
		<div class="ep:max-h-[70vh] ep:overflow-y-auto">
			<PresetSelector
				presets={presets}
				preset={preset}
				isDefault={isDefault}
				onPresetChange={setSelectedPresetId}
				onCreate={handleCreate}
				onDelete={handleDelete}
				onRename={(name) => void updatePreset({ name })}
			/>

			<DailyLimitsSection preset={preset} updatePreset={updatePreset} />
			<NewCardsSection preset={preset} updatePreset={updatePreset} />
			<LapsesSection preset={preset} updatePreset={updatePreset} />
			<SchedulingSection preset={preset} updatePreset={updatePreset} />
			<ParametersSection
				preset={preset}
				updatePreset={updatePreset}
				plugin={plugin}
				onRefresh={refresh}
			/>
			<UsageSection preset={preset} />

			<div class="ep-modal-footer ep:flex ep:items-center ep:justify-between ep:gap-2 ep:pt-3 ep:mt-2 ep:border-t ep:border-obs-border">
				{context?.contextPath && (
					<Clickable
						class="ep-btn ep-btn-outline ep:text-ui-small"
						onClick={handleSetForContext}
						stopPropagation={false}
					>
						Set for {context.contextName ?? "this note"}
					</Clickable>
				)}
				<div class="ep:flex-1" />
				<Clickable
					class="ep-btn mod-cta ep:text-ui-small"
					onClick={onClose}
					stopPropagation={false}
				>
					Done
				</Clickable>
			</div>
		</div>
	);
}
