import type { SequenceSimulation } from "../types";

export function SimulatorResultsTable({
	simulations,
}: {
	simulations: SequenceSimulation[];
}) {
	const maxReviews = Math.max(...simulations.map((s) => s.reviews.length), 1);

	const headerCellCls = [
		"ep:py-2 ep:px-3",
		"ep:text-left ep:font-semibold",
		"ep:text-obs-muted ep:text-ui-smaller ep:uppercase",
		"ep:border-b ep:border-obs-border",
	].join(" ");

	const bodyCellCls = "ep:py-2 ep:px-3 ep:text-obs-normal";

	return (
		<div class="ep:bg-obs-secondary ep:rounded-lg ep:p-4">
			<table class="ep:w-full ep:text-ui-small">
				<thead>
					<tr>
						<th class={headerCellCls}>Grade</th>
						{Array.from({ length: maxReviews }, (_, i) => (
							<th key={i} class={headerCellCls}>
								Ivl-{i}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{simulations.map((sim) => (
						<tr
							key={sim.sequence}
							class="ep:border-b ep:border-obs-border last:ep:border-b-0"
						>
							<td class={bodyCellCls}>
								<div class="ep:flex ep:items-center ep:gap-2">
									<div
										class="ep:w-3 ep:h-3 ep:rounded-full ep:flex-shrink-0 ep-dynamic-bg"
										style={
											{ "--ep-dynamic-color": sim.color } as Record<
												string,
												string
											>
										}
									/>
									<span class="ep:font-mono">{sim.sequence}</span>
								</div>
							</td>
							{Array.from({ length: maxReviews }, (_, i) => {
								const review = sim.reviews[i];
								const interval = review ? Math.round(review.interval) : "-";
								return (
									<td
										key={i}
										class={`${bodyCellCls} ep:text-center ep:font-mono`}
									>
										{interval}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
