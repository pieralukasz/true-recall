import { usePlugin } from "@shared/ui/preact/ObsidianContext";
import type { NoteType } from "@shared/types/note.types";
import { useEffect, useMemo, useState } from "preact/hooks";

interface NoteTypePickerProps {
	value: string;
	onChange: (noteTypeId: string) => void;
	disabled?: boolean;
}

export function NoteTypePicker({ value, onChange, disabled }: NoteTypePickerProps) {
	const plugin = usePlugin();
	const [noteTypes, setNoteTypes] = useState<NoteType[]>([]);

	useEffect(() => {
		if (!plugin.cardStore?.noteTypes) return;
		const all = plugin.cardStore.noteTypes.getAll();
		setNoteTypes(all);
	}, [plugin.cardStore]);

	const sorted = useMemo(() => {
		const builtins = noteTypes.filter((nt) => nt.isBuiltin);
		const custom = noteTypes
			.filter((nt) => !nt.isBuiltin)
			.sort((a, b) => a.name.localeCompare(b.name));
		return [...builtins, ...custom];
	}, [noteTypes]);

	return (
		<select
			class="ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded ep:min-w-[160px] ep:disabled:opacity-60 ep:disabled:cursor-not-allowed"
			value={value}
			disabled={disabled}
			onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
		>
			{sorted.map((nt) => (
				<option key={nt.id} value={nt.id}>
					{nt.name}
					{nt.type === 1 ? " (cloze)" : ""}
					{!nt.isBuiltin ? " *" : ""}
				</option>
			))}
		</select>
	);
}
