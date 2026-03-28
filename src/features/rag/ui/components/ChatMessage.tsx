import type { ChatTurn } from "@features/rag/services/rag-query.service";

interface Props {
	turn: ChatTurn;
	isStreaming?: boolean;
}

export function ChatMessage({ turn, isStreaming }: Props) {
	const isUser = turn.role === "user";

	return (
		<div
			class={`ep:flex ep:flex-col ep:gap-1 ${isUser ? "ep:items-end" : "ep:items-start"}`}
		>
			<div
				class={`ep:max-w-[85%] ep:rounded-lg ep:px-3 ep:py-2 ep:text-sm ep:whitespace-pre-wrap ${
					isUser
						? "ep:bg-obs-interactive/15 ep:text-obs-normal"
						: "ep:bg-obs-modifier-hover ep:text-obs-normal"
				} ${isStreaming ? "ep:animate-pulse" : ""}`}
			>
				{turn.content}
			</div>

			{turn.sources && turn.sources.length > 0 && (
				<div class="ep:flex ep:flex-wrap ep:gap-1 ep:max-w-[85%]">
					{turn.sources.slice(0, 5).map((s, i) => (
						<span
							key={i}
							class="ep:text-[10px] ep:px-1.5 ep:py-0.5 ep:rounded ep:bg-obs-modifier-hover ep:text-obs-muted"
						>
							{s.sourceType === "note"
								? s.sourceId.replace(/\.md$/, "")
								: `Card: ${s.content.slice(0, 30)}...`}
						</span>
					))}
				</div>
			)}
		</div>
	);
}
