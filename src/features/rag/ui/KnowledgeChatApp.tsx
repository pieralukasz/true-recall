import type { ChatTurn } from "@features/rag/services/rag-query.service";
import { Clickable } from "@shared/ui/components";
import { useApp, usePlugin } from "@shared/ui/preact";
import { useCallback, useMemo, useRef, useState } from "preact/hooks";
import { ChatInput } from "./components/ChatInput";
import { ChatMessage } from "./components/ChatMessage";
import { IndexStatus } from "./components/IndexStatus";
import type { KnowledgeChatView } from "./KnowledgeChatView";
import type { SourceNavigationHandlers } from "./types";

interface Props {
	view: KnowledgeChatView;
}

export function KnowledgeChatApp({ view }: Props) {
	const app = useApp();
	const plugin = usePlugin();
	const [messages, setMessages] = useState<ChatTurn[]>([]);
	const [streaming, setStreaming] = useState(false);
	const [streamingText, setStreamingText] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);

	const navigation = useMemo<SourceNavigationHandlers>(
		() => ({
			onNavigateToNote: (sourceId: string, headingBreadcrumb: string) => {
				const lastHeading = headingBreadcrumb.split(" > ").pop()?.trim() ?? "";
				const link = lastHeading ? `${sourceId}#${lastHeading}` : sourceId;
				void app.workspace.openLinkText(link, "", false);
			},
			onNavigateToCard: (cardId: string) => {
				const cards = plugin.cardStore.getByIds([cardId]);
				const sourceUid = cards[0]?.sourceUid;
				if (sourceUid) {
					const file = plugin.frontmatterIndex.getFileByValue(
						"flashcard_uid",
						sourceUid,
					);
					if (file) {
						void app.workspace.openLinkText(file.path, "", false).then(() => {
							void plugin.activateView();
						});
					}
				}
			},
		}),
		[app, plugin],
	);

	const scrollToBottom = useCallback(() => {
		requestAnimationFrame(() => {
			scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
		});
	}, []);

	const handleSend = useCallback(
		async (text: string) => {
			if (!view.chatService || streaming) return;

			const userTurn: ChatTurn = {
				role: "user",
				content: text,
				timestamp: Date.now(),
			};
			setMessages((prev) => [...prev, userTurn]);
			setStreaming(true);
			setStreamingText("");
			scrollToBottom();

			try {
				let fullResponse = "";
				for await (const chunk of view.chatService.sendMessage(text)) {
					fullResponse += chunk;
					setStreamingText(fullResponse);
					scrollToBottom();
				}

				const history = view.chatService.getHistory();
				setMessages([...history]);
				setStreamingText("");
			} catch (e) {
				const errorTurn: ChatTurn = {
					role: "assistant",
					content: `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
					timestamp: Date.now(),
				};
				setMessages((prev) => [...prev, errorTurn]);
			} finally {
				setStreaming(false);
				scrollToBottom();
			}
		},
		[view.chatService, streaming, scrollToBottom],
	);

	const handleClear = useCallback(() => {
		view.chatService?.clearHistory();
		setMessages([]);
		setStreamingText("");
	}, [view.chatService]);

	if (!view.chatService) {
		return (
			<div class="ep:flex ep:items-center ep:justify-center ep:h-full ep:p-4 ep:text-obs-muted">
				<p>Knowledge Base requires a Pro subscription and enabled RAG.</p>
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:h-full">
			<div class="ep:flex ep:items-center ep:justify-between ep:px-3 ep:py-2 ep:border-b ep:border-obs-border">
				<span class="ep:text-ui-small ep:font-medium">Knowledge Chat</span>
				{messages.length > 0 && (
					<Clickable
						class="ep:text-xs ep:text-obs-muted ep:hover:text-obs-normal"
						onClick={handleClear}
					>
						Clear
					</Clickable>
				)}
			</div>

			<div
				ref={scrollRef}
				class="ep:flex-1 ep:overflow-y-auto ep:p-3 ep:flex ep:flex-col ep:gap-3"
			>
				{messages.length === 0 && !streaming && (
					<div class="ep:flex ep:items-center ep:justify-center ep:h-full ep:text-obs-muted ep:text-sm">
						Ask anything about your notes
					</div>
				)}

				{messages.map((msg, i) => (
					<ChatMessage key={i} turn={msg} navigation={navigation} />
				))}

				{streaming && streamingText && (
					<ChatMessage
						turn={{
							role: "assistant",
							content: streamingText,
							timestamp: Date.now(),
						}}
						isStreaming
					/>
				)}
			</div>

			<IndexStatus view={view} />
			<ChatInput onSend={handleSend} disabled={streaming} />
		</div>
	);
}
