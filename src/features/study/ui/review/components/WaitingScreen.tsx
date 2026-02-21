import { UI_CONFIG } from "@shared/constants";
import type { ReviewApi } from "@shared/store";
import { useEffect, useState } from "preact/hooks";

export function WaitingScreen({
	review,
	timeUntilDue,
	onEndSession,
}: {
	review: ReviewApi;
	timeUntilDue: number;
	onEndSession: () => void;
}) {
	const [remaining, setRemaining] = useState(timeUntilDue);
	const pendingCards = review.getPendingLearningCards();

	useEffect(() => {
		const id = setInterval(() => {
			const newRemaining = review.getTimeUntilNextDue();
			if (newRemaining <= 0) {
				clearInterval(id);
			}
			setRemaining(newRemaining);
		}, UI_CONFIG.timerInterval);
		return () => clearInterval(id);
	}, [review]);

	const formatCountdown = (ms: number): string => {
		if (ms <= 0) return "0:00";
		const totalSeconds = Math.ceil(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	};

	return (
		<div class="true-recall-review ep:flex ep:flex-col ep:h-full ep:p-0">
			<div class="true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:p-2 ep:mt-8 ep:overflow-y-auto">
				<div class="ep:text-center ep:py-8 ep:px-6 ep:max-w-md ep:mx-auto">
					<h2 class="ep:text-2xl ep:m-0 ep:mb-4 ep:text-obs-normal">
						Congratulations!
					</h2>
					<p class="ep:text-obs-muted ep:m-0 ep:mb-6">
						You've reviewed all available cards.
					</p>

					<div class="ep:mb-6">
						<p class="ep:text-obs-muted ep:text-ui-small ep:m-0 ep:mb-2">
							{pendingCards.length} learning card
							{pendingCards.length === 1 ? "" : "s"} due in:
						</p>
						<div class="ep:text-5xl ep:font-bold ep:text-obs-interactive ep:tabular-nums">
							{formatCountdown(remaining)}
						</div>
					</div>

					<div class="ep:flex ep:gap-3 ep:justify-center">
						<button type="button" class="ep-btn mod-cta">
							Wait
						</button>
						<button
							type="button"
							class="ep-btn ep-btn-outline"
							onClick={() => {
								review.endSession();
								onEndSession();
							}}
						>
							End session
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
