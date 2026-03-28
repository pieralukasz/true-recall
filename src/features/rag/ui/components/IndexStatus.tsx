import type { IndexProgress } from "@features/rag/services/rag-indexer.service";
import { notify } from "@shared/services/notification.service";
import { Clickable } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { Notice } from "obsidian";
import { useCallback, useMemo, useState } from "preact/hooks";
import type { KnowledgeChatView } from "../KnowledgeChatView";

function formatProgress(p: IndexProgress): string {
	switch (p.phase) {
		case "notes":
			return `Notes ${p.current}/${p.total}`;
		case "flashcards":
			return `Flashcards ${p.current}/${p.total}`;
		case "embedding":
			return `Embedding ${p.current}/${p.total}`;
	}
}

interface Props {
	view: KnowledgeChatView;
}

export function IndexStatus({ view }: Props) {
	const plugin = usePlugin();
	const [reindexing, setReindexing] = useState(false);
	const [progress, setProgress] = useState("");

	const stats = useMemo(() => {
		if (!plugin.isStoreReady()) return null;
		return plugin.cardStore.rag.getStats();
	}, [plugin]);

	const handleReindex = useCallback(async () => {
		if (!plugin.ragIndexer || reindexing) return;
		setReindexing(true);
		const notice = new Notice("Indexing knowledge base...", 0);

		try {
			const result = await plugin.ragIndexer.fullReindex((p) => {
				const msg = formatProgress(p);
				notice.noticeEl.setText(msg);
				setProgress(msg);
			});

			notice.hide();
			notify().success(
				`Indexed ${result.indexed} files, embedded ${result.embedded} chunks`,
			);
		} catch (e) {
			notice.hide();
			notify().error("Reindex failed", e);
		} finally {
			setReindexing(false);
			setProgress("");
		}
	}, [plugin, reindexing]);

	if (!stats) return null;

	const label =
		stats.totalChunks > 0
			? `${stats.embeddedChunks.toLocaleString()} chunks indexed`
			: "Not indexed yet";

	return (
		<div class="ep:flex ep:items-center ep:justify-center ep:gap-2 ep:px-3 ep:py-1.5 ep:text-[10px] ep:text-obs-muted ep:border-t ep:border-obs-border">
			<span>{reindexing ? progress : label}</span>
			<Clickable
				class="ep:text-[10px] ep:text-obs-muted ep:underline ep:hover:text-obs-normal"
				onClick={handleReindex}
				aria-disabled={reindexing}
			>
				{reindexing ? "..." : "Reindex"}
			</Clickable>
		</div>
	);
}
