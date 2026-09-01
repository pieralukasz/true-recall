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

export function TargetInsights({ decision, target }: TargetInsightsProps) {
	const drift = describeDrift(decision, target);
	return (
		<div class="tr-target-insights">
			<div class="tr-target-insights__references">
				{buildTargetReferences(decision).map((ref) => (
					<span key={ref.label} title={ref.hint}>
						{ref.label}: {ref.value}/day
					</span>
				))}
			</div>
			<span class="tr-target-insights__consequence">
				{describeTargetConsequence(decision, target)}
			</span>
			{drift ? <span class="tr-target-insights__warning">{drift}</span> : null}
		</div>
	);
}
