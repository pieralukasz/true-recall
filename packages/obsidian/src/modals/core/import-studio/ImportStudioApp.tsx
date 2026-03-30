import type { EditorView } from "@codemirror/view";
import { CardPreviewList } from "@true-recall/obsidian/modals/core/add-flashcards/CardPreviewList";
import { ActionBar } from "@true-recall/obsidian/modals/core/import-studio/ActionBar";
import { EditorSection } from "@true-recall/obsidian/modals/core/import-studio/EditorSection";
import { FooterBar } from "@true-recall/obsidian/modals/core/import-studio/FooterBar";
import {
	type ParsedCard,
	parseBulkText,
} from "@true-recall/core/flashcard/parsing/bulk-card-parser";
import type { NoteType } from "@true-recall/core/types/note.types";
import type { EmbeddableEditorInstance } from "@true-recall/obsidian/editor/shared/embedded-editor";
import {
	type FormattingTargetRef,
	FormattingToolbar,
} from "@true-recall/obsidian/editor/shared/formatting";
import { useApp, usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { Notice, TFile } from "obsidian";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import { loadImportStudioPrefs, saveImportStudioPrefs } from "./types";

interface ImportStudioAppProps {
	onClose: () => void;
	defaultNoteTypeId?: string;
}

export function ImportStudioApp({
	onClose: _onClose,
	defaultNoteTypeId,
}: ImportStudioAppProps) {
	const app = useApp();
	const plugin = usePlugin();
	const prefs = useMemo(() => loadImportStudioPrefs(app), [app]);

	const editorRef = useRef<EmbeddableEditorInstance | null>(null);
	const focusedEditorRef = useRef<FormattingTargetRef | null>(null);

	const [text, setText] = useState("");
	const [noteTypeId] = useState(defaultNoteTypeId ?? prefs.lastNoteTypeId);
	const [sessionCount, setSessionCount] = useState(0);
	const [saving, setSaving] = useState(false);

	// Source note picker — auto-fill from active file, fall back to last used
	const initialSourceNote = useMemo(() => {
		const activeFile = app.workspace.getActiveFile();
		if (activeFile) return activeFile;
		if (!prefs.lastSourceNotePath) return null;
		const file = app.vault.getAbstractFileByPath(prefs.lastSourceNotePath);
		return file instanceof TFile ? file : null;
	}, [app, prefs.lastSourceNotePath]);

	const [selectedSourceNote, setSelectedSourceNote] = useState<TFile | null>(
		initialSourceNote,
	);

	// Resolve current NoteType object
	const noteType = useMemo<NoteType | null>(() => {
		return plugin.cardStore?.noteTypes?.getById(noteTypeId) ?? null;
	}, [plugin.cardStore, noteTypeId]);

	// Debounced parsing so large pastes don't block the main thread
	const [parseResult, setParseResult] = useState<{
		cards: ParsedCard[];
		detectedFormat: string;
		duplicateCount: number;
	}>({ cards: [], detectedFormat: "none", duplicateCount: 0 });

	const getNoteType = useCallback(
		(slug: string) => plugin.noteTypeService.getBySlug(slug),
		[plugin],
	);

	useEffect(() => {
		const timer = setTimeout(() => {
			const raw = parseBulkText(
				text,
				noteType ? { noteType, getNoteType } : { getNoteType },
			);
			const seen = new Set<string>();
			const unique: ParsedCard[] = [];
			for (const card of raw.cards) {
				const key = `${card.noteTypeId}\0${JSON.stringify(card.fields)}`;
				if (!seen.has(key)) {
					seen.add(key);
					unique.push(card);
				}
			}
			setParseResult({
				cards: unique,
				detectedFormat: raw.detectedFormat,
				duplicateCount: raw.cards.length - unique.length,
			});
		}, 150);
		return () => clearTimeout(timer);
	}, [text, noteType, getNoteType]);

	// Handlers

	const handleSourceNoteChange = useCallback(
		(note: TFile | null) => {
			setSelectedSourceNote(note);
			saveImportStudioPrefs(app, { lastSourceNotePath: note?.path ?? "" });
		},
		[app],
	);

	const resolveSourceUid = useCallback(async (): Promise<
		string | undefined
	> => {
		if (!selectedSourceNote || !plugin.flashcardManager) return undefined;
		const fmService = plugin.flashcardManager.getFrontmatterService();
		let uid = await fmService.getSourceNoteUid(selectedSourceNote.path);
		if (!uid) {
			uid = fmService.generateUid();
			await fmService.setSourceNoteUid(selectedSourceNote.path, uid);
		}
		return uid;
	}, [selectedSourceNote, plugin.flashcardManager]);

	const handleSave = useCallback(async () => {
		if (parseResult.cards.length === 0 || saving) return;
		if (!selectedSourceNote) {
			new Notice("Select a source note first");
			return;
		}
		if (!plugin.flashcardManager?.hasStore()) {
			new Notice("Database not initialized");
			return;
		}

		setSaving(true);
		try {
			const sourceUid = await resolveSourceUid();

			const result = plugin.flashcardManager.createNoteBatch(
				parseResult.cards.map((c) => ({
					noteTypeId: c.noteTypeId,
					fields: c.fields,
					alwaysTypeIn: c.alwaysTypeIn,
					sourceUid,
					createdVia: "manual",
				})),
			);

			const totalCards = result.cards.length;
			setSessionCount((prev) => prev + totalCards);
			new Notice(`Created ${totalCards} card${totalCards !== 1 ? "s" : ""}`);

			if (editorRef.current) {
				editorRef.current.set("");
				editorRef.current.cm.focus();
			} else {
				setText("");
			}
			setParseResult({ cards: [], detectedFormat: "none", duplicateCount: 0 });
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			new Notice(`Error: ${msg}`);
		} finally {
			setSaving(false);
		}
	}, [parseResult.cards, plugin.flashcardManager, resolveSourceUid, saving]);

	const handleEditorReady = useCallback(
		(editor: EmbeddableEditorInstance | null) => {
			editorRef.current = editor;
		},
		[],
	);

	const handleEditorFocus = useCallback((editorView: EditorView) => {
		focusedEditorRef.current = { editorView };
	}, []);

	const getEditorView = useCallback(
		() => focusedEditorRef.current?.editorView ?? null,
		[],
	);

	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
			<ActionBar
				app={app}
				selectedSourceNote={selectedSourceNote}
				onSourceSelect={handleSourceNoteChange}
			/>

			<FormattingToolbar app={app} getEditorView={getEditorView} />

			<EditorSection
				app={app}
				text={text}
				onTextChange={setText}
				onEditorReady={handleEditorReady}
				onEditorFocus={handleEditorFocus}
				onModEnter={() => void handleSave()}
			/>

			<CardPreviewList
				cards={parseResult.cards}
				duplicateCount={parseResult.duplicateCount}
			/>

			<FooterBar
				sessionCount={sessionCount}
				cardCount={parseResult.cards.length}
				detectedFormat={parseResult.detectedFormat}
				saving={saving}
				hasSourceNote={selectedSourceNote !== null}
				onSave={() => void handleSave()}
			/>
		</div>
	);
}
