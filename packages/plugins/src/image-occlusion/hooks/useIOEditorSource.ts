import type { TFile } from "obsidian";
import { useCallback, useMemo, useState } from "preact/hooks";

import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";

import type { IOEditorMode } from "../types";

interface SourceDetails {
	label: string;
	path: string;
}

function getSourceDetails(
	mode: IOEditorMode,
	selectedNote: TFile | null,
	resolveSourceNote: (sourceUid: string) => {
		notePath?: string;
		noteName?: string;
	},
): SourceDetails {
	if (mode.mode === "edit") {
		const sourceUid = mode.note.sourceUid;
		if (!sourceUid) return { label: "Source: not linked", path: "" };

		const source = resolveSourceNote(sourceUid);
		if (source.notePath) {
			return { label: `Source: ${source.notePath}`, path: source.notePath };
		}
		if (source.noteName) {
			return { label: `Source: ${source.noteName}`, path: "" };
		}
		return { label: `Source UID: ${sourceUid}`, path: "" };
	}

	if (!mode.sourceUid) {
		return selectedNote
			? {
					label: `Source: ${selectedNote.path}`,
					path: selectedNote.path,
				}
			: { label: "Source: select note before saving", path: "" };
	}

	const source = resolveSourceNote(mode.sourceUid);
	if (source.notePath) {
		return { label: `Source: ${source.notePath}`, path: source.notePath };
	}
	if (source.noteName) {
		return { label: `Source: ${source.noteName}`, path: "" };
	}
	return { label: "Source: linked note", path: "" };
}

export function useIOEditorSource(mode: IOEditorMode) {
	const plugin = usePlugin();
	const [selectedNote, setSelectedNote] = useState<TFile | null>(null);
	const showPicker = mode.mode === "add" && !mode.sourceUid;
	const details = useMemo(() => {
		const sourceNoteService = plugin.flashcardManager.getSourceNoteService();
		return getSourceDetails(mode, selectedNote, (sourceUid) =>
			sourceNoteService.resolveSourceNote(sourceUid),
		);
	}, [mode, plugin.flashcardManager, selectedNote]);

	const resolveUid = useCallback(async (): Promise<string | undefined> => {
		if (mode.mode === "edit") return mode.note.sourceUid;
		if (mode.sourceUid) return mode.sourceUid;
		if (!selectedNote) return undefined;

		const frontmatter = plugin.flashcardManager.getFrontmatterService();
		let uid = await frontmatter.getSourceNoteUid(selectedNote.path);
		if (!uid) {
			uid = frontmatter.generateUid();
			await frontmatter.setSourceNoteUid(selectedNote.path, uid);
		}
		return uid;
	}, [mode, plugin.flashcardManager, selectedNote]);

	return {
		showPicker,
		selectedNote,
		setSelectedNote,
		label: details.label,
		path: details.path,
		resolveUid,
	};
}
