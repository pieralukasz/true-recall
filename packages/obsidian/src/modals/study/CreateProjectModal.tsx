import { type App, normalizePath } from "obsidian";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { FolderSuggestInput } from "@true-recall/obsidian/components/FolderSuggestInput";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";

interface CreateProjectResult {
	cancelled: boolean;
	name: string;
	folder: string;
}

function CreateProjectBody({
	app,
	onResolve,
}: {
	app: App;
	onResolve: (result: CreateProjectResult) => void;
}) {
	const [name, setName] = useState("");
	const [folder, setFolder] = useState("");
	const nameRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const id = setTimeout(() => nameRef.current?.focus(), 50);
		return () => clearTimeout(id);
	}, []);

	const trimmed = name.trim();
	const canCreate = trimmed.length > 0;

	const handleCreate = () => {
		if (!canCreate) return;
		onResolve({ cancelled: false, name: trimmed, folder });
	};

	return (
		<>
			<div class="ep:block ep:text-ui-small ep:text-obs-muted ep:mb-1">
				Project name
			</div>
			<input
				ref={nameRef}
				type="text"
				placeholder="My Project"
				class="ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted ep:mb-4"
				value={name}
				onInput={(e) => setName((e.target as HTMLInputElement).value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") handleCreate();
				}}
			/>

			<div class="ep:block ep:text-ui-small ep:text-obs-muted ep:mb-1">
				Folder
			</div>
			<FolderSuggestInput
				app={app}
				value={folder}
				onChange={setFolder}
				placeholder="Vault root (leave empty)"
				class="ep:mb-4"
			/>

			<div class="ep:flex ep:justify-end">
				<button
					type="button"
					class="mod-cta ep-btn ep:px-4 ep:py-1.5 ep:rounded-md ep:text-ui-small"
					onClick={handleCreate}
					disabled={!canCreate}
				>
					Create
				</button>
			</div>
		</>
	);
}

export class CreateProjectModal extends BasePromiseModal<CreateProjectResult> {
	constructor(app: App) {
		super(app, {
			title: "Create new project",
			width: "450px",
		});
	}

	protected getDefaultResult(): CreateProjectResult {
		return { cancelled: true, name: "", folder: "" };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<CreateProjectBody
				app={this.app}
				onResolve={(result) => this.resolve(result)}
			/>,
			container,
		);
	}

	static buildNotePath(name: string, folder: string): string {
		const raw = folder ? `${folder}/${name}.md` : `${name}.md`;
		return normalizePath(raw);
	}
}
