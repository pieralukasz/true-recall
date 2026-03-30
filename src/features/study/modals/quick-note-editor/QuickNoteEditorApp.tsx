import type { EditorView } from "@codemirror/view";
import { CardTypesEditorModal } from "@features/core/modals/card-types-editor/CardTypesEditorModal";
import { NoteTypeManagerModal } from "@features/core/modals/NoteTypeManagerModal";
import { Clickable } from "@shared/ui/components/Clickable";
import {
	type FormattingTargetRef,
	FormattingToolbar,
} from "@shared/ui/editor/formatting";
import { useIcon } from "@shared/ui/preact/hooks";
import { useApp, usePlugin } from "@shared/ui/preact/ObsidianContext";
import { Notice, TFile } from "obsidian";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import { ActionBar } from "./ActionBar";
import { NoteFieldsForm } from "./NoteFieldsForm";
import type {
	AddMode,
	EditMode,
	QuickNoteEditorMode,
	QuickNoteEditorResult,
} from "./types";

interface QuickNoteEditorAppProps {
	mode: QuickNoteEditorMode;
	onDone: (result: QuickNoteEditorResult) => void;
	onRequestClose?: () => void;
	onContentChange?: (hasContent: boolean) => void;
}

export function QuickNoteEditorApp({
	mode,
	onDone,
	onRequestClose,
	onContentChange,
}: QuickNoteEditorAppProps) {
	const app = useApp();
	const plugin = usePlugin();

	const isEdit = mode.mode === "edit";
	const editMode = isEdit ? mode : null;
	const addMode = !isEdit ? mode : null;

	// ── State ──

	const [noteTypeId, setNoteTypeId] = useState<string>(() => {
		if (isEdit && editMode?.noteType.id) {
			return editMode.noteType.id;
		}
		return addMode?.defaultNoteTypeId ?? "builtin-basic";
	});

	const [fields, setFields] = useState<Record<string, string>>(() => {
		if (isEdit) return { ...editMode?.note.fields };
		if (addMode?.initialFields) return { ...addMode.initialFields };
		return {};
	});

	const [saving, setSaving] = useState(false);
	const [pinnedFields, setPinnedFields] = useState<Set<string>>(new Set());
	const [refreshCounter, setRefreshCounter] = useState(0);
	const [alwaysTypeIn, setAlwaysTypeIn] = useState(false);

	// Focus tracking for shared formatting toolbar
	const focusedFieldRef = useRef<FormattingTargetRef | null>(null);
	const handleFieldFocus = useCallback(
		(fieldName: string, editorView: EditorView) => {
			focusedFieldRef.current = { fieldName, editorView };
		},
		[],
	);

	// Source note picker — only shown in add mode without pre-set sourceUid
	const showSourcePicker = !isEdit && !addMode?.sourceUid;
	const [selectedSourceNote, setSelectedSourceNote] = useState<TFile | null>(
		null,
	);

	// ── Derived ──

	const noteType = useMemo(() => {
		if (isEdit) return editMode?.noteType;
		return plugin.cardStore?.noteTypes?.getById(noteTypeId) ?? null;
	}, [isEdit, editMode, plugin.cardStore, noteTypeId, refreshCounter]);

	const hasContent = useMemo(
		() => Object.values(fields).some((v) => v.trim().length > 0),
		[fields],
	);

	const canSave = useMemo(() => {
		const firstField = noteType?.fields[0];
		if (!firstField) return false;
		return (fields[firstField] ?? "").trim().length > 0;
	}, [fields, noteType]);

	const sourceNoteFile = useMemo<TFile | null>(() => {
		if (showSourcePicker) return selectedSourceNote;
		const uid = addMode?.sourceUid ?? editMode?.note.sourceUid;
		if (!uid) return null;
		const path = plugin.frontmatterIndex?.getFileByValue("flashcard_uid", uid);
		if (!path) return null;
		const f = app.vault.getAbstractFileByPath(path);
		return f instanceof TFile ? f : null;
	}, [
		showSourcePicker,
		selectedSourceNote,
		addMode,
		editMode,
		plugin.frontmatterIndex,
	]);

	useEffect(() => {
		onContentChange?.(hasContent);
	}, [hasContent, onContentChange]);

	// Initialize empty fields when note type changes in add mode
	useEffect(() => {
		if (isEdit || !noteType) return;
		setFields((prev) => {
			const next: Record<string, string> = {};
			for (const fieldName of noteType.fields) {
				next[fieldName] = prev[fieldName] ?? "";
			}
			return next;
		});
		// Clean up stale pins for fields no longer in the note type
		setPinnedFields((prev) => {
			const valid = new Set(noteType.fields);
			const next = new Set([...prev].filter((f) => valid.has(f)));
			return next.size === prev.size ? prev : next;
		});
	}, [noteType, isEdit]);

	// ── Handlers ──

	const handleFieldChange = useCallback((fieldName: string, value: string) => {
		setFields((prev) => ({ ...prev, [fieldName]: value }));
	}, []);

	const handleNoteTypeChange = useCallback((id: string) => {
		setNoteTypeId(id);
	}, []);

	const handleChangeType = useCallback(async () => {
		if (!noteType || !editMode?.noteId) return;

		const { ChangeNoteTypeModal } = await import(
			"@features/library/modals/ChangeNoteTypeModal"
		);
		const allNoteTypes = plugin.cardStore.noteTypes.getAll();

		const modal = new ChangeNoteTypeModal(app, {
			currentNoteType: noteType,
			availableNoteTypes: allNoteTypes,
			noteCount: 1,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNoteTypeId || !result.fieldMapping)
			return;

		plugin.flashcardManager.changeNoteType(
			editMode.noteId,
			result.targetNoteTypeId,
			result.fieldMapping,
		);

		onDone({ cancelled: false });
	}, [noteType, app, plugin, editMode, onDone]);

	const togglePin = useCallback((fieldName: string) => {
		setPinnedFields((prev) => {
			const next = new Set(prev);
			if (next.has(fieldName)) next.delete(fieldName);
			else next.add(fieldName);
			return next;
		});
	}, []);

	const handleNoteTypeRefresh = useCallback(() => {
		setRefreshCounter((c) => c + 1);
	}, []);

	const openFields = useCallback(() => {
		const modal = new NoteTypeManagerModal(app, plugin);
		const origClose = modal.onClose.bind(modal);
		modal.onClose = () => {
			origClose();
			handleNoteTypeRefresh();
		};
		modal.open();
	}, [app, plugin, handleNoteTypeRefresh]);

	const openCards = useCallback(() => {
		const modal = new CardTypesEditorModal(app, plugin, noteTypeId);
		const origClose = modal.onClose.bind(modal);
		modal.onClose = () => {
			origClose();
			handleNoteTypeRefresh();
		};
		modal.open();
	}, [app, plugin, noteTypeId, handleNoteTypeRefresh]);

	const resolveSourceUid = useCallback(async (): Promise<
		string | undefined
	> => {
		// Edit mode: keep existing sourceUid
		if (isEdit) return editMode?.note.sourceUid;

		// Add mode with pre-set sourceUid (from review card)
		if (addMode?.sourceUid) return addMode?.sourceUid;

		// Add mode with selected source note
		if (!selectedSourceNote || !plugin.flashcardManager) return undefined;
		const fmService = plugin.flashcardManager.getFrontmatterService();
		let uid = await fmService.getSourceNoteUid(selectedSourceNote.path);
		if (!uid) {
			uid = fmService.generateUid();
			await fmService.setSourceNoteUid(selectedSourceNote.path, uid);
		}
		return uid;
	}, [isEdit, editMode, addMode, selectedSourceNote, plugin.flashcardManager]);

	const handleSave = useCallback(async () => {
		if (!noteType || !canSave || saving) return;
		if (!plugin.flashcardManager?.hasStore()) {
			new Notice("Database not initialized");
			return;
		}

		setSaving(true);

		try {
			if (isEdit) {
				const unchanged = noteType.fields.every(
					(f) => fields[f] === editMode?.note.fields[f],
				);
				if (unchanged) {
					onDone({ cancelled: true });
					return;
				}

				if (!editMode) return;
				const result = plugin.flashcardManager.updateNoteFields(
					editMode.noteId,
					fields,
				);

				onDone({
					cancelled: false,
					updatedCardIds: result.updatedCardIds,
				});
			} else {
				const sourceUid = await resolveSourceUid();

				const result = plugin.flashcardManager.createNote({
					noteTypeId,
					fields,
					alwaysTypeIn,
					sourceUid,
					createdVia: "manual",
				});

				const totalCards = result.cards.length;
				new Notice(`Created ${totalCards} card${totalCards !== 1 ? "s" : ""}`);

				// Clear unpinned fields, keep pinned — modal stays open
				const next: Record<string, string> = {};
				for (const field of noteType.fields) {
					next[field] = pinnedFields.has(field) ? (fields[field] ?? "") : "";
				}
				setFields(next);
				setSaving(false);
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			new Notice(`Error: ${msg}`);
			setSaving(false);
		}
	}, [
		noteType,
		canSave,
		saving,
		isEdit,
		editMode,
		fields,
		noteTypeId,
		resolveSourceUid,
		alwaysTypeIn,
		plugin.flashcardManager,
		onDone,
		pinnedFields,
	]);

	// Cmd/Ctrl+Enter saves from anywhere in the modal (not just CM fields).
	// CM fields also handle it via EmbeddableEditor's Scope — the `saving` guard prevents double-fire.
	const handleSaveRef = useRef(handleSave);
	handleSaveRef.current = handleSave;

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				e.stopPropagation();
				void handleSaveRef.current();
			}
		};
		document.addEventListener("keydown", onKeyDown, true);
		return () => document.removeEventListener("keydown", onKeyDown, true);
	}, []);

	if (!noteType) {
		return (
			<div class="ep:text-obs-muted ep:text-center ep:py-8">
				Loading note types...
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
			{/* Action bar: Note type, Source note, AI */}
			<ActionBar
				app={app}
				noteTypeId={noteTypeId}
				onNoteTypeChange={handleNoteTypeChange}
				isEdit={isEdit}
				onChangeType={isEdit ? () => void handleChangeType() : undefined}
				showSourcePicker={showSourcePicker}
				selectedSourceNote={selectedSourceNote}
				onSourceSelect={setSelectedSourceNote}
			/>

			{/* Shared formatting toolbar */}
			<FormattingToolbar
				app={app}
				getEditorView={() => focusedFieldRef.current?.editorView ?? null}
				typeInEnabled={alwaysTypeIn}
				onTypeInToggle={!isEdit ? setAlwaysTypeIn : undefined}
			/>

			{/* Dynamic fields */}
			<NoteFieldsForm
				noteType={noteType}
				fields={fields}
				onFieldChange={handleFieldChange}
				onFieldFocus={handleFieldFocus}
				onModEnter={() => void handleSave()}
				onEscape={onRequestClose}
				pinnedFields={pinnedFields}
				onTogglePin={togglePin}
			/>

			{/* Footer */}
			<FooterBar
				app={app}
				isEdit={isEdit}
				canSave={canSave}
				saving={saving}
				requiresSourceNote={showSourcePicker && !selectedSourceNote}
				sourceNoteFile={sourceNoteFile}
				onSave={() => void handleSave()}
				onOpenFields={openFields}
				onOpenCards={openCards}
			/>
		</div>
	);
}

