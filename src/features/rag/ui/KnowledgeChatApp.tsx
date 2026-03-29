import type { ChatTurn } from "@features/rag/services/rag-query.service";
import type { ChatConfig } from "@shared/types";
import { Clickable, IconButton } from "@shared/ui/components";
import { useApp, useIcon, usePlugin } from "@shared/ui/preact";
import { Notice } from "obsidian";
import { useCallback, useMemo, useRef, useState } from "preact/hooks";
import { ChatConfigPanel } from "./components/ChatConfigPanel";
import { ChatInput } from "./components/ChatInput";
import { ChatMessage } from "./components/ChatMessage";
import { IndexStatus } from "./components/IndexStatus";
import type { KnowledgeChatView } from "./KnowledgeChatView";
import type { SourceNavigationHandlers } from "./types";

const SUGGESTED_QUESTIONS = [
	"Summarize my recent notes",
	"How's my study progress?",
	"Which cards am I struggling with?",
];

interface Props {
	view: KnowledgeChatView;
}

export function KnowledgeChatApp({ view }: Props) {
	const app = useApp();
	const plugin = usePlugin();
	const [messages, setMessages] = useState<ChatTurn[]>([]);
	const [streaming, setStreaming] = useState(false);
	const [streamingText, setStreamingText] = useState("");
	const [configOpen, setConfigOpen] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const headerIconRef = useIcon("bot");
	const sparklesRef = useIcon("sparkles");

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
				if (!sourceUid) {
					new Notice("Cannot navigate: card no longer exists");
					return;
				}
				const file = plugin.frontmatterIndex.getFileByValue(
					"flashcard_uid",
					sourceUid,
				);
				if (!file) {
					new Notice("Source note not found for this flashcard");
					return;
				}
				void app.workspace.openLinkText(file.path, "", false).then(() => {
					void plugin.activateView();
				});
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

	const handleConfigChange = useCallback(
		(config: ChatConfig) => {
			if (messages.length > 0) {
				view.chatService?.clearHistory();
				setMessages([]);
				setStreamingText("");
			}
		},
		[view.chatService, messages.length],
	);

	if (!view.chatService) {
		return (
			<div class="ep:flex ep:items-center ep:justify-center ep:h-full ep:p-4 ep:text-obs-muted">
				<p>Knowledge Base requires a Pro subscription and enabled RAG.</p>
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:h-full">
			<div class="ep:flex ep:items-center ep:justify-between ep:px-2 ep:py-3 ep:border-b ep:border-obs-border">
				<div class="ep:flex ep:items-center ep:gap-2">
					<div
						ref={headerIconRef}
						class="ep:w-4 ep:h-4 ep:text-obs-muted [&_svg]:ep:w-4 [&_svg]:ep:h-4"
					/>
					<span class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
						Chat
					</span>
				</div>
				<div class="ep:flex ep:items-center ep:gap-1">
					<IndexStatus view={view} />
					<IconButton
						icon="settings-2"
						ariaLabel="Configure chat"
						onClick={() => setConfigOpen((o) => !o)}
						size="small"
					/>
					{messages.length > 0 && (
						<IconButton
							icon="trash-2"
							ariaLabel="Clear conversation"
							onClick={handleClear}
							size="small"
						/>
					)}
				</div>
			</div>

			{configOpen && (
				<ChatConfigPanel
					config={plugin.settings.ragChatConfig}
					onConfigChange={handleConfigChange}
				/>
			)}

			<div
				ref={scrollRef}
				class="ep:flex-1 ep:overflow-y-auto ep:px-2 ep:pt-4 ep:pb-2 ep:flex ep:flex-col ep:gap-5"
			>
				{messages.length === 0 && !streaming && (
					<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-full ep:gap-5 ep:px-2">
						<div class="ep:flex ep:flex-col ep:items-center ep:gap-1">
							<div
								ref={sparklesRef}
								class="ep:flex ep:items-center ep:justify-center ep:w-10 ep:h-10 ep:text-obs-accent ep:opacity-70 ep:leading-none [&_svg]:ep:w-10 [&_svg]:ep:h-10"
							/>
							<div class="ep:text-center">
								<div class="ep:text-ui-medium ep:font-semibold ep:text-obs-normal ep:mb-1">
									Chat
								</div>
								<div class="ep:text-sm ep:text-obs-muted">
									Ask anything about your notes and flashcards
								</div>
							</div>
						</div>
						<div class="ep:flex ep:flex-col ep:gap-2 ep:w-full ep:max-w-[280px]">
							{SUGGESTED_QUESTIONS.map((q) => (
								<Clickable
									key={q}
									class="ep:text-sm ep:text-obs-muted ep:text-left ep:px-4 ep:py-2.5 ep:rounded-xl ep:border ep:border-obs-border ep:hover:border-obs-interactive ep:hover:text-obs-normal ep:transition-colors ep:leading-snug"
									onClick={() => handleSend(q)}
								>
									{q}
								</Clickable>
							))}
						</div>
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

			<ChatInput onSend={handleSend} disabled={streaming} />
		</div>
	);
}
