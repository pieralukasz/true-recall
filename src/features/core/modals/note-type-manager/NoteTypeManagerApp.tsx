import type { NoteType } from "@shared/types/note.types";
import { Notice } from "obsidian";
import { usePlugin } from "@shared/ui/preact/ObsidianContext";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { NoteTypeEditor } from "./NoteTypeEditor";
import { NoteTypeList } from "./NoteTypeList";
import { type NoteTypeDraft, createDefaultDraft } from "./types";

interface NoteTypeManagerAppProps {
	onClose: () => void;
}

export function NoteTypeManagerApp({ onClose }: NoteTypeManagerAppProps) {
	const plugin = usePlugin();
	const noteTypeService = plugin.noteTypeService;

	const [version, setVersion] = useState(0);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [draft, setDraft] = useState<NoteTypeDraft | null>(null);

	const noteTypes = useMemo(
		() => noteTypeService.getAll(),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[noteTypeService, version],
	);

	// Auto-select first type on mount
	useEffect(() => {
		if (noteTypes.length > 0 && selectedId === null && draft === null) {
			setSelectedId(noteTypes[0]!.id);
		}
	}, [noteTypes, selectedId, draft]);

	const selected = useMemo(
		() => (selectedId ? noteTypes.find((nt) => nt.id === selectedId) ?? null : null),
		[noteTypes, selectedId],
	);

	const refresh = useCallback(() => setVersion((v) => v + 1), []);

	const handleSelect = useCallback((id: string) => {
		setDraft(null);
		setSelectedId(id);
	}, []);

	const handleStartCreate = useCallback(() => {
		setDraft(createDefaultDraft());
		setSelectedId(null);
	}, []);

	const handleCreateSave = useCallback(() => {
		if (!draft) return;
		try {
			const created = noteTypeService.create({
				name: draft.name,
				fields: draft.fields,
				templates: draft.templates,
				css: draft.css,
			});
			setDraft(null);
			setSelectedId(created.id);
			refresh();
		} catch (e) {
			// eslint-disable-next-line no-new
			new Notice((e as Error).message);
		}
	}, [draft, noteTypeService, refresh]);

	const handleCreateCancel = useCallback(() => {
		setDraft(null);
		if (noteTypes.length > 0) {
			setSelectedId(noteTypes[0]!.id);
		}
	}, [noteTypes]);

	const handleDelete = useCallback(
		(id: string) => {
			try {
				noteTypeService.delete(id);
				setSelectedId(null);
				refresh();
			} catch (e) {
				// eslint-disable-next-line no-new
				new Notice((e as Error).message);
			}
		},
		[noteTypeService, refresh],
	);

	return (
		<div class="ep:flex ep:h-[65vh]">
			<NoteTypeList
				noteTypes={noteTypes}
				selectedId={draft ? null : selectedId}
				isCreating={draft !== null}
				onSelect={handleSelect}
				onCreate={handleStartCreate}
			/>
			<div class="ep:flex-1 ep:overflow-y-auto ep:pl-4">
				{draft ? (
					<NoteTypeEditor
						mode="create"
						draft={draft}
						onDraftChange={setDraft}
						onSave={handleCreateSave}
						onCancel={handleCreateCancel}
					/>
				) : selected ? (
					<NoteTypeEditor
						mode={selected.isBuiltin ? "view" : "edit"}
						noteType={selected}
						noteTypeService={noteTypeService}
						onRefresh={refresh}
						onDelete={handleDelete}
					/>
				) : (
					<div class="ep:flex ep:items-center ep:justify-center ep:h-full ep:text-obs-muted">
						Select a note type
					</div>
				)}
			</div>
		</div>
	);
}
