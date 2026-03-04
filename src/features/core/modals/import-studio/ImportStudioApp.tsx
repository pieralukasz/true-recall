import {
	parseBulkText,
	type ParsedCard,
} from "@features/study/services/flashcard/bulk-card-parser";
import { Clickable } from "@shared/ui/components/Clickable";
import type { NoteType } from "@shared/types/note.types";
import { CardPreviewList } from "@features/core/modals/add-flashcards/CardPreviewList";
import { CopyPromptButton } from "@features/core/modals/add-flashcards/CopyPromptButton";
import { NoteTypePicker } from "@features/core/modals/add-flashcards/NoteTypePicker";
import { NotePickerCombobox } from "@shared/ui/components/NotePickerCombobox";
import type { EmbeddableEditorInstance } from "@shared/ui/editor/embedded-editor";
import { useApp, usePlugin } from "@shared/ui/preact/ObsidianContext";
import { SECONDARY_BUTTON_CLASSES } from "@shared/ui/utils/tailwind";
import { Compartment } from "@codemirror/state";
import { placeholder } from "@codemirror/view";
import { Notice, TFile } from "obsidian";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
	loadImportStudioPrefs,
	saveImportStudioPrefs,
} from "./types";

interface ImportStudioAppProps {
	onClose: () => void;
	defaultNoteTypeId?: string;
}

// ── Placeholder text per NoteType ─────────────────────────────────────────

function buildPlaceholder(noteType: NoteType | null): string {
	if (!noteType) return "Paste or type flashcards...";

	if (noteType.type === 1) {
		return "{{c1::Paris}} is the capital of France.\n{{c2::Berlin}} is the capital of Germany.";
	}

	if (noteType.fields.length >= 3) {
		const header = noteType.fields.join("\t");
		const example = noteType.fields.map((f) => `[${f}]`).join("\t");
		return `${header}\n${example}`;
	}

	const [f1, f2] = noteType.fields;
	return `${f1 ?? "Front"} :: ${f2 ?? "Back"}\n${f1 ?? "Front"} :: ${f2 ?? "Back"}`;
}

// ── Component ─────────────────────────────────────────────────────────────

