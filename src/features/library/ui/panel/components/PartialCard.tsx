import type { StreamingGenerationState } from "@features/ai/services/streaming-state";
import { useStreamingText } from "@features/library/ui/panel/hooks";

export function PartialCard({
	streaming,
}: { streaming: StreamingGenerationState }) {
	const { words: qWords, isTyping: qTyping } = useStreamingText(
		streaming.partialQuestion ?? "",
	);
	const { words: aWords, isTyping: aTyping } = useStreamingText(
		streaming.partialAnswer ?? "",
	);

	if (streaming.phase === "waiting" || qWords.length === 0) {
		return <StreamingSkeleton />;
	}

	return (
		<div class="ep:flex ep:flex-col ep:mb-2 ep:rounded-lg ep:bg-obs-secondary ep:border ep:border-obs-border/20 ep:shadow-sm ep:p-3">
			<div class="ep:text-ui-small ep:text-obs-normal ep:leading-relaxed">
				{qWords.map((w, i) => (
					<span key={i} class={w.isNew ? "ep-word-reveal" : undefined}>
						{w.text}
					</span>
				))}
				{qTyping && <span class="ep-streaming-cursor" />}
			</div>
			{(aWords.length > 0 || streaming.partialAnswer != null) && (
				<div class="ep:text-ui-small ep:text-obs-muted ep:mt-1.5 ep:leading-relaxed">
					{aWords.map((w, i) => (
						<span
							key={i}
							class={w.isNew ? "ep-word-reveal" : undefined}
						>
							{w.text}
						</span>
					))}
					{aTyping && <span class="ep-streaming-cursor" />}
				</div>
			)}
		</div>
	);
}

function StreamingSkeleton() {
	return (
		<div class="ep:flex ep:flex-col ep:mb-2 ep:rounded-lg ep:bg-obs-secondary ep:border ep:border-obs-border/20 ep:shadow-sm ep:p-3 ep:gap-2.5">
			<div class="ep-shimmer ep:h-3.5 ep:w-4/5 ep:rounded" />
			<div class="ep-shimmer ep:h-3.5 ep:w-3/5 ep:rounded" />
			<div class="ep-shimmer ep:h-3 ep:w-2/5 ep:rounded ep:mt-1 ep:opacity-60" />
		</div>
	);
}
