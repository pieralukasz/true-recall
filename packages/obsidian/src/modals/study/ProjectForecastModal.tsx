import type { App } from "obsidian";
import { render } from "preact";

import type {
	WorkloadForecastEntry,
	WorkloadForecastSummary,
} from "@true-recall/core/metrics/fsrs-tools/statistics/workload-forecast.calculator";

import { Clickable } from "@true-recall/obsidian/components";
import { WorkloadForecastSection } from "@true-recall/obsidian/features/metrics/ui/stats/components/WorkloadForecastSection";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";

export interface ProjectForecastData {
	forecast: WorkloadForecastEntry[];
	summary: WorkloadForecastSummary;
	dayOfWeek: { day: number; dayName: string; avgCount: number }[];
	/** Whether a scoped dry run found cards worth moving */
	canBalance: boolean;
}

type ProjectForecastAction = "balance" | "close";

function ProjectForecastBody({
	data,
	onResolve,
}: {
	data: ProjectForecastData;
	onResolve: (action: ProjectForecastAction) => void;
}) {
	return (
		<>
			<div class="ep:text-ui-small ep:text-obs-muted ep:mb-2">
				Only this project's cards; the daily reference line is the project's
				own 30-day average.
			</div>
			<WorkloadForecastSection
				forecast={data.forecast}
				summary={data.summary}
				dayOfWeek={data.dayOfWeek}
			/>
			<div class="ep-modal-footer ep:flex ep:justify-end ep:gap-2 ep:mt-3">
				<Clickable
					class="ep-btn ep-btn-outline"
					onClick={() => onResolve("close")}
					stopPropagation={false}
				>
					Close
				</Clickable>
				{data.canBalance && (
					<Clickable
						class="ep-btn mod-cta"
						onClick={() => onResolve("balance")}
						stopPropagation={false}
					>
						Balance this project…
					</Clickable>
				)}
			</div>
		</>
	);
}

export class ProjectForecastModal extends BasePromiseModal<ProjectForecastAction> {
	constructor(
		app: App,
		projectName: string,
		private data: ProjectForecastData,
	) {
		super(app, {
			title: `Workload forecast — ${projectName}`,
			width: "680px",
		});
	}

	protected getDefaultResult(): ProjectForecastAction {
		return "close";
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ProjectForecastBody
				data={this.data}
				onResolve={(action) => this.resolve(action)}
			/>,
			container,
		);
	}
}
