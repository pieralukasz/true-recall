import type { App } from "obsidian";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import type { NoteType } from "@true-recall/core/types/note.types";

import { Clickable } from "@true-recall/obsidian/components";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";

interface CreateNoteTypeResult {
	cancelled: boolean;
	name: string;
	cloneFromId: string | null;
}

function CreateNoteTypeBody({
	noteTypes,
	onResolve,
}: {
	noteTypes: NoteType[];
	onResolve: (result: CreateNoteTypeResult) => void;
}) {
	const [name, setName] = useState("");
	const [cloneFromId, setCloneFromId] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const id = window.setTimeout(() => inputRef.current?.focus(), 50);
		return () => window.clearTimeout(id);
	}, []);

	const trimmed = name.trim();
	const canCreate = trimmed.length > 0;

	const handleCreate = () => {
		if (!canCreate) return;
		onResolve({
			cancelled: false,
			name: trimmed,
			cloneFromId: cloneFromId || null,
		});
	};

	return (
		<>
			<div class="ep:block ep:text-ui-small ep:text-obs-muted ep:mb-1">
				Name
			</div>
			<input
				ref={inputRef}
				type="text"
				placeholder="My Custom Note Type"
				class="ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted ep:mb-4"
				value={name}
				onInput={(e) => setName((e.target as HTMLInputElement).value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") handleCreate();
				}}
			/>

			<div class="ep:block ep:text-ui-small ep:text-obs-muted ep:mb-1">
				Clone from
			</div>
			<select
				class="ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:mb-4"
				value={cloneFromId}
				onChange={(e) => setCloneFromId((e.target as HTMLSelectElement).value)}
			>
				<option value="">None (start empty)</option>
				{noteTypes.map((nt) => (
					<option key={nt.id} value={nt.id}>
						{nt.name}
						{nt.type === 1 ? " [cloze]" : ""}
					</option>
				))}
			</select>

			<div class="ep:flex ep:justify-end">
				<Clickable
					class="mod-cta ep-btn ep:px-4 ep:py-1.5 ep:rounded-md ep:text-ui-small"
					onClick={handleCreate}
					disabled={!canCreate}
				>
					Create
				</Clickable>
			</div>
		</>
	);
}

export class CreateNoteTypeModal extends BasePromiseModal<CreateNoteTypeResult> {
	constructor(
		app: App,
		private noteTypes: NoteType[],
	) {
		super(app, {
			title: "Create Note Type",
			width: "400px",
		});
	}

	protected getDefaultResult(): CreateNoteTypeResult {
		return { cancelled: true, name: "", cloneFromId: null };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<CreateNoteTypeBody
				noteTypes={this.noteTypes}
				onResolve={(result) => this.resolve(result)}
			/>,
			container,
		);
	}
}
