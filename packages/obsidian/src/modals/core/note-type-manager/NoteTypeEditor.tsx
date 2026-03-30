import type { NoteTypeService } from "@true-recall/core/services/note-type.service";
import type { CardTemplate, NoteType } from "@true-recall/core/types/note.types";
import { Clickable } from "@true-recall/obsidian/components";
import { useCallback } from "preact/hooks";
import { FieldManager } from "./FieldManager";
import { TemplateEditor } from "./TemplateEditor";
import type { NoteTypeDraft } from "./types";

type NoteTypeEditorProps =
	| {
			mode: "create";
			draft: NoteTypeDraft;
			onDraftChange: (draft: NoteTypeDraft) => void;
			onSave: () => void;
			onCancel: () => void;
	  }
	| {
			mode: "view" | "edit";
			noteType: NoteType;
			noteTypeService: NoteTypeService;
			onRefresh: () => void;
			onDelete: (id: string) => void;
	  };

export function NoteTypeEditor(props: NoteTypeEditorProps) {
	if (props.mode === "create") {
		return <CreateEditor {...props} />;
	}
	return <ViewEditEditor {...props} />;
}

// ── Create mode ──────────────────────────────────────────────

function CreateEditor({
	draft,
	onDraftChange,
	onSave,
	onCancel,
}: Extract<NoteTypeEditorProps, { mode: "create" }>) {
	const updateDraft = useCallback(
		(partial: Partial<NoteTypeDraft>) =>
			onDraftChange({ ...draft, ...partial }),
		[draft, onDraftChange],
	);

	const updateTemplate = useCallback(
		(index: number, updated: CardTemplate) => {
			const templates = [...draft.templates];
			templates[index] = updated;
			updateDraft({ templates });
		},
		[draft.templates, updateDraft],
	);

	const addTemplate = useCallback(() => {
		const ordinal = draft.templates.length;
		updateDraft({
			templates: [
				...draft.templates,
				{
					name: `Card ${ordinal + 1}`,
					ordinal,
					qfmt: "",
					afmt: "",
				},
			],
		});
	}, [draft.templates, updateDraft]);

	const removeTemplate = useCallback(
		(index: number) => {
			if (draft.templates.length <= 1) return;
			const templates = draft.templates
				.filter((_, i) => i !== index)
				.map((t, i) => ({ ...t, ordinal: i }));
			updateDraft({ templates });
		},
		[draft.templates, updateDraft],
	);

	const canSave =
		draft.name.trim().length > 0 &&
		draft.fields.length > 0 &&
		draft.templates.length > 0;

	return (
		<div class="ep:space-y-4">
			<div>
				<div class="ep:text-ui-small ep:font-medium ep:text-obs-muted ep:mb-1">
					Name
				</div>
				<input
					type="text"
					class="ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded"
					placeholder="My Custom Note Type"
					value={draft.name}
					onInput={(e) =>
						updateDraft({ name: (e.target as HTMLInputElement).value })
					}
				/>
			</div>

			<FieldManager
				fields={draft.fields}
				readOnly={false}
				onFieldsChange={(fields) => updateDraft({ fields })}
			/>

			<div>
				<div class="ep:text-ui-small ep:font-medium ep:text-obs-muted ep:mb-2">
					Templates
				</div>
				<div class="ep:space-y-3">
					{draft.templates.map((t, i) => (
						<TemplateEditor
							key={t.ordinal}
							template={t}
							fields={draft.fields}
							readOnly={false}
							noteTypeType={draft.type}
							onTemplateChange={(updated) => updateTemplate(i, updated)}
							onDelete={() => removeTemplate(i)}
							isOnlyTemplate={draft.templates.length <= 1}
						/>
					))}
				</div>
				<Clickable
					class="ep:text-ui-small ep:text-obs-accent ep:hover:text-obs-accent/80 ep:mt-2"
					onClick={addTemplate}
				>
					+ Add template
				</Clickable>
			</div>

			<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border">
				<Clickable
					class="ep:px-4 ep:py-1.5 ep:text-ui-small ep:text-obs-muted ep:hover:text-obs-normal ep:rounded"
					onClick={onCancel}
				>
					Cancel
				</Clickable>
				<Clickable
					class="ep:px-4 ep:py-1.5 ep:text-ui-small ep:bg-obs-accent ep:text-obs-on-accent ep:rounded ep:hover:opacity-90"
					onClick={onSave}
					disabled={!canSave}
				>
					Create
				</Clickable>
			</div>
		</div>
	);
}

// ── View / Edit mode ─────────────────────────────────────────

