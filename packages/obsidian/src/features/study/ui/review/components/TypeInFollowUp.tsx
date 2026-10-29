import { useState } from "preact/hooks";

import { followUpPlaceholder } from "@true-recall/obsidian/features/study/ui/review/helpers/review-follow-up";
import { t } from "@true-recall/obsidian/i18n";
import { useIcon } from "@true-recall/obsidian/preact/hooks";

interface TypeInFollowUpProps {
	/** Sends or queues the question; returns false when it could not. */
	onSubmit: (question: string) => boolean;
	/** True with the AI chat: the answer shows under the card right away. */
	answeredUnderCard?: boolean;
	queuedCount: number;
	/** "Cards from gaps" next to the input; hidden when absent. */
	onCardsFromGaps?: () => void;
}

/** One-shot question input shown after a type-in answer is revealed. With
 * the AI chat (Pro) the answer appears under the card right away, with the
 * typed answer and its grading as context; with the old assistant the
 * question is queued to the AI inbox and answered after the session. A single
 * line, not a chat, so the review keeps its momentum. Never autofocused, so
 * rating shortcuts keep working until the user clicks in. */
export function TypeInFollowUp({
	onSubmit,
	answeredUnderCard = false,
	queuedCount,
	onCardsFromGaps,
}: TypeInFollowUpProps) {
	const [value, setValue] = useState("");

	const submit = () => {
		const trimmed = value.trim();
		if (trimmed === "") return;
		if (onSubmit(trimmed)) setValue("");
	};

	return (
		<div class="true-recall-follow-up ep:mt-6 ep:flex ep:flex-col ep:gap-1.5">
			<div class="true-recall-follow-up__row">
				<input
					type="text"
					class="true-recall-follow-up__input"
					placeholder={t(followUpPlaceholder(answeredUnderCard))}
					value={value}
					onInput={(e) => setValue((e.target as HTMLInputElement).value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							e.stopPropagation();
							submit();
						}
						if (e.key === "Escape") {
							(e.target as HTMLInputElement).blur();
						}
					}}
				/>
				{onCardsFromGaps && <CardsFromGapsButton onClick={onCardsFromGaps} />}
			</div>
			{queuedCount > 0 && (
				<span class="ep:text-ui-smaller ep:text-obs-faint">
					{queuedCount} queued · waiting in the AI Inbox
				</span>
			)}
		</div>
	);
}

/** Secondary button beside the input, same height. Icon only when the
 * column is narrow (container query in review.styles.css). */
function CardsFromGapsButton({ onClick }: { onClick: () => void }) {
	const iconRef = useIcon("layers-plus");
	const hint = t(
		"New cards for what your answer missed, skipping points you already have cards for",
	);
	return (
		<button
			type="button"
			class="true-recall-gap-cards"
			aria-label={hint}
			data-tooltip-position="top"
			onClick={(e) => {
				// Blur so Enter and the rating keys go back to the review.
				e.currentTarget.blur();
				onClick();
			}}
		>
			<span
				ref={iconRef}
				class="true-recall-gap-cards__icon"
				aria-hidden="true"
			/>
			<span class="true-recall-gap-cards__label">{t("Cards from gaps")}</span>
		</button>
	);
}
