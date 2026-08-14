import { isLeech } from "@true-recall/core/helpers/leech-helpers";
import type { FSRSFlashcardItem } from "@true-recall/core/types";

/**
 * How many times this card has been seen and how many times it was failed.
 *
 * Rendered only once the answer is out, so it cannot prime recall. The review
 * number counts the attempt in progress, because "which time am I seeing this"
 * includes the one on screen; `reps` alone is the state from before it.
 */
export function CardCounters({
	card,
	leechThreshold,
}: {
	card: FSRSFlashcardItem;
	leechThreshold?: number;
}) {
	const { reps, lapses } = card.fsrs;
	const isLeeching =
		leechThreshold !== undefined && isLeech(lapses, leechThreshold);

	return (
		<span
			class={
				isLeeching
					? "ep:text-obs-orange ep:text-ui-smaller ep:tabular-nums"
					: "ep:text-obs-faint ep:text-ui-smaller ep:tabular-nums"
			}
			title={
				isLeeching
					? `Leech: ${lapses} lapses at a threshold of ${leechThreshold}`
					: undefined
			}
		>
			Review #{reps + 1} · {lapses} {lapses === 1 ? "lapse" : "lapses"}
		</span>
	);
}
