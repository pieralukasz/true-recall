import type { WorkloadDecision } from "@true-recall/core/metrics/fsrs-tools";

import {
	buildTargetReferences,
	describeDrift,
	describeTargetConsequence,
} from "./target-copy";

interface TargetInsightsProps {
	decision: WorkloadDecision;
	target: number;
}

/** Reference chips plus the live consequence line for a candidate target */
export function TargetInsights({ decision, target }: TargetInsightsProps) {
	const drift = describeDrift(decision, target);
	return (
		<div class="ep:flex ep:flex-col ep:gap-1.5 ep:py-2">
			<div class="ep:flex ep:flex-wrap ep:gap-2">
				{buildTargetReferences(decision).map((ref) => (
					<span
						key={ref.label}
						class="ep:text-ui-smaller ep:text-obs-muted ep:rounded ep:border ep:border-obs-border ep:px-1.5 ep:py-0.5"
						title={ref.hint}
					>
						{ref.label}: {ref.value}/day
					</span>
				))}
			</div>
			<span class="ep:text-ui-smaller ep:text-obs-muted">
				{describeTargetConsequence(decision, target)}
			</span>
			{drift ? (
				<span class="ep:text-ui-smaller ep:text-obs-warning">{drift}</span>
			) : null}
		</div>
	);
}
