import type { NoteType } from "@shared/types/note.types";
import { useEffect, useRef } from "preact/hooks";

interface NoteFieldsFormProps {
	noteType: NoteType;
	fields: Record<string, string>;
	onFieldChange: (fieldName: string, value: string) => void;
	autoFocusFirst?: boolean;
}

export function NoteFieldsForm({
	noteType,
	fields,
	onFieldChange,
	autoFocusFirst = true,
}: NoteFieldsFormProps) {
	const firstFieldRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (autoFocusFirst) {
			setTimeout(() => firstFieldRef.current?.focus(), 50);
		}
	}, [noteType.id, autoFocusFirst]);

	return (
		<div class="ep:space-y-3">
			{noteType.fields.map((fieldName, idx) => (
				<div key={fieldName}>
					<label class="ep:text-ui-smaller ep:text-obs-muted ep:mb-1 ep:block">
						{fieldName}:
					</label>
					<textarea
						ref={idx === 0 ? firstFieldRef : undefined}
						class="ep:w-full ep:px-3 ep:py-2 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:min-h-[60px] ep:resize-y"
						value={fields[fieldName] ?? ""}
						onInput={(e) =>
							onFieldChange(
								fieldName,
								(e.target as HTMLTextAreaElement).value,
							)
						}
					/>
				</div>
			))}

			{noteType.type === 1 && (
				<div class="ep:text-ui-smaller ep:text-obs-faint ep:bg-obs-secondary ep:px-3 ep:py-2 ep:rounded">
					Use{" "}
					<code class="ep:text-obs-accent">{"{{c1::text}}"}</code>{" "}
					syntax for cloze deletions. Multiple indices create
					multiple cards.
				</div>
			)}
		</div>
	);
}
