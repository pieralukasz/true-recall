import { Clickable } from "@shared/ui/components";
import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";
import { type App, normalizePath, TFolder } from "obsidian";
import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

export interface CreateProjectResult {
	cancelled: boolean;
	name: string;
	folder: string;
}

function CreateProjectBody({
	folders,
	onResolve,
}: {
	folders: string[];
	onResolve: (result: CreateProjectResult) => void;
}) {
	const [name, setName] = useState("");
	const [folder, setFolder] = useState("");
	const [folderSearch, setFolderSearch] = useState("");
	const nameRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const id = setTimeout(() => nameRef.current?.focus(), 50);
		return () => clearTimeout(id);
	}, []);

	const filtered = useMemo(() => {
		if (!folderSearch) return folders;
		const q = folderSearch.toLowerCase();
		return folders.filter((f) => f.toLowerCase().includes(q));
	}, [folders, folderSearch]);

	const trimmed = name.trim();
	const canCreate = trimmed.length > 0;

	const handleCreate = () => {
		if (!canCreate) return;
		onResolve({ cancelled: false, name: trimmed, folder });
	};

	return (
		<>
			<label class="ep:block ep:text-ui-small ep:text-obs-muted ep:mb-1">
				Project name
			</label>
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

			<label class="ep:block ep:text-ui-small ep:text-obs-muted ep:mb-1">
				Folder
			</label>
			<input
				type="text"
				placeholder="Filter folders..."
				class="ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted ep:mb-2"
				value={folderSearch}
				onInput={(e) =>
					setFolderSearch((e.target as HTMLInputElement).value)
				}
			/>

			<div
				class="ep:border ep:border-obs-border ep:rounded-md ep:overflow-y-auto ep:mb-4"
				style="max-height: 200px"
			>
				<Clickable
					class={`ep:w-full ep:flex ep:items-center ep:p-2.5 ep:text-ui-small ep:border-b ep:border-obs-border ep:transition-colors ${
						folder === ""
							? "ep:bg-obs-modifier-hover ep:text-obs-normal ep:font-medium"
							: "ep:text-obs-muted ep:hover:bg-obs-modifier-hover"
					}`}
					onClick={() => setFolder("")}
					stopPropagation={false}
				>
					/ (vault root)
				</Clickable>
				{filtered.map((f) => (
					<Clickable
						key={f}
						class={`ep:w-full ep:flex ep:items-center ep:p-2.5 ep:text-ui-small ep:border-b ep:border-obs-border ep:last:border-b-0 ep:transition-colors ${
							folder === f
								? "ep:bg-obs-modifier-hover ep:text-obs-normal ep:font-medium"
								: "ep:text-obs-muted ep:hover:bg-obs-modifier-hover"
						}`}
						onClick={() => setFolder(f)}
						stopPropagation={false}
					>
						{f}
					</Clickable>
				))}
			</div>

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

export class CreateProjectModal extends BasePromiseModal<CreateProjectResult> {
	private folders: string[] = [];

	constructor(app: App) {
		super(app, {
			title: "Create new project",
			width: "450px",
		});
	}

	protected getDefaultResult(): CreateProjectResult {
		return { cancelled: true, name: "", folder: "" };
	}

	onOpen(): void {
		super.onOpen();
		this.folders = this.app.vault
			.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder && f.path !== "/")
			.map((f) => f.path)
			.sort((a, b) => a.localeCompare(b));
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<CreateProjectBody
				folders={this.folders}
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
