import type { SequenceSimulation } from "../types";

export function ChartLegend({
	simulations,
}: {
	simulations: SequenceSimulation[];
}) {
	return (
		<div class="ep:flex ep:flex-wrap ep:gap-3 ep:mb-4 ep:justify-end">
			{simulations.map((sim) => (
				<div key={sim.sequence} class="ep:flex ep:items-center ep:gap-1.5">
					<div
						class="ep:w-4 ep:h-4 ep:rounded-sm ep-dynamic-bg"
						style={
							{ "--ep-dynamic-color": sim.color } as Record<string, string>
						}
					/>
					<span class="ep:text-ui-small ep:text-obs-muted">{sim.sequence}</span>
				</div>
			))}
		</div>
	);
}