export function ImportStudioApp({
	onClose,
	defaultNoteTypeId,
}: ImportStudioAppProps) {
	const app = useApp();
	const plugin = usePlugin();
	const prefs = useMemo(() => loadImportStudioPrefs(), []);

	const editorContainerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<EmbeddableEditorInstance | null>(null);
	// Compartment lets us hot-swap the placeholder extension without recreating the editor
	const placeholderCompartment = useRef(new Compartment()).current;

	const [text, setText] = useState("");
	const [noteTypeId, setNoteTypeId] = useState(
		defaultNoteTypeId ?? prefs.lastNoteTypeId,
	);
	const [sessionCount, setSessionCount] = useState(0);

	// Source note picker
	const initialSourceNote = useMemo(() => {
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
	}>({ cards: [], detectedFormat: "none" });

	useEffect(() => {
		const timer = setTimeout(() => {
			if (noteType) {
				setParseResult(parseBulkText(text, { noteType }));
			} else {
				setParseResult(parseBulkText(text));
			}
		}, 150);
		return () => clearTimeout(timer);
	}, [text, noteType]);

	// Create editor on mount. Stable deps — onChange updates text state via callback.
	useEffect(() => {
		const el = editorContainerRef.current;
		if (!el || !plugin.EmbeddableEditor) return;

		let editor: EmbeddableEditorInstance;
		try {
			editor = new plugin.EmbeddableEditor(app, el, {
				onChange: (update) => setText(update.state.doc.toString()),
				extraExtensions: [
					placeholderCompartment.of(
						placeholder(buildPlaceholder(noteType)),
					),
				],
			});
		} catch (err) {
			console.error("[ImportStudioApp] Failed to create editor:", err);
			return;
		}

		editorRef.current = editor;
		editor.cm.focus();

		return () => {
			editorRef.current = null;
			editor.destroy();
		};
	}, [app, plugin.EmbeddableEditor]); // eslint-disable-line react-hooks/exhaustive-deps

	// Hot-swap placeholder when NoteType changes — preserves typed content
	useEffect(() => {
		const editor = editorRef.current;
		if (!editor) return;
		editor.cm.dispatch({
			effects: placeholderCompartment.reconfigure(
				placeholder(buildPlaceholder(noteType)),
			),
		});
	}, [noteType, placeholderCompartment]);

	// Handlers

	const handleNoteTypeChange = useCallback((id: string) => {
		setNoteTypeId(id);
		saveImportStudioPrefs({ lastNoteTypeId: id });
	}, []);

	const handleSourceNoteChange = useCallback((note: TFile | null) => {
		setSelectedSourceNote(note);
		saveImportStudioPrefs({ lastSourceNotePath: note?.path ?? "" });
	}, []);

	const resolveSourceUid = useCallback(async (): Promise<
		string | undefined
	> => {
		if (!selectedSourceNote || !plugin.flashcardManager) return undefined;
		const fmService = plugin.flashcardManager.getFrontmatterService();
		let uid = await fmService.getSourceNoteUid(selectedSourceNote);
		if (!uid) {
			uid = fmService.generateUid();
			await fmService.setSourceNoteUid(selectedSourceNote, uid);
		}
		return uid;
	}, [selectedSourceNote, plugin.flashcardManager]);

	const handleSave = useCallback(async () => {
		if (parseResult.cards.length === 0) return;
		if (!plugin.flashcardManager?.hasStore()) {
			new Notice("Database not initialized");
			return;
		}

		const sourceUid = await resolveSourceUid();

		const result = plugin.flashcardManager.createNoteBatch(
			parseResult.cards.map((c) => ({
				noteTypeId: c.noteTypeId,
				fields: c.fields,
				sourceUid,
				createdVia: "manual",
			})),
		);

		const totalCards = result.cards.length;
		setSessionCount((prev) => prev + totalCards);
		new Notice(`Created ${totalCards} card${totalCards !== 1 ? "s" : ""}`);

		// Clear editor — onChange fires and updates text state
		if (editorRef.current) {
			editorRef.current.set("");
			editorRef.current.cm.focus();
		} else {
			setText("");
		}
		// Clear preview immediately rather than waiting for debounce
		setParseResult({ cards: [], detectedFormat: "none" });
	}, [parseResult.cards, plugin.flashcardManager, resolveSourceUid]);

	return (
		<div class="ep:flex ep:flex-col ep:gap-4">
			{/* Top row: note type + source note */}
			<div class="ep:flex ep:items-center ep:gap-3 ep:flex-wrap">
				<label class="ep:text-ui-smaller ep:text-obs-muted ep:shrink-0">
					Note type:
				</label>
				<NoteTypePicker value={noteTypeId} onChange={handleNoteTypeChange} />

				<span class="ep:text-obs-faint ep:text-ui-smaller">|</span>

				<label class="ep:text-ui-smaller ep:text-obs-muted ep:shrink-0">
					Source:
				</label>
				<div class="ep:flex-1 ep:min-w-[160px]">
					<NotePickerCombobox
						app={app}
						selectedNote={selectedSourceNote}
						onSelect={handleSourceNoteChange}
					/>
				</div>
				{selectedSourceNote && (
					<Clickable
						class="ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal"
						onClick={() => handleSourceNoteChange(null)}
					>
						Clear
					</Clickable>
				)}
			</div>

			{/* Editor — CM6 with fallback textarea */}
			{plugin.EmbeddableEditor ? (
				<div
					ref={editorContainerRef}
					class="ep:w-full ep:min-h-[220px] ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:overflow-hidden"
				/>
			) : (
				<textarea
					class="ep:w-full ep:min-h-[220px] ep:px-3 ep:py-2 ep:text-ui-small ep:font-mono ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:resize-y ep:placeholder-obs-faint"
					placeholder={buildPlaceholder(noteType)}
					value={text}
					onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
				/>
			)}

			{/* Toolbar row: copy prompt + format hint */}
			<div class="ep:flex ep:items-center ep:justify-between ep:gap-4">
				<CopyPromptButton noteType={noteType ?? undefined} />
				{parseResult.cards.length > 0 && (
					<span class="ep:text-ui-smaller ep:text-obs-muted">
						Format: {parseResult.detectedFormat} · {parseResult.cards.length}{" "}
						card{parseResult.cards.length !== 1 ? "s" : ""}
					</span>
				)}
			</div>

			{/* Preview list */}
			<CardPreviewList cards={parseResult.cards} />

			{/* Footer */}
			<div class="ep-modal-footer ep:flex ep:justify-between ep:items-center">
				<span class="ep:text-ui-smaller ep:text-obs-faint">
					{sessionCount > 0 &&
						`${sessionCount} card${sessionCount !== 1 ? "s" : ""} saved this session`}
				</span>
				<div class="ep:flex ep:items-center ep:gap-3">
					<Clickable
						class={SECONDARY_BUTTON_CLASSES}
						onClick={onClose}
						stopPropagation={false}
					>
						Close
					</Clickable>
					<Clickable
						class="mod-cta ep-btn"
						onClick={handleSave}
						disabled={parseResult.cards.length === 0}
						stopPropagation={false}
					>
						Save{" "}
						{parseResult.cards.length > 0
							? `${parseResult.cards.length} `
							: ""}
						Card{parseResult.cards.length !== 1 ? "s" : ""}
					</Clickable>
				</div>
			</div>
		</div>
	);
}