function ViewEditEditor({
	mode,
	noteType,
	noteTypeService,
	onRefresh,
	onDelete,
}: Extract<NoteTypeEditorProps, { mode: "view" | "edit" }>) {
	const readOnly = mode === "view";

	const handleNameChange = useCallback(
		(e: Event) => {
			const name = (e.target as HTMLInputElement).value.trim();
			if (name && name !== noteType.name) {
				try {
					noteTypeService.update(noteType.id, { name });
					onRefresh();
				} catch {
					// revert handled by refresh
				}
			}
		},
		[noteType, noteTypeService, onRefresh],
	);

	const handleFieldsChange = useCallback(
		(fields: string[]) => {
			try {
				noteTypeService.update(noteType.id, { fields });
				onRefresh();
			} catch {
				// validation error
			}
		},
		[noteType.id, noteTypeService, onRefresh],
	);

	const handleFieldRename = useCallback(
		(oldName: string, newName: string) => {
			try {
				noteTypeService.renameField(noteType.id, oldName, newName);
				onRefresh();
			} catch {
				// validation error
			}
		},
		[noteType.id, noteTypeService, onRefresh],
	);

	const handleTemplateChange = useCallback(
		(index: number, updated: CardTemplate) => {
			const templates = [...noteType.templates];
			templates[index] = updated;
			try {
				noteTypeService.update(noteType.id, { templates });
				onRefresh();
			} catch {
				// validation error
			}
		},
		[noteType, noteTypeService, onRefresh],
	);

	const handleAddTemplate = useCallback(() => {
		const ordinal = noteType.templates.length;
		const templates = [
			...noteType.templates,
			{ name: `Card ${ordinal + 1}`, ordinal, qfmt: "", afmt: "" },
		];
		try {
			noteTypeService.update(noteType.id, { templates });
			onRefresh();
		} catch {
			// validation error
		}
	}, [noteType, noteTypeService, onRefresh]);

	const handleRemoveTemplate = useCallback(
		(index: number) => {
			if (noteType.templates.length <= 1) return;
			const templates = noteType.templates
				.filter((_, i) => i !== index)
				.map((t, i) => ({ ...t, ordinal: i }));
			try {
				noteTypeService.update(noteType.id, { templates });
				onRefresh();
			} catch {
				// validation error
			}
		},
		[noteType, noteTypeService, onRefresh],
	);

	return (
		<div class="ep:space-y-4">
			<div class="ep:flex ep:items-center ep:gap-2">
				<div class="ep:flex-1">
					<div class="ep:text-ui-small ep:font-medium ep:text-obs-muted ep:mb-1">
						Name
					</div>
					<input
						type="text"
						class="ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded"
						value={noteType.name}
						disabled={readOnly}
						onBlur={handleNameChange}
					/>
				</div>
				<span class="ep:text-ui-smaller ep:px-2 ep:py-0.5 ep:rounded ep:bg-obs-accent/10 ep:text-obs-accent ep:mt-5">
					{noteType.type === 1 ? "Cloze" : "Standard"}
				</span>
			</div>

			{readOnly && (
				<div class="ep:text-ui-smaller ep:text-obs-muted ep:italic">
					Built-in note types cannot be modified
				</div>
			)}

			<FieldManager
				fields={noteType.fields}
				readOnly={readOnly}
				onFieldsChange={handleFieldsChange}
				onFieldRename={handleFieldRename}
			/>

			<div>
				<div class="ep:text-ui-small ep:font-medium ep:text-obs-muted ep:mb-2">
					Templates
				</div>
				<div class="ep:space-y-3">
					{noteType.templates.map((t, i) => (
						<TemplateEditor
							key={`${noteType.id}-${t.ordinal}`}
							template={t}
							fields={noteType.fields}
							readOnly={readOnly}
							noteTypeType={noteType.type}
							onTemplateChange={(updated) => handleTemplateChange(i, updated)}
							onDelete={() => handleRemoveTemplate(i)}
							isOnlyTemplate={noteType.templates.length <= 1}
						/>
					))}
				</div>
				{!readOnly && (
					<Clickable
						class="ep:text-ui-small ep:text-obs-accent ep:hover:text-obs-accent/80 ep:mt-2"
						onClick={handleAddTemplate}
					>
						+ Add template
					</Clickable>
				)}
			</div>

			{!readOnly && (
				<div class="ep:pt-2 ep:border-t ep:border-obs-border">
					<Clickable
						class="ep:text-ui-small ep:text-obs-error ep:hover:text-obs-error/80"
						onClick={() => onDelete(noteType.id)}
					>
						Delete note type
					</Clickable>
				</div>
			)}
		</div>
	);
}
