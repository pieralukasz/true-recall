import { useCallback, useState } from "preact/hooks";

import { FSRS_CONFIG } from "@true-recall/core/constants";
import type { FSRSPreset } from "@true-recall/core/types";

import {
	ActionButton,
	FormCard,
	FormField,
	InfoBlock,
	TextAreaInput,
} from "@true-recall/obsidian/components";
import { notify } from "@true-recall/obsidian/services/notification.service";

import type { FsrsPluginHost } from "../../../types/plugin-host.types";

interface ParametersSectionProps {
	preset: FSRSPreset;
	/**
	 * Name the preset is stored under. Review history is keyed by name, so
	 * lookups must not follow an unsaved rename in the draft.
	 */
	reviewPresetName: string;
	updatePreset: (c: Partial<FSRSPreset>) => Promise<void>;
	plugin: FsrsPluginHost;
}

export function ParametersSection({
	preset,
	reviewPresetName,
	updatePreset,
	plugin,
}: ParametersSectionProps) {
	const [optimizing, setOptimizing] = useState(false);
	const [showWeights, setShowWeights] = useState(false);

	const presetReviews =
		plugin.cardStore?.stats?.getReviewCountForPreset(reviewPresetName) ?? 0;
	const canOptimize = presetReviews >= FSRS_CONFIG.minReviewsForOptimization;
	const lastOpt = preset.lastOptimization;
	const lastOptCount = preset.lastOptimizationReviewCount;
	const weightsString = preset.weights ? preset.weights.join(", ") : "";

	const handleOptimize = useCallback(async () => {
		setOptimizing(true);
		try {
			const result = await plugin.fsrsHelper?.optimizeParameters(
				undefined,
				reviewPresetName,
				preset.weights,
			);
			if (result && result.metrics.convergenceStatus !== "insufficient_data") {
				await updatePreset({
					weights: result.weights,
					lastOptimization: new Date().toISOString(),
					lastOptimizationReviewCount: result.metrics.reviewCount,
					lastOptimizationMetrics: result.metrics,
				});
				notify().success(
					`Optimization complete (RMSE: ${result.metrics.rmse.toFixed(4)}) — click Save to apply`,
				);
			} else {
				notify().error("Optimization failed: insufficient data");
			}
		} catch (err) {
			notify().error(`Optimization failed: ${String(err)}`);
		} finally {
			setOptimizing(false);
		}
	}, [plugin, preset.weights, reviewPresetName, updatePreset]);

	const handleReset = useCallback(async () => {
		await updatePreset({
			weights: null,
			lastOptimization: null,
			lastOptimizationReviewCount: null,
			lastOptimizationMetrics: null,
		});
		notify().success("Parameters reset to defaults — click Save to apply");
	}, [updatePreset]);

	const handleWeightsChange = useCallback(
		async (value: string) => {
			const trimmed = value.trim();
			if (trimmed === "") {
				await updatePreset({ weights: null });
				return;
			}

			const parts = trimmed.split(",").map((s) => parseFloat(s.trim()));
			const validLengths = [17, 19, 21];
			if (!validLengths.includes(parts.length)) {
				notify().error(
					`Invalid weights count: ${parts.length}. Expected 17, 19, or 21 values.`,
				);
				return;
			}
			if (parts.some((n) => Number.isNaN(n))) {
				notify().error("Invalid weights: some values are not numbers.");
				return;
			}

			await updatePreset({
				weights: parts,
				lastOptimization: new Date().toISOString(),
			});
			notify().success("FSRS weights updated — click Save to apply");
		},
		[updatePreset],
	);

	return (
		<FormCard title="FSRS parameters">
			<InfoBlock class="ep:flex ep:flex-wrap ep:gap-x-6 ep:gap-y-1">
				<span>
					<span class="ep:text-obs-normal ep:font-medium">Reviews</span>{" "}
					{presetReviews.toLocaleString()}
					{!canOptimize &&
						` (need ${FSRS_CONFIG.minReviewsForOptimization}+ to optimize)`}
				</span>
				{lastOpt && (
					<span>
						<span class="ep:text-obs-normal ep:font-medium">Optimized</span>{" "}
						{new Date(lastOpt).toLocaleDateString()}
						{lastOptCount != null &&
							` (${lastOptCount.toLocaleString()} reviews)`}
					</span>
				)}
			</InfoBlock>

			<FormField
				name="Optimize parameters"
				description="Refit the weights to this preset's review history"
			>
				<ActionButton
					label={optimizing ? "Optimizing..." : "Optimize"}
					variant="primary"
					disabled={!canOptimize || optimizing}
					onClick={() => void handleOptimize()}
				/>
				<ActionButton
					label="Reset"
					variant="secondary"
					onClick={() => void handleReset()}
				/>
			</FormField>

			<div class="ep:pt-3">
				<ActionButton
					label={`Weights ${preset.weights ? `(${preset.weights.length} values)` : "(defaults)"}`}
					variant="ghost"
					size="sm"
					icon={showWeights ? "chevron-down" : "chevron-right"}
					class="ep:-ml-2"
					onClick={() => setShowWeights((s) => !s)}
				/>

				{showWeights && (
					<TextAreaInput
						value={weightsString}
						onChange={(value) => void handleWeightsChange(value)}
						placeholder="0.40255, 1.18385, 3.173, 15.69105, ..."
						rows={3}
						class="ep:w-full ep:mt-2 ep:font-mono ep:text-ui-small"
					/>
				)}
			</div>
		</FormCard>
	);
}
