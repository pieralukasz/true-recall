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
					FSRS parameters affect how cards are scheduled. You can optimize them
					based on your review history.
				</p>
				<p>
					<strong>Current reviews: </strong>
					{presetReviews.toLocaleString()}{" "}
					{canOptimize
						? "(ready for optimization)"
						: `(need ${FSRS_CONFIG.minReviewsForOptimization}+ for optimization)`}
				</p>
				{lastOpt && (
					<p>
						<strong>Last optimized: </strong>
						{new Date(lastOpt).toLocaleDateString()} (
						{lastOptCount?.toLocaleString() ?? "unknown"} reviews used)
					</p>
				)}
			</InfoBlock>

			<FormField
				name="Optimize parameters"
				description="Analyze your review history to find optimal FSRS weights for this preset"
			>
				<ActionButton
					label={optimizing ? "Optimizing..." : "Optimize now"}
					variant="primary"
					disabled={!canOptimize || optimizing}
					onClick={() => void handleOptimize()}
				/>
				<ActionButton
					label="Reset to defaults"
					variant="secondary"
					onClick={() => void handleReset()}
				/>
			</FormField>

			<FormField
				name="Custom FSRS weights"
				description="Enter 17, 19, or 21 comma-separated values (from FSRS optimizer). Leave empty to use defaults"
			>
				<TextAreaInput
					value={weightsString}
					onChange={(v) => void handleWeightsChange(v)}
					placeholder="0.40255, 1.18385, 3.173, 15.69105, ..."
					rows={3}
					class="ep:w-full ep:font-mono ep:text-ui-small"
				/>
			</FormField>
		</FormCard>
	);
}
