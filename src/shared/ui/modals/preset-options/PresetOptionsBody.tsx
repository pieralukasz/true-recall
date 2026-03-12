import type { FSRSPreset } from "@shared/types";
import { Clickable } from "@shared/ui/components/Clickable";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useMemo, useState } from "preact/hooks";
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
	const [applyToChildren, setApplyToChildren] = useState(false);
	const [isApplying, setIsApplying] = useState(false);

	const hasChildren = useMemo(() => {
		if (!context?.contextPath) return false;
		return (
			plugin.hierarchyService.getChildPaths(context.contextPath).length > 0
		);
	}, [plugin, context?.contextPath]);

	const getDescendantProjectPaths = useCallback(
		(rootPath: string): string[] => {
			const result: string[] = [];
			const visited = new Set<string>();
			const collect = (path: string) => {
				for (const child of plugin.hierarchyService.getChildPaths(path)) {
					if (visited.has(child)) continue;
					visited.add(child);
					const isProject =
						plugin.hierarchyService.getChildPaths(child).length > 0;
					if (isProject) {
						result.push(child);
						collect(child);
					}
				}
			};
			collect(rootPath);
			return result;
		},
		[plugin],
	);

	// Re-read on version bump
	void version;
	const presets = settings.fsrsPresets;
	const preset = presets.find((p) => p.id === selectedPresetId) ?? presets[0];
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

	const handleDone = useCallback(async () => {
		const frontmatterService = plugin.flashcardManager?.getFrontmatterService();
		if (context?.contextPath && frontmatterService) {
			const file = plugin.app.vault.getFileByPath(context.contextPath);
			if (file) {
				await frontmatterService.setFsrsPreset(file, preset.name);
			}

			if (applyToChildren) {
				const descendantPaths = getDescendantProjectPaths(context.contextPath);
				setIsApplying(true);
				try {
					await Promise.all(
						descendantPaths.map((path) => {
							const f = plugin.app.vault.getFileByPath(path);
							return f
								? frontmatterService.setFsrsPreset(f, preset.name)
								: Promise.resolve();
						}),
					);
				} finally {
					onClose();
				}
				return;
			}
		}
		onClose();
	}, [
		plugin,
		context,
		preset.name,
		onClose,
		applyToChildren,
		getDescendantProjectPaths,
	]);

	return (
		<div class="ep:flex ep:flex-col ep:flex-1 ep:min-h-0">
			<div class="ep:flex-1 ep:overflow-y-auto ep:min-h-0">
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
			</div>

			<div class="ep-modal-footer ep:flex ep:items-center ep:justify-between ep:gap-2 ep:pt-3 ep:mt-2 ep:border-t ep:border-obs-border">
				{hasChildren && context?.contextPath ? (
					<label class="ep:flex ep:items-center ep:gap-2 ep:cursor-pointer ep:text-ui-small ep:text-obs-muted">
						<input
							type="checkbox"
							checked={applyToChildren}
							disabled={isApplying}
							onChange={(e) =>
								setApplyToChildren((e.target as HTMLInputElement).checked)
							}
						/>
						Apply to child projects
					</label>
				) : (
					<div />
				)}
				<Clickable
					class="ep-btn mod-cta ep:text-ui-small"
					onClick={() => void handleDone()}
					stopPropagation={false}
					disabled={isApplying}
				>
					{isApplying ? "Applying..." : "Done"}
				</Clickable>
			</div>
		</div>
	);
}
