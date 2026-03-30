import { Clickable } from "@true-recall/obsidian/components";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import type { App } from "obsidian";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

export interface NamePromptResult {
	cancelled: boolean;
	name: string;
}

function NamePromptBody({
	defaultName,
	onResolve,
}: {
	defaultName: string;
	onResolve: (result: NamePromptResult) => void;
}) {
	const [name, setName] = useState(defaultName);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const id = setTimeout(() => {
			inputRef.current?.focus();
			inputRef.current?.select();
		}, 50);
		return () => clearTimeout(id);
	}, []);

	const trimmed = name.trim();
	const canCreate = trimmed.length > 0;

	const handleCreate = () => {
		if (!canCreate) return;
		onResolve({ cancelled: false, name: trimmed });
	};

	return (
		<>
			<div class="ep:block ep:text-ui-small ep:text-obs-muted ep:mb-1">
				Project name
			</div>
			<input
				ref={inputRef}
				type="text"
				placeholder="Project name"
				class="ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted ep:mb-4"
				value={name}
				onInput={(e) => setName((e.target as HTMLInputElement).value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") handleCreate();
				}}
			/>

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

export class NamePromptModal extends BasePromiseModal<NamePromptResult> {
	constructor(
		app: App,
		private defaultName: string,
	) {
		super(app, {
			title: "Create project from notes",
			width: "400px",
		});
	}

	protected getDefaultResult(): NamePromptResult {
		return { cancelled: true, name: "" };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<NamePromptBody
				defaultName={this.defaultName}
				onResolve={(result) => this.resolve(result)}
			/>,
			container,
		);
	}
}
