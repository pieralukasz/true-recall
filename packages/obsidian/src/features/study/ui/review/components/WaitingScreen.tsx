import { useCallback, useEffect, useState } from "preact/hooks";

import { UI_CONFIG } from "@true-recall/core";
import type {
	ReviewSessionTopUp,
	ReviewSessionTopUpAvailability,
} from "@true-recall/core/types";

import { Clickable } from "@true-recall/obsidian/components";
import type { ReviewApi } from "@true-recall/obsidian/store";

import { SessionTopUpPanel } from "./SessionTopUpPanel";

export function WaitingScreen({
	review,
	timeUntilDue,
	onEndSession,
	rModeActive,
	getTopUpAvailability,
	onTopUp,
}: {
	review: ReviewApi;
	timeUntilDue: number;
	onEndSession: () => void;
	rModeActive: boolean;
	getTopUpAvailability: () => ReviewSessionTopUpAvailability;
	onTopUp: (topUp: ReviewSessionTopUp) => Promise<boolean>;
}) {
	const [remaining, setRemaining] = useState(timeUntilDue);
	const pendingCards = review.getPendingLearningCards();

	const getTimeUntilNextDue = useCallback(
		() => review.getTimeUntilNextDue(),
		[review],
	);

	useEffect(() => {
		const id = window.setInterval(() => {
			const newRemaining = getTimeUntilNextDue();
			if (newRemaining <= 0) {
				window.clearInterval(id);
				setRemaining(0);
				review.notifyChange();
				return;
			}
			setRemaining(newRemaining);
		}, UI_CONFIG.timerInterval);
		return () => window.clearInterval(id);
	}, [getTimeUntilNextDue, review]);

	const formatCountdown = (ms: number): string => {
		if (ms <= 0) return "0:00";
		const totalSeconds = Math.ceil(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	};

	return (
		<div class="true-recall-review ep:flex ep:flex-col ep:h-full ep:p-0">
			<div class="true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:pt-4 ep:px-6 ep:pb-2 ep:overflow-y-auto">
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
						<div
							class="ep:text-5xl ep:font-bold ep:text-obs-interactive ep:tabular-nums"
							role="timer"
							aria-live="polite"
							aria-label={`Next card due in ${formatCountdown(remaining)}`}
						>
							{formatCountdown(remaining)}
						</div>
					</div>

					{rModeActive ? (
						<div class="ep:mb-4 ep:text-left">
							<SessionTopUpPanel
								getAvailability={getTopUpAvailability}
								onTopUp={onTopUp}
							/>
						</div>
					) : null}

					<div class="ep:flex ep:gap-3 ep:justify-center">
						<Clickable
							stopPropagation={false}
							class="ep-btn ep-btn-outline"
							onClick={() => {
								onEndSession();
							}}
						>
							End session
						</Clickable>
					</div>
				</div>
			</div>
		</div>
	);
}
