import { Notice } from "obsidian";
import { useCallback, useState } from "preact/hooks";

import { hasAIKey } from "@true-recall/core/ai/config/ai-client-config";
import { RAG_FREE_NOTE_LIMIT } from "@true-recall/core/constants";

import {
	ActionButton,
	FolderPicker,
	FormField,
	InfoBlock,
	TextAreaInput,
	ToggleInput,
} from "@true-recall/obsidian/components";
import type { IndexProgress } from "@true-recall/obsidian/features/rag/services/rag-indexer.service";
import { usePlugin } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";

import type { PluginSettingsProps } from "../types";

function formatProgress(p: IndexProgress): string {
	switch (p.phase) {
		case "notes":
			return `Indexing notes... ${p.current}/${p.total}`;
		case "flashcards":
			return `Indexing flashcards... ${p.current}/${p.total}`;
		case "embedding":
			return `Embedding chunks... ${p.current}/${p.total}`;
	}
}

export function KnowledgeBaseSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	const plugin = usePlugin();
	const [reindexing, setReindexing] = useState(false);
	const [progress, setProgress] = useState("");
	const isPro = !!settings.proKey;

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

	if (!hasAIKey(settings)) {
		return (
			<InfoBlock>
				Configure an AI key in <strong>General → AI Provider</strong> to use
				Knowledge Base.
			</InfoBlock>
		);
	}

	return (
		<>
			<InfoBlock>
				Index your vault for semantic search. AI assistants can search your
				notes and flashcards with awareness of FSRS mastery levels.
			</InfoBlock>

			{!isPro && (
				<InfoBlock>
					Free tier: up to {RAG_FREE_NOTE_LIMIT} notes indexed.{" "}
					<strong>Upgrade to Pro</strong> for unlimited indexing.
				</InfoBlock>
			)}

			<FormField
				name="Auto-index"
				description="Re-index automatically when files change"
			>
				<ToggleInput
					value={settings.ragAutoIndex}
					onChange={(v) => void save({ ragAutoIndex: v })}
				/>
			</FormField>

			<FormField
				name="Index flashcards"
				description="Also index flashcard content alongside notes"
			>
				<ToggleInput
					value={settings.ragIndexFlashcards}
					onChange={(v) => void save({ ragIndexFlashcards: v })}
				/>
			</FormField>

			<FormField
				name="Include folders"
				description="Only index notes in these folders (empty = all)"
			>
				<FolderPicker
					value={settings.ragIncludeFolders}
					onChange={(v) => void save({ ragIncludeFolders: v })}
					placeholder="Search folders to include..."
				/>
			</FormField>

			<FormField
				name="Exclude folders"
				description="Skip notes in these folders"
			>
				<FolderPicker
					value={settings.ragExcludeFolders}
					onChange={(v) => void save({ ragExcludeFolders: v })}
					placeholder="Search folders to exclude..."
				/>
			</FormField>

			<FormField
				name="Daily notes folder"
				description="Override daily notes folder for smarter indexing (empty = auto-detect)"
			>
				<FolderPicker
					value={
						settings.ragDailyNotesFolder ? [settings.ragDailyNotesFolder] : []
					}
					onChange={(v) => void save({ ragDailyNotesFolder: v[0] ?? "" })}
					placeholder="Select daily notes folder..."
				/>
			</FormField>

			<FormField
				name="Daily note excluded headings"
				description="Sections under these headings won't be indexed in daily notes (one per line)"
			>
				<TextAreaInput
					value={settings.ragDailyNoteExcludeHeadings.join("\n")}
					onChange={(v) =>
						void save({
							ragDailyNoteExcludeHeadings: v
								.split("\n")
								.map((s) => s.trim())
								.filter(Boolean),
						})
					}
					rows={3}
					placeholder={"Thoughts\nJournal\nReflections"}
				/>
			</FormField>

			<FormField
				name="Manual reindex"
				description={progress || "Re-chunk and re-embed all vault content"}
			>
				<ActionButton
					label={reindexing ? "Reindexing..." : "Reindex now"}
					variant="primary"
					onClick={() => void handleReindex()}
					disabled={reindexing}
				/>
			</FormField>
		</>
	);
}
