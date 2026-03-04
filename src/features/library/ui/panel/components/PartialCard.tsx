import type { StreamingGenerationState } from "@features/ai/services/streaming-state";
import {
	useStreamingText,
	useWordReveal,
} from "@features/library/ui/panel/hooks";
import { useRef } from "preact/hooks";

interface ClozePart {
	text: string;
	isCloze: boolean;
	clozeIndex: number | null;
	isIncomplete: boolean;
}

const CLOZE_PATTERN = /\{\{c(\d+)::/g;

function hasClozeSyntax(text: string | null): boolean {
	if (!text) return false;
	return CLOZE_PATTERN.test(text);
}

function parseClozeText(text: string): ClozePart[] {
	const parts: ClozePart[] = [];
	let lastIndex = 0;

	// Reset regex state
	CLOZE_PATTERN.lastIndex = 0;

	let match;
	while ((match = CLOZE_PATTERN.exec(text)) !== null) {
		const clozeStart = match.index;
		const clozeIndex = parseInt(match[1] ?? "0", 10);
		const contentStart = clozeStart + match[0].length;

		// Find the end of this cloze
		let depth = 1;
		let contentEnd = contentStart;
		while (contentEnd < text.length && depth > 0) {
			if (text.slice(contentEnd, contentEnd + 2) === "{{") {
				depth++;
				contentEnd += 2;
			} else if (text.slice(contentEnd, contentEnd + 2) === "}}") {
				depth--;
				if (depth === 0) break;
				contentEnd += 2;
			} else {
				contentEnd++;
			}
		}

		// Text before cloze
		if (clozeStart > lastIndex) {
			parts.push({
				text: text.slice(lastIndex, clozeStart),
				isCloze: false,
				clozeIndex: null,
				isIncomplete: false,
			});
		}

		// Extract content between {{cN:: and }}
		const content =
			depth === 0 ? text.slice(contentStart, contentEnd) : text.slice(contentStart);
		const isIncomplete = depth > 0;

		parts.push({
			text: content,
			isCloze: true,
			clozeIndex,
			isIncomplete,
		});

		lastIndex = depth === 0 ? contentEnd + 2 : text.length;
	}

	// Text after last cloze
	if (lastIndex < text.length) {
		parts.push({
			text: text.slice(lastIndex),
			isCloze: false,
			clozeIndex: null,
			isIncomplete: false,
		});
	}

	return parts.length > 0
		? parts
		: [{ text, isCloze: false, clozeIndex: null, isIncomplete: false }];
}

function ClozeRenderer({ text }: { text: string }) {
	if (!text) return null;
	const parts = parseClozeText(text);

	return (
		<>
			{parts.map((part, i) => {
				if (!part.isCloze) {
					return <span key={i}>{part.text}</span>;
				}

				// Active (incomplete) cloze - highlight it
				if (part.isIncomplete) {
					return (
						<span
							key={i}
							class="ep:bg-obs-interactive ep:text-on-accent ep:px-0.5 ep:rounded ep:animate-pulse"
						>
							{part.text}
						</span>
					);
				}

				// Complete cloze - subtle highlight
				return (
					<span
						key={i}
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

export function PartialCard({
	streaming,
}: { streaming: StreamingGenerationState }) {
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

	if (streaming.phase === "waiting" || (qWords.length === 0 && !hasCloze)) {
		return <StreamingSkeleton />;
	}

	return (
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
							key={i}
							data-wi={i}
							style={w.isNew ? { opacity: 0, transform: "translateY(3px)" } : undefined}
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
							key={i}
							data-wi={i}
							style={w.isNew ? { opacity: 0, transform: "translateY(3px)" } : undefined}
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
