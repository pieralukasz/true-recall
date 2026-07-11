import { Notice } from "obsidian";
import { useCallback, useMemo, useState } from "preact/hooks";

import { IconButton } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";

import type { KnowledgeChatView } from "../../../../views/chat/KnowledgeChatView";
import type { IndexProgress } from "../../services/rag-indexer.service";

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

export function IndexStatus({ view: _view }: Props) {
	const plugin = usePlugin();
	const [reindexing, setReindexing] = useState(false);
	const [progress, setProgress] = useState("");

	const stats = useMemo(() => {
		if (!plugin.ragActions) return null;
		return plugin.ragActions.getStats();
	}, [plugin]);

	const handleReindex = useCallback(async () => {
		if (!plugin.ragIndexer || reindexing) return;
		setReindexing(true);
		const notice = new Notice("Indexing knowledge base...", 0);

		try {
			const result = await plugin.ragIndexer.fullReindex((p) => {
				const msg = formatProgress(p);
				notice.messageEl.setText(msg);
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
			? `${stats.embeddedChunks.toLocaleString()} chunks`
			: "Not indexed";

	return (
		<div class="ep:flex ep:items-center ep:gap-1">
			<span class="ep:text-[10px] ep:text-obs-faint">
				{reindexing ? progress : label}
			</span>
			<IconButton
				icon="refresh-cw"
				ariaLabel="Reindex knowledge base"
				onClick={() => void handleReindex()}
				disabled={reindexing}
				size="small"
			/>
		</div>
	);
}
