import { Clickable } from "@true-recall/obsidian/components";
import type { ReviewApi } from "@true-recall/obsidian/store";
import { useEffect } from "preact/hooks";

function StatItem({
	label,
	value,
	colorCls,
}: {
	label: string;
	value: string;
	colorCls?: string;
}) {
	return (
		<div class="ep:p-3 ep:bg-obs-secondary ep:rounded-lg">
			<div class="ep:text-ui-smaller ep:text-obs-muted ep:mb-1">{label}</div>
			<div
				class={`ep:text-xl ep:font-semibold ep:text-obs-normal ${colorCls ?? ""}`}
			>
				{value}
			</div>
		</div>
	);
}

export function SummaryScreen({
	review,
	isCustomSession,
	continuousCustomReviews,
	onClose,
	onNextSession,
}: {
	review: ReviewApi;
	isCustomSession: boolean;
	continuousCustomReviews: boolean;
	onClose: () => void;
	onNextSession: () => void;
}) {
	const stats = review.getStats();
	const durationMin = Math.floor(stats.duration / 60000);
	const durationSec = Math.floor((stats.duration % 60000) / 1000);

	// End session to capture final stats (once on mount)
	useEffect(() => {
		if (review.isActive) {
			review.endSession();
		}
	}, []); // intentionally fire once on mount

	return (
		<div class="true-recall-review ep:flex ep:flex-col ep:h-full ep:p-0">
			<div class="true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:pt-4 ep:px-6 ep:pb-2 ep:overflow-y-auto">
				<div class="ep:text-center ep:py-8 ep:px-6 ep:max-w-md ep:mx-auto">
					<h2 class="ep:text-2xl ep:m-0 ep:mb-6 ep:text-obs-normal">
						Session complete!
					</h2>

					<div class="ep:grid ep:grid-cols-2 ep:gap-3 ep:mb-6">
						<StatItem
							label="Total reviewed"
							value={stats.reviewed.toString()}
						/>
						<StatItem
							label="Again"
							value={stats.again.toString()}
							colorCls="ep:text-obs-red"
						/>
						<StatItem
							label="Hard"
							value={stats.hard.toString()}
							colorCls="ep:text-obs-orange"
						/>
						<StatItem
							label="Good"
							value={stats.good.toString()}
							colorCls="ep:text-obs-green"
						/>
						<StatItem
							label="Easy"
							value={stats.easy.toString()}
							colorCls="ep:text-obs-cyan"
						/>
						<StatItem
							label="Duration"
							value={`${durationMin}m ${durationSec}s`}
						/>
					</div>

					<div class="ep:flex ep:gap-3 ep:py-4 ep:justify-center">
						{isCustomSession && continuousCustomReviews ? (
							<>
								<Clickable
									stopPropagation={false}
									class="ep-btn mod-cta"
									onClick={onNextSession}
								>
									Next session
								</Clickable>
								<Clickable
									stopPropagation={false}
									class="ep-btn ep-btn-outline"
									onClick={onClose}
								>
									Finish
								</Clickable>
							</>
						) : (
							<Clickable
								stopPropagation={false}
								class="ep-btn mod-cta"
								onClick={onClose}
							>
								Close
							</Clickable>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
