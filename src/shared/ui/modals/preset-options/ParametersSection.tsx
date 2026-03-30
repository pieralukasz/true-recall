import { FSRS_CONFIG } from "@shared/constants";
import { notify } from "@shared/services/notification.service";
import type { FSRSPreset } from "@shared/types";
import type { FsrsPluginHost } from "../../../types/plugin-host.types";
import {
	ActionButton,
	FormCard,
	FormField,
	InfoBlock,
	TextAreaInput,
} from "@shared/ui/components";
import { Clickable } from "@shared/ui/components/Clickable";
import { useCallback, useState } from "preact/hooks";

interface ParametersSectionProps {
	preset: FSRSPreset;
	updatePreset: (c: Partial<FSRSPreset>) => Promise<void>;
	plugin: FsrsPluginHost;
	onRefresh: () => void;
}

export function ParametersSection({
	preset,
	updatePreset,
	plugin,
	onRefresh,
}: ParametersSectionProps) {
	const [optimizing, setOptimizing] = useState(false);
	const [showWeights, setShowWeights] = useState(false);

	const presetReviews =
		plugin.cardStore?.stats?.getReviewCountForPreset(preset.name) ?? 0;
	const canOptimize = presetReviews >= FSRS_CONFIG.minReviewsForOptimization;
	const lastOpt = preset.lastOptimization;
	const lastOptCount = preset.lastOptimizationReviewCount;
	const weightsString = preset.weights ? preset.weights.join(", ") : "";

	const handleOptimize = useCallback(async () => {
		setOptimizing(true);
		try {
			const result = await plugin.fsrsHelper?.optimizeParameters(
				undefined,
				preset.name,
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
					`Optimization complete! RMSE: ${result.metrics.rmse.toFixed(4)}`,
				);
				onRefresh();
			} else {
				notify().error("Optimization failed: insufficient data");
			}
		} catch (err) {
			notify().error(`Optimization failed: ${String(err)}`);
		} finally {
			setOptimizing(false);
		}
	}, [plugin, preset, updatePreset, onRefresh]);

	const handleReset = useCallback(async () => {
		await updatePreset({
			weights: null,
			lastOptimization: null,
			lastOptimizationReviewCount: null,
			lastOptimizationMetrics: null,
		});
		notify().success("Parameters reset to defaults");
		onRefresh();
	}, [updatePreset, onRefresh]);

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
			notify().success("FSRS weights saved!");
		},
		[updatePreset],
	);

	return (
		<FormCard title="FSRS parameters">
			<InfoBlock>
				<p>
					<strong>Reviews: </strong>
					{presetReviews.toLocaleString()}{" "}
					{canOptimize
						? ""
						: `(need ${FSRS_CONFIG.minReviewsForOptimization}+ to optimize)`}
					{lastOpt && (
						<>
							{" \u00B7 "}
							<strong>Optimized: </strong>
							{new Date(lastOpt).toLocaleDateString()}
							{lastOptCount != null &&
								` (${lastOptCount.toLocaleString()} reviews)`}
						</>
					)}
				</p>
			</InfoBlock>

			<FormField name="Optimize parameters">
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

			<div class="ep:pb-2">
				<Clickable
					class="ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal ep:transition-colors"
					onClick={() => setShowWeights((s) => !s)}
				>
					{showWeights ? "\u25BC" : "\u25B6"} Weights{" "}
					{preset.weights ? `(${preset.weights.length} values)` : "(defaults)"}
				</Clickable>

				{showWeights && (
					<div class="ep:mt-2">
						<TextAreaInput
							value={weightsString}
							onChange={(value) => void handleWeightsChange(value)}
							placeholder="0.40255, 1.18385, 3.173, 15.69105, ..."
							rows={3}
							class="ep:w-full ep:font-mono ep:text-ui-small"
						/>
					</div>
				)}
			</div>
		</FormCard>
	);
}