// ── Footer ───────────────────────────────────────────────────────────────

interface FooterBarProps {
	app: import("obsidian").App;
	isEdit: boolean;
	canSave: boolean;
	saving: boolean;
	requiresSourceNote: boolean;
	sourceNoteFile: TFile | null;
	onSave: () => void;
	onOpenFields: () => void;
	onOpenCards: () => void;
}

const ghostBtnCls =
	"ep-btn ep-btn-ghost ep:text-ui-smaller ep:px-2 ep:py-1 ep:min-h-[28px] ep:max-h-[28px]";

function FooterBar({
	app,
	isEdit,
	canSave,
	saving,
	requiresSourceNote,
	sourceNoteFile,
	onSave,
	onOpenFields,
	onOpenCards,
}: FooterBarProps) {
	const aiIconRef = useIcon("wand");

	const openAI = useCallback(() => {
		new Notice("AI generation coming soon");
	}, []);

	const openNote = useCallback(() => {
		if (sourceNoteFile) {
			void app.workspace.getLeaf().openFile(sourceNoteFile);
		}
	}, [app, sourceNoteFile]);

	return (
		<div class="ep-modal-footer ep:flex ep:items-center ep:gap-2">
			<Clickable
				class={ghostBtnCls}
				onClick={onOpenFields}
				stopPropagation={false}
			>
				Fields
			</Clickable>
			<Clickable
				class={ghostBtnCls}
				onClick={onOpenCards}
				stopPropagation={false}
			>
				Cards
			</Clickable>
			<Clickable
				ref={aiIconRef}
				title="Generate with AI (coming soon)"
				class={`${ghostBtnCls} ep:ml-auto [&>svg]:ep:w-4 [&>svg]:ep:h-4`}
				onClick={openAI}
			/>
			<Clickable
				class={ghostBtnCls}
				onClick={openNote}
				disabled={!sourceNoteFile}
				stopPropagation={false}
			>
				Open note
			</Clickable>
			<Clickable
				class="mod-cta ep-btn"
				onClick={onSave}
				disabled={!canSave || saving || requiresSourceNote}
				title={requiresSourceNote ? "Select a source note to save" : undefined}
				stopPropagation={false}
			>
				{isEdit ? "Save Changes" : "Save"}
			</Clickable>
		</div>
	);
}
