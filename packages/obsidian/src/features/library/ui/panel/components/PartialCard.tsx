import { useRef } from "preact/hooks";

import type { StreamingGenerationState } from "@true-recall/core/ai/state/streaming-state";

import {
	useStreamingText,
	useWordReveal,
} from "@true-recall/obsidian/features/library/ui/panel/hooks";
import {
	hasClozeSyntax,
	parseClozeText,
} from "@true-recall/obsidian/features/library/ui/panel/utils/cloze-parser";

function ClozeRenderer({ text }: { text: string }) {
	if (!text) return null;
	const parts = parseClozeText(text);

	return (
		<>
			{parts.map((part, i) => {
				if (!part.isCloze) {
					return (
						<span key={`${i}-t-${part.text.slice(0, 20)}`}>{part.text}</span>
					);
				}

				if (part.isIncomplete) {
					return (
						<span
							key={`${i}-c${part.clozeIndex}-incomplete`}
							class="ep:bg-obs-interactive ep:text-on-accent ep:px-0.5 ep:rounded ep:animate-pulse"
						>
							{part.text}
						</span>
					);
				}

				return (
					<span
						key={`${i}-c${part.clozeIndex}`}
						class="ep:bg-obs-accent-muted ep:px-0.5 ep:rounded"
						title={`Cloze ${part.clozeIndex}`}
					>
						{part.text}
					</span>
				);
			})}
		</>
	);
}

const NEW_WORD_STYLE = {
	opacity: 0,
	filter: "blur(4px)",
	transform: "translateY(4px)",
};

export function PartialCard({
	streaming,
}: {
	streaming: StreamingGenerationState;
}) {
	const { words: qWords, isTyping: qTyping } = useStreamingText(
		streaming.partialQuestion ?? "",
	);
	const { words: aWords, isTyping: aTyping } = useStreamingText(
		streaming.partialAnswer ?? "",
	);

	const qRef = useRef<HTMLDivElement>(null);
	const aRef = useRef<HTMLDivElement>(null);
	useWordReveal(qRef, qWords);
	useWordReveal(aRef, aWords);

	const hasCloze = hasClozeSyntax(streaming.partialQuestion);

	const chunkProgress =
		streaming.totalChunks != null ? (
			<div class="ep:text-ui-smaller ep:text-obs-muted ep:mb-1 ep:px-3">
				Section {streaming.completedChunks + 1}/{streaming.totalChunks}
				{streaming.currentChunkLabel && ` — ${streaming.currentChunkLabel}`}
			</div>
		) : null;

	if (streaming.phase === "waiting" || (qWords.length === 0 && !hasCloze)) {
		return (
			<>
				{chunkProgress}
				<StreamingSkeleton />
			</>
		);
	}

	return (
		<>
			{chunkProgress}
			<div class="ep:flex ep:flex-col ep:mb-2 ep:rounded-lg ep:bg-obs-secondary ep:border ep:border-obs-border/20 ep:shadow-sm ep:p-3">
				<div
					ref={qRef}
					class="ep:text-ui-small ep:text-obs-normal ep:leading-relaxed"
				>
					{hasCloze ? (
						<ClozeRenderer text={streaming.partialQuestion ?? ""} />
					) : (
						qWords.map((w, i) => (
							<span
								key={`q-${i}`}
								data-wi={i}
								style={w.isNew ? NEW_WORD_STYLE : undefined}
							>
								{w.text}
							</span>
						))
					)}
					{qTyping && <span class="ep-streaming-cursor" />}
				</div>
				{(aWords.length > 0 || streaming.partialAnswer != null) && (
					<div
						ref={aRef}
						class="ep:text-ui-small ep:text-obs-muted ep:mt-1.5 ep:leading-relaxed"
					>
						{aWords.map((w, i) => (
							<span
								key={`a-${i}`}
								data-wi={i}
								style={w.isNew ? NEW_WORD_STYLE : undefined}
							>
								{w.text}
							</span>
						))}
						{aTyping && <span class="ep-streaming-cursor" />}
					</div>
				)}
			</div>
		</>
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
