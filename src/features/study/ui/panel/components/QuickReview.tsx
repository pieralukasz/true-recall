import { ReviewService } from "@features/study/services/review.service";
import { QuickReviewCard } from "@features/study/ui/panel/components/QuickReviewCard";
import type { SchedulingPreview } from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import { Clickable } from "@shared/ui/components";
import { FSRS_COLORS } from "@shared/ui/helpers/fsrs-colors";
import { useIcon } from "@shared/ui/preact/hooks";
import { usePlugin } from "@shared/ui/preact/ObsidianContext";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { type Grade, State } from "ts-fsrs";

const STORAGE_KEY = "tr-quick-review-expanded";

interface QuickReviewProps {
	cardsWithFsrs: FSRSFlashcardItem[];
}

const reviewService = new ReviewService();

function buildDueQueue(cards: FSRSFlashcardItem[]): FSRSFlashcardItem[] {
	const now = new Date();
	const due = cards.filter((card) => {
		if (card.fsrs.suspended) return false;
		if (card.fsrs.buriedUntil && new Date(card.fsrs.buriedUntil) > now)
			return false;

		if (
			card.fsrs.state === State.Learning ||
			card.fsrs.state === State.Relearning
		) {
			return new Date(card.fsrs.due) <= now;
		}
		if (card.fsrs.state === State.Review) {
			return new Date(card.fsrs.due) <= now;
		}
		if (card.fsrs.state === State.New) return true;
		return false;
	});

	// Priority: learning/relearning due first, then review due, then new
	const stateOrder: Record<number, number> = {
		[State.Learning]: 0,
		[State.Relearning]: 0,
		[State.Review]: 1,
		[State.New]: 2,
	};
	due.sort(
		(a, b) => (stateOrder[a.fsrs.state] ?? 3) - (stateOrder[b.fsrs.state] ?? 3),
	);

	return due;
}

export function QuickReview({ cardsWithFsrs }: QuickReviewProps) {
	const plugin = usePlugin();
	const [expanded, setExpanded] = useState(() => {
		try {
			return localStorage.getItem(STORAGE_KEY) === "true";
		} catch {
			return false;
		}
	});
	const [currentIndex, setCurrentIndex] = useState(0);
	const [answerShown, setAnswerShown] = useState(false);
	const [preview, setPreview] = useState<SchedulingPreview | null>(null);

	const chevronRef = useIcon(expanded ? "chevron-up" : "chevron-down");
	const isReviewActive = plugin.store?.getState().review?.isActive ?? false;

	const queue = useMemo(() => buildDueQueue(cardsWithFsrs), [cardsWithFsrs]);

	const currentCard = queue[currentIndex] ?? null;

	// Compute scheduling preview when card changes
	useEffect(() => {
		if (!currentCard) {
			setPreview(null);
			return;
		}
		const p = plugin.fsrsService.getSchedulingPreview(currentCard.fsrs);
		setPreview(p);
	}, [currentCard, plugin.fsrsService]);

	// Reset index when queue changes (e.g., after grading)
	useEffect(() => {
		if (currentIndex >= queue.length) {
			setCurrentIndex(0);
			setAnswerShown(false);
		}
	}, [queue.length, currentIndex]);

	const toggleExpanded = useCallback(() => {
		setExpanded((prev) => {
			const next = !prev;
			try {
				localStorage.setItem(STORAGE_KEY, String(next));
			} catch {
				// localStorage unavailable (e.g. private browsing) — state still works in-memory
			}
			return next;
		});
	}, []);

	const handleShowAnswer = useCallback(() => {
		setAnswerShown(true);
	}, []);

	const handleRate = useCallback(
		async (rating: Grade) => {
			if (!currentCard) return;

			await reviewService.gradeCard(
				currentCard,
				rating,
				plugin.fsrsService,
				plugin.flashcardManager,
			);

			// Advance to next card
			setAnswerShown(false);
			setPreview(null);
			// Queue will rebuild via cardsWithFsrs reactivity
		},
		[currentCard, plugin.fsrsService, plugin.flashcardManager],
	);

	// Don't render when setting is disabled
	if (!plugin.settings.showQuickReviewInPanel) return null;

	// Don't render when formal review is active
	if (isReviewActive) return null;

	// Don't render when there are no cards at all
	if (cardsWithFsrs.length === 0) return null;

	const dueCount = queue.length;
	const newCount = queue.filter((c) => c.fsrs.state === State.New).length;
	const learningCount = queue.filter(
		(c) => c.fsrs.state === State.Learning || c.fsrs.state === State.Relearning,
	).length;

	return (
		<div class="ep:border ep:border-obs-modifier-border ep:rounded-lg ep:overflow-hidden">
			{/* Header — always visible */}
			<Clickable
				class="ep:flex ep:items-center ep:justify-between ep:w-full ep:px-3 ep:py-2 ep:bg-obs-modifier-hover/50 ep:text-left"
				onClick={toggleExpanded}
			>
				<span class="ep:text-xs ep:font-semibold ep:text-obs-normal">
					Quick Review
				</span>
				<span class="ep:text-xs ep:text-obs-muted">
					{dueCount > 0 ? (
						<>
							<span style={{ color: `var(${FSRS_COLORS.review.cssVar})` }}>
								{dueCount} due
							</span>
							{newCount > 0 && (
								<>
									{" "}
									<span style={{ color: `var(${FSRS_COLORS.new.cssVar})` }}>
										{newCount} new
									</span>
								</>
							)}
							{learningCount > 0 && (
								<>
									{" "}
									<span
										style={{ color: `var(${FSRS_COLORS.learning.cssVar})` }}
									>
										{learningCount} lrn
									</span>
								</>
							)}
						</>
					) : (
						"All caught up!"
					)}
					<span
						ref={chevronRef}
						class="ep:ml-1 [&_svg]:ep:w-3 [&_svg]:ep:h-3"
					/>
				</span>
			</Clickable>

			{/* Body — collapsible */}
			{expanded && (
				<div class="ep:px-3 ep:py-2 ep:border-t ep:border-obs-modifier-border">
					{currentCard ? (
						<QuickReviewCard
							card={currentCard}
							answerShown={answerShown}
							preview={preview}
							remaining={queue.length}
							onShowAnswer={handleShowAnswer}
							onRate={handleRate}
						/>
					) : (
						<div class="ep:text-xs ep:text-obs-muted ep:text-center ep:py-3">
							All caught up! No cards due right now.
						</div>
					)}
				</div>
			)}
		</div>
	);
}
