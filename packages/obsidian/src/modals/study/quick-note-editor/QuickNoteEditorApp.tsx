import type { EditorView } from "@codemirror/view";
import { Notice, TFile } from "obsidian";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";

import type { AssistantContext } from "@true-recall/core/ai/assistant";
import { hasAIKey } from "@true-recall/core/ai/config/ai-client-config";

import { BatchCreateCommand } from "@true-recall/obsidian/commands/commands/card-create.cmd";
import { Clickable } from "@true-recall/obsidian/components";
import {
	type FormattingTargetRef,
	FormattingToolbar,
} from "@true-recall/obsidian/editor/shared/formatting";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import {
	useApp,
	usePlugin,
} from "@true-recall/obsidian/preact/ObsidianContext";
import { useKeyboardInset } from "@true-recall/obsidian/preact/useKeyboardInset";
import { registerAssistantDraftTarget } from "@true-recall/obsidian/services/assistant/assistant-draft-target-registry";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { isMobile } from "@true-recall/obsidian/utils/platform";
import { openAssistantEditorWindow } from "@true-recall/obsidian/views/modal-window/open-assistant-editor-window";
import { openCardTypesEditor } from "@true-recall/obsidian/views/modal-window/open-card-types-editor";
import { openNoteTypeManager } from "@true-recall/obsidian/views/modal-window/open-note-type-manager";

import { ActionBar } from "./ActionBar";
import { deriveAIWandState } from "./ai-wand-state";
import { NoteFieldsForm } from "./NoteFieldsForm";
import type { QuickNoteEditorMode, QuickNoteEditorResult } from "./types";
import { UserCommentField } from "./UserCommentField";

interface QuickNoteEditorAppProps {
	mode: QuickNoteEditorMode;
	onDone: (result: QuickNoteEditorResult) => void;
	onRequestClose?: () => void;
	onDirtyChange?: (isDirty: boolean) => void;
}

