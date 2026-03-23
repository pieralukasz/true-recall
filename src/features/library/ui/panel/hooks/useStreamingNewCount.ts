import { streamingGeneration } from "@features/ai/services/streaming-state";
import { useSignalEffect } from "@preact/signals";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import { useMemo, useState } from "preact/hooks";

export function useStreamingNewCount(
	cardsWithFsrs: FSRSFlashcardItem[],
	currentFilePath: string | undefined,
): number {
	const [streamingCompletedCount, setStreamingCompletedCount] = useState(0);
	const [streamingNotePath, setStreamingNotePath] = useState<string | null>(
		null,
	);

	useSignalEffect(() => {
		const s = streamingGeneration.value;
		setStreamingCompletedCount(s.completedCards.length);
		setStreamingNotePath(s.isGenerating ? s.notePath : null);
	});

	return useMemo(() => {
		if (!streamingNotePath || streamingNotePath !== currentFilePath) return 0;
		const dbIds = new Set(cardsWithFsrs.map((c) => c.id));
		const streaming = streamingGeneration.peek();
		return streaming.completedCards.filter((c) => !dbIds.has(c.id)).length;
	}, [
		streamingCompletedCount,
		streamingNotePath,
		currentFilePath,
		cardsWithFsrs,
	]);
}
