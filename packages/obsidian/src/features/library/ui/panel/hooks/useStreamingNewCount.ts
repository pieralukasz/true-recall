import { useEffect, useMemo, useState } from "preact/hooks";

import { streamingGeneration } from "@true-recall/core/ai/state/streaming-state";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";

export function useStreamingNewCount(
	cardsWithFsrs: FSRSFlashcardItem[],
	currentFilePath: string | undefined,
): number {
	const [streamingCompletedCount, setStreamingCompletedCount] = useState(0);
	const [streamingNotePath, setStreamingNotePath] = useState<string | null>(
		null,
	);

	useEffect(
		() =>
			streamingGeneration.subscribe((s) => {
				setStreamingCompletedCount(s.completedCards.length);
				setStreamingNotePath(s.isGenerating ? s.notePath : null);
			}),
		[],
	);

	return useMemo(() => {
		if (!streamingNotePath || streamingNotePath !== currentFilePath) return 0;
		const dbIds = new Set(cardsWithFsrs.map((c) => c.id));
		const streaming = streamingGeneration.value;
		// streamingCompletedCount is read only to force recomputation on every
		// completed card. completedCards is mutated on the live signal directly,
		// so without this the count would go stale between a card completing and
		// cardsWithFsrs eventually updating once the DB write lands.
		void streamingCompletedCount;
		return streaming.completedCards.filter(
			(c: { id: string }) => !dbIds.has(c.id),
		).length;
	}, [
		streamingNotePath,
		currentFilePath,
		cardsWithFsrs,
		streamingCompletedCount,
	]);
}
