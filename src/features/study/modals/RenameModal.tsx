import { Clickable } from "@shared/ui/components";
import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";
import { type App, type TAbstractFile, TFile, TFolder } from "obsidian";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

export interface RenameResult {
	cancelled: boolean;
	newName: string;
}

function RenameBody({
	currentName,
	isFolder,
	onResolve,
}: {
	currentName: string;
	isFolder: boolean;
	onResolve: (result: RenameResult) => void;
}) {
	const [name, setName] = useState(currentName);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const id = setTimeout(() => inputRef.current?.focus(), 50);
		return () => clearTimeout(id);
	}, []);

	// Select all text on focus
	useEffect(() => {
		const id = setTimeout(() => inputRef.current?.select(), 60);
		return () => clearTimeout(id);
	}, []);

	const trimmed = name.trim();
	const canRename = trimmed.length > 0 && trimmed !== currentName;

	const handleRename = () => {
		if (!canRename) return;
		onResolve({ cancelled: false, newName: trimmed });
	};

	return (
		<>
			<label class="ep:block ep:text-ui-small ep:text-obs-muted ep:mb-1">
				{isFolder ? "Folder name" : "Note name"}
			</label>
			<input
				ref={inputRef}
				type="text"
				placeholder={isFolder ? "Folder name" : "Note name"}
				class="ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted ep:mb-4"
				value={name}
				onInput={(e) => setName((e.target as HTMLInputElement).value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") handleRename();
				}}
			/>

			<div class="ep:flex ep:justify-end ep:gap-2">
				<Clickable
					class="ep-btn ep:px-4 ep:py-1.5 ep:rounded-md ep:text-ui-small"
					onClick={() => onResolve({ cancelled: true, newName: "" })}
				>
					Cancel
				</Clickable>
				<Clickable
					class="mod-cta ep-btn ep:px-4 ep:py-1.5 ep:rounded-md ep:text-ui-small"
					onClick={handleRename}
					disabled={!canRename}
				>
					Rename
				</Clickable>
			</div>
		</>
	);
}

export class RenameModal extends BasePromiseModal<RenameResult> {
	private currentName: string;
	private isFolder: boolean;

	constructor(app: App, file: TAbstractFile) {
		super(app, {
			title: `Rename ${file instanceof TFolder ? "folder" : "note"}`,
			width: "400px",
		});
		// For files, strip the .md extension for display
		this.currentName =
			file instanceof TFile
				? file.basename
				: file.name;
		this.isFolder = file instanceof TFolder;
	}

	protected getDefaultResult(): RenameResult {
		return { cancelled: true, newName: "" };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<RenameBody
				currentName={this.currentName}
				isFolder={this.isFolder}
				onResolve={(result) => this.resolve(result)}
			/>,
			container,
		);
	}
}
