import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { FSRSFlashcardItem } from "@true-recall/core/types";

import {
	DEFAULT_ANSWER_SECONDS,
	suggestedAnswerSeconds,
} from "@true-recall/obsidian/features/study/ui/review/helpers/answer-time-budget";
import { t } from "@true-recall/obsidian/i18n";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";

const TICK_MS = 500;

function formatClock(totalSeconds: number): string {
	const safe = Math.max(0, Math.floor(totalSeconds));
	return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

interface AnswerTimeHintProps {
	card: FSRSFlashcardItem;
	isAnswerRevealed: boolean;
}

/**
 * Shows how long the card has been on screen once it passes the suggested
 * answer time. Nothing renders before that: the point is to break a long
 * hesitation, not to add a deadline to every card.
 *
 * Mount with `key={card.id}` so each card starts its own clock.
 */
export function AnswerTimeHint({
	card,
	isAnswerRevealed,
}: AnswerTimeHintProps) {
	const plugin = usePlugin();
	const { answerTimeHintEnabled, answerTimeHintBaseSeconds } = plugin.settings;
	const baseSeconds = answerTimeHintBaseSeconds ?? DEFAULT_ANSWER_SECONDS;

	const secondsPerChunk = plugin.settings.answerTimeSecondsPerChunk;
	const historyWeight = plugin.settings.answerTimeHistoryWeight;

	const budget = useMemo(
		() =>
			suggestedAnswerSeconds(card, baseSeconds, {
				secondsPerChunk,
				historyWeight,
			}),
		[card, baseSeconds, secondsPerChunk, historyWeight],
	);

	// Wall clock since the card appeared, minus any time the window was hidden
	// (switching apps should not count as hesitation).
	const startedAtRef = useRef(Date.now());
	const hiddenAtRef = useRef<number | null>(null);
	const [elapsed, setElapsed] = useState(0);

	useEffect(() => {
		if (!answerTimeHintEnabled || isAnswerRevealed) return;

		const tick = () => {
			setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
		};
		const id = window.setInterval(tick, TICK_MS);

		const onVisibilityChange = () => {
			if (activeDocument.hidden) {
				hiddenAtRef.current = Date.now();
				return;
			}
			if (hiddenAtRef.current !== null) {
				startedAtRef.current += Date.now() - hiddenAtRef.current;
				hiddenAtRef.current = null;
			}
			tick();
		};

		activeDocument.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			window.clearInterval(id);
			activeDocument.removeEventListener(
				"visibilitychange",
				onVisibilityChange,
			);
		};
	}, [answerTimeHintEnabled, isAnswerRevealed]);

	if (!answerTimeHintEnabled || isAnswerRevealed || elapsed < budget) {
		return null;
	}

	return (
		<div
			class="tr-answer-time-hint"
			title={t("Based on answer length and this card's rating history")}
		>
			{t("Over suggested time: {0} / {1}", [
				formatClock(elapsed),
				formatClock(budget),
			])}
		</div>
	);
}
