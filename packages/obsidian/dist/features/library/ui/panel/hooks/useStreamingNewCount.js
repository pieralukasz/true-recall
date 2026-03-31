import { streamingGeneration } from "@true-recall/core/ai/state/streaming-state";
import { useSignalEffect } from "@preact/signals";
import { useMemo, useState } from "preact/hooks";
export function useStreamingNewCount(cardsWithFsrs, currentFilePath) {
    const [streamingCompletedCount, setStreamingCompletedCount] = useState(0);
    const [streamingNotePath, setStreamingNotePath] = useState(null);
    useSignalEffect(() => {
        const s = streamingGeneration.value;
        setStreamingCompletedCount(s.completedCards.length);
        setStreamingNotePath(s.isGenerating ? s.notePath : null);
    });
    return useMemo(() => {
        if (!streamingNotePath || streamingNotePath !== currentFilePath)
            return 0;
        const dbIds = new Set(cardsWithFsrs.map((c) => c.id));
        const streaming = streamingGeneration.value;
        return streaming.completedCards.filter((c) => !dbIds.has(c.id)).length;
    }, [
        streamingCompletedCount,
        streamingNotePath,
        currentFilePath,
        cardsWithFsrs,
    ]);
}