export function QuickNoteEditorApp({
	mode,
	onDone,
	onRequestClose,
	onDirtyChange,
}: QuickNoteEditorAppProps) {
	const app = useApp();
	const plugin = usePlugin();
	useKeyboardInset();

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

	const initialFieldsRef = useRef<Record<string, string> | null>(null);

	const [fields, setFields] = useState<Record<string, string>>(() => {
		if (isEdit) {
			const f = { ...editMode?.note.fields };
			initialFieldsRef.current = f;
			return f;
		}
		if (addMode?.initialFields) return { ...addMode.initialFields };
		return {};
	});
	const fieldsRef = useRef(fields);
	fieldsRef.current = fields;
	const initialUserCommentRef = useRef(editMode?.note.userComment ?? "");
	const [userComment, setUserComment] = useState(
		() => editMode?.note.userComment ?? "",
	);
	const userCommentRef = useRef(userComment);
	userCommentRef.current = userComment;
	const userCommentInputRef = useRef<HTMLTextAreaElement>(null);
	const savingRef = useRef(false);
	// Cmd+Z right after "Save & Add" undoes the creation and restores the
	// typed fields into the modal. Any user edit invalidates the pending undo.
	const pendingCreateUndoRef = useRef<{
		command: BatchCreateCommand;
		fields: Record<string, string>;
	} | null>(null);
	const assistantDraftSessionIdRef = useRef(`qne-${crypto.randomUUID()}`);
	const closeAssistantWindowRef = useRef<(() => void) | null>(null);

	useEffect(
		() =>
			registerAssistantDraftTarget(assistantDraftSessionIdRef.current, {
				getFields: () => fieldsRef.current,
				applyFields: (next) => {
					pendingCreateUndoRef.current = null;
					setFields((current) => {
						const merged = { ...current, ...next };
						fieldsRef.current = merged;
						return merged;
					});
				},
			}),
		[],
	);

	useEffect(
		() => () => {
			const close = closeAssistantWindowRef.current;
			closeAssistantWindowRef.current = null;
			close?.();
		},
		[],
	);

	const [saving, setSaving] = useState(false);
	const [pinnedFields, setPinnedFields] = useState<Set<string>>(new Set());
	const [refreshCounter, setRefreshCounter] = useState(0);
	const [alwaysTypeIn, setAlwaysTypeIn] = useState(false);
	const [focusFirstRequest, setFocusFirstRequest] = useState(0);

	// Focus tracking for shared formatting toolbar
	const focusedFieldRef = useRef<FormattingTargetRef | null>(null);
	const handleFieldFocus = useCallback(
		(fieldName: string, editorView: EditorView) => {
			focusedFieldRef.current = { fieldName, editorView };
		},
		[],
	);

	// Source note picker — only shown in add mode without pre-set sourceUid.
	// Default to the note the user was just working in: cards created from a
	// text selection or the "+" entry points should link there by default.
	const showSourcePicker = !isEdit && !addMode?.sourceUid;
	const [selectedSourceNote, setSelectedSourceNote] = useState<TFile | null>(
		() => {
			if (!showSourcePicker) return null;
			const active = app.workspace.getActiveFile();
			return active?.extension === "md" ? active : null;
		},
	);

	// ── Derived ──

	const noteType = useMemo(() => {
		if (isEdit) return editMode?.noteType;
		return plugin.cardStore?.noteTypes?.getById(noteTypeId) ?? null;
		// eslint-disable-next-line react-hooks/exhaustive-deps -- refreshCounter forces re-fetch after external edits via the note type manager / card types editor
	}, [isEdit, editMode, plugin.cardStore, noteTypeId, refreshCounter]);

	const isDirty = useMemo(() => {
		const commentChanged = userComment !== initialUserCommentRef.current;
		const initialFields = initialFieldsRef.current;
		if (isEdit && initialFields) {
			return (
				commentChanged ||
				Object.keys(initialFields).some((k) => fields[k] !== initialFields[k])
			);
		}
		return (
			commentChanged || Object.values(fields).some((v) => v.trim().length > 0)
		);
	}, [isEdit, fields, userComment]);

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
		app.vault,
	]);

	useEffect(() => {
		onDirtyChange?.(isDirty);
	}, [isDirty, onDirtyChange]);

	// Initialize empty fields when note type changes in add mode
	useEffect(() => {
		if (isEdit || !noteType) return;
		setFields((prev) => {
			const next: Record<string, string> = {};
			for (const fieldName of noteType.fields) {
				next[fieldName] = prev[fieldName] ?? "";
			}
			// Field names rarely match across types (Front/Back vs Text/Extra),
			// which used to drop the entered text on e.g. Basic -> Cloze. Carry
			// the first previous value into the new primary field instead.
			const primaryField = noteType.fields[0];
			if (primaryField && !next[primaryField]) {
				const carried = Object.values(prev).find((v) => v.trim().length > 0);
				if (carried) next[primaryField] = carried;
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

	const invalidatePendingCreateUndo = useCallback(() => {
		pendingCreateUndoRef.current = null;
	}, []);

	const handleFieldChange = useCallback((fieldName: string, value: string) => {
		if (fieldsRef.current[fieldName] === value) return;
		pendingCreateUndoRef.current = null;
		const nextFields = { ...fieldsRef.current, [fieldName]: value };
		fieldsRef.current = nextFields;
		setFields(nextFields);
	}, []);

	const handleNoteTypeChange = useCallback((id: string) => {
		pendingCreateUndoRef.current = null;
		setNoteTypeId(id);
	}, []);

	const handleUserCommentChange = useCallback((value: string) => {
		pendingCreateUndoRef.current = null;
		userCommentRef.current = value;
		setUserComment(value);
	}, []);

	const handleSourceSelect = useCallback((file: TFile | null) => {
		pendingCreateUndoRef.current = null;
		setSelectedSourceNote(file);
	}, []);

	const handleTypeInToggle = useCallback((enabled: boolean) => {
		pendingCreateUndoRef.current = null;
		setAlwaysTypeIn(enabled);
	}, []);

	const handleChangeType = useCallback(async () => {
		if (!noteType || !editMode?.noteId) return;

		const { ChangeNoteTypeModal } = await import(
			"@true-recall/obsidian/modals/library/ChangeNoteTypeModal"
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
		openNoteTypeManager(plugin, { onClose: handleNoteTypeRefresh });
	}, [plugin, handleNoteTypeRefresh]);

	const openCards = useCallback(() => {
		openCardTypesEditor(plugin, noteTypeId, {
			onClose: handleNoteTypeRefresh,
		});
	}, [plugin, noteTypeId, handleNoteTypeRefresh]);

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
		if (!noteType || savingRef.current) return;

		const currentFields = fieldsRef.current;
		const currentUserComment = userCommentRef.current;
		const primaryField = noteType.fields[0];
		if (!primaryField || !(currentFields[primaryField] ?? "").trim()) return;

		if (!plugin.flashcardManager?.hasStore()) {
			new Notice("Database not initialized");
			return;
		}

		const fieldsChanged = editMode
			? noteType.fields.some(
					(fieldName) =>
						currentFields[fieldName] !== editMode.note.fields[fieldName],
				)
			: true;
		const commentChanged = editMode
			? currentUserComment !== (editMode.note.userComment ?? "")
			: true;

		if (editMode && !fieldsChanged && !commentChanged) {
			onDone({ cancelled: true });
			return;
		}

		savingRef.current = true;
		setSaving(true);

		try {
			if (editMode) {
				const updatedCardIds = new Set<string>();
				if (fieldsChanged) {
					const result = plugin.flashcardManager.updateNoteFields(
						editMode.noteId,
						currentFields,
					);
					for (const cardId of result.updatedCardIds) {
						updatedCardIds.add(cardId);
					}
				}
				if (commentChanged) {
					for (const cardId of plugin.flashcardManager.updateNoteComment(
						editMode.noteId,
						currentUserComment,
					)) {
						updatedCardIds.add(cardId);
					}
				}

				onDone({
					cancelled: false,
					updatedCardIds: [...updatedCardIds],
				});
			} else {
				const sourceUid = await resolveSourceUid();
				const savedFields = { ...currentFields };

				const result = plugin.flashcardManager.createNote({
					noteTypeId,
					fields: currentFields,
					alwaysTypeIn,
					userComment: currentUserComment,
					sourceUid,
					createdVia: "manual",
				});

				const commandService = plugin.commandService;
				if (commandService && result.cards.length > 0) {
					const command = new BatchCreateCommand(
						result.cards.map((card) => card.id),
					);
					await commandService.execute(command);
					pendingCreateUndoRef.current = {
						command,
						fields: savedFields,
					};
				}

				const totalCards = result.cards.length;
				notify().cardsCreated(totalCards, sourceNoteFile?.basename);

				// Clear unpinned fields, keep pinned — modal stays open
				const next: Record<string, string> = {};
				for (const field of noteType.fields) {
					next[field] = pinnedFields.has(field)
						? (currentFields[field] ?? "")
						: "";
				}
				fieldsRef.current = next;
				setFields(next);
				userCommentRef.current = "";
				setUserComment("");
				if (pinnedFields.size === 0) {
					setFocusFirstRequest((request) => request + 1);
				}
				savingRef.current = false;
				setSaving(false);
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			new Notice(`Error: ${msg}`);
			savingRef.current = false;
			setSaving(false);
		}
	}, [
		noteType,
		editMode,
		noteTypeId,
		resolveSourceUid,
		alwaysTypeIn,
		plugin.flashcardManager,
		onDone,
		pinnedFields,
		sourceNoteFile,
	]);

	// Mobile add mode: save any typed draft, then close ("Done" button).
	const handleSaveAndClose = useCallback(async () => {
		const primaryField = noteType?.fields[0];
		const hasDraft = primaryField
			? (fieldsRef.current[primaryField] ?? "").trim().length > 0
			: false;
		if (hasDraft && !savingRef.current) {
			await handleSave();
		}
		onDone({ cancelled: false });
	}, [noteType, handleSave, onDone]);

	// Undo the most recent "Save & Add": only while it is still the top of the
	// command stack and nothing was typed since. Restores the saved fields.
	const handleUndoLastCreate = useCallback((): boolean => {
		if (isEdit || savingRef.current) return false;

		const pending = pendingCreateUndoRef.current;
		const commandService = plugin.commandService;
		if (!pending || !commandService?.isNextUndo(pending.command)) return false;

		pendingCreateUndoRef.current = null;

		void commandService.undo().then((undone) => {
			if (!undone) return;
			const restoredFields = { ...pending.fields };
			fieldsRef.current = restoredFields;
			setFields(restoredFields);
		});
		return true;
	}, [isEdit, plugin.commandService]);
	const handleUndoLastCreateRef = useRef(handleUndoLastCreate);
	handleUndoLastCreateRef.current = handleUndoLastCreate;

	// Cmd/Ctrl+Enter saves from anywhere in the modal (not just CM fields).
	// CodeMirror and textarea fields commit their live value before saving, so
	// the editor's debounced change callback cannot submit stale content.
	const handleSaveRef = useRef(handleSave);
	handleSaveRef.current = handleSave;

	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// Bind to the owning document so the shortcut works inside a popout
		// window (containerEl.win !== window). Falling back to `document`
		// covers the modal context where the listener attaches before the
		// element is in the DOM.
		const doc = rootRef.current?.ownerDocument ?? activeDocument;
		const onKeyDown = (e: KeyboardEvent) => {
			if (
				!e.shiftKey &&
				(e.metaKey || e.ctrlKey) &&
				e.key.toLowerCase() === "z" &&
				handleUndoLastCreateRef.current()
			) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				e.stopPropagation();
				userCommentInputRef.current?.focus();
				return;
			}
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				const target = e.target as HTMLElement | null;
				if (
					target?.closest?.(
						".true-recall-add-field, .true-recall-add-field-row textarea",
					)
				) {
					return;
				}
				e.preventDefault();
				e.stopPropagation();
				void handleSaveRef.current();
			}
		};
		doc.addEventListener("keydown", onKeyDown, true);
		return () => {
			doc.removeEventListener("keydown", onKeyDown, true);
		};
	}, []);

	// The editor registers itself as a temporary Assistant target. The task only
	// stores a serializable session id, while applying the accepted proposal
	// updates this still-open draft through the registry above.
	// We check both the plugin enable state AND hasAIKey directly. The full
	// `isPluginEnabled` helper (in plugin-utils) pulls @true-recall/plugins
	// registry, which transitively loads sqlite-wasm via other plugin manifests
	// and breaks Vitest module loading for unrelated tests. Inline-checking
	// hasAIKey reproduces the tier:"byok" gate without the registry import.
	const assistantEnabled =
		plugin.settings?.pluginStates?.["ai-assistant"] ?? true;
	const assistantActive =
		assistantEnabled && hasAIKey(plugin.settings, "assistant");
	const { disabled: aiDisabled, title: aiTitle } = deriveAIWandState({
		hasSourceNote: !!sourceNoteFile,
		assistantActive,
	});

	const openAI = useCallback(() => {
		if (aiDisabled) return;
		if (closeAssistantWindowRef.current) {
			const close = closeAssistantWindowRef.current;
			closeAssistantWindowRef.current = null;
			close();
			return;
		}
		if (!sourceNoteFile || !noteType) return;
		void Promise.all([resolveSourceUid(), app.vault.cachedRead(sourceNoteFile)])
			.then(([uid, sourceText]) => {
				if (!uid) {
					new Notice("AI: could not resolve source note UID.");
					return;
				}
				const context: AssistantContext = {
					activeNotePath: sourceNoteFile.path,
					source: { path: sourceNoteFile.path, uid, text: sourceText },
					draftCard: {
						sessionId: assistantDraftSessionIdRef.current,
						fields,
						noteType: {
							id: noteType.id,
							name: noteType.name,
							fields: noteType.fields,
						},
						sourceUid: uid,
						sourceNotePath: sourceNoteFile.path,
						operation: isEdit ? "edit" : "create",
					},
				};
				const sourceWindow =
					rootRef.current?.ownerDocument.defaultView ?? window;
				let closeWindow: (() => void) | null = null;
				closeWindow = openAssistantEditorWindow(plugin, context, {
					sourceWindow,
					onClose: () => {
						if (closeAssistantWindowRef.current === closeWindow) {
							closeAssistantWindowRef.current = null;
						}
					},
				});
				closeAssistantWindowRef.current = closeWindow;
			})
			.catch((err) => {
				console.error("[Assistant] AI window open failed", err);
				new Notice("AI: could not resolve source note.");
			});
	}, [
		aiDisabled,
		sourceNoteFile,
		noteType,
		fields,
		isEdit,
		resolveSourceUid,
		plugin,
		app.vault,
	]);

	if (!noteType) {
		return (
			<div class="ep:text-obs-muted ep:text-center ep:py-8">
				Loading note types...
			</div>
		);
	}

	return (
		<div
			ref={rootRef}
			class="true-recall-quick-editor ep:flex ep:flex-col ep:gap-3"
		>
			{/* Action bar: Note type, Source note, AI */}
			<ActionBar
				app={app}
				noteTypeId={noteTypeId}
				onNoteTypeChange={handleNoteTypeChange}
				isEdit={isEdit}
				onChangeType={isEdit ? () => void handleChangeType() : undefined}
				showSourcePicker={showSourcePicker}
				selectedSourceNote={selectedSourceNote}
				onSourceSelect={handleSourceSelect}
			/>

			{/* Shared formatting toolbar */}
			<FormattingToolbar
				app={app}
				getEditorView={() => focusedFieldRef.current?.editorView ?? null}
				typeInEnabled={alwaysTypeIn}
				onTypeInToggle={!isEdit ? handleTypeInToggle : undefined}
				showCloze={noteType.type === 1}
			/>

			{/* Dynamic fields */}
			<NoteFieldsForm
				noteType={noteType}
				fields={fields}
				sourcePath={sourceNoteFile?.path ?? ""}
				onFieldChange={handleFieldChange}
				onFieldFocus={handleFieldFocus}
				onModEnter={(fieldName, value) => {
					handleFieldChange(fieldName, value);
					void handleSaveRef.current();
				}}
				onModUndo={handleUndoLastCreate}
				onUserEdit={invalidatePendingCreateUndo}
				onEscape={onRequestClose}
				pinnedFields={pinnedFields}
				onTogglePin={togglePin}
				focusFirstRequest={focusFirstRequest}
			/>

			<UserCommentField
				value={userComment}
				onChange={handleUserCommentChange}
				inputRef={userCommentInputRef}
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
				onSaveAndClose={() => void handleSaveAndClose()}
				onOpenFields={openFields}
				onOpenCards={openCards}
				onAI={openAI}
				aiDisabled={aiDisabled}
				aiTitle={aiTitle}
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
	onSaveAndClose: () => void;
	onOpenFields: () => void;
	onOpenCards: () => void;
	onAI: () => void;
	aiDisabled: boolean;
	aiTitle: string;
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
	onSaveAndClose,
	onOpenFields,
	onOpenCards,
	onAI,
	aiDisabled,
	aiTitle,
}: FooterBarProps) {
	const aiIconRef = useIcon("wand");

	const openNote = useCallback(() => {
		if (sourceNoteFile) {
			void app.workspace.getLeaf("tab").openFile(sourceNoteFile);
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
				title={aiTitle}
				class={`${ghostBtnCls} ep:ml-auto ep:[&>svg]:w-4 ep:[&>svg]:h-4`}
				onClick={() => onAI()}
				disabled={aiDisabled}
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
				class="mod-cta ep-btn ep:text-ui-smaller ep:px-3 ep:py-1 ep:min-h-[28px] ep:max-h-[28px] ep:rounded-md"
				onClick={onSave}
				disabled={!canSave || saving || requiresSourceNote}
				title={requiresSourceNote ? "Select a source note to save" : undefined}
				stopPropagation={false}
			>
				{saving
					? "Saving..."
					: isEdit
						? "Save Changes"
						: isMobile()
							? "Save & add another"
							: "Save"}
			</Clickable>
			{!isEdit && isMobile() ? (
				<Clickable
					class={ghostBtnCls}
					onClick={onSaveAndClose}
					disabled={saving}
					stopPropagation={false}
				>
					Done
				</Clickable>
			) : null}
		</div>
	);
}
