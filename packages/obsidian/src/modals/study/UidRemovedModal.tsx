import type { App, TFile } from "obsidian";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";

import { Clickable } from "@true-recall/obsidian/components";
import { NotePicker } from "@true-recall/obsidian/components/NotePicker";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { confirm } from "@true-recall/obsidian/modals/shared/ConfirmModal";

type UidRemovedAction = "restore" | "delete" | "move";

interface UidRemovedResult {
	cancelled: boolean;
	action: UidRemovedAction;
	targetNotePath?: string;
}

interface UidRemovedModalOptions {
	fileName: string;
	removedUid: string;
	cardCount: number;
}

export class UidRemovedModal extends BasePromiseModal<UidRemovedResult> {
	private options: UidRemovedModalOptions;
	private allNotes: TFile[] = [];

	constructor(app: App, options: UidRemovedModalOptions) {
		super(app, {
			title: `UID removed \u2014 ${options.cardCount} flashcard${options.cardCount === 1 ? "" : "s"} affected`,
			width: "500px",
		});
		this.options = options;
	}

	protected getDefaultResult(): UidRemovedResult {
		return { cancelled: true, action: "restore" };
	}

	onOpen(): void {
		super.onOpen();
		this.allNotes = this.app.vault.getMarkdownFiles();
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<UidRemovedBody
				app={this.app}
				fileName={this.options.fileName}
				removedUid={this.options.removedUid}
				cardCount={this.options.cardCount}
				allNotes={this.allNotes}
				onResolve={(result) => this.resolve(result)}
			/>,
			container,
		);
	}
}

// --- Preact body component ---

const ICON_MAP: Record<string, string> = {
	undo: "\u21A9\uFE0F",
	"trash-2": "\uD83D\uDDD1\uFE0F",
	folder: "\uD83D\uDCC1",
};

interface ActionButtonProps {
	icon: string;
	label: string;
	description: string;
	type: "primary" | "secondary" | "danger";
	onClick: () => void;
}

function ActionButton({
	icon,
	label,
	description,
	type,
	onClick,
}: ActionButtonProps) {
	const btnCls =
		type === "primary"
			? "ep:bg-obs-interactive-accent ep:text-obs-on-accent ep:hover:opacity-90"
			: type === "danger"
				? "ep:bg-obs-red ep:text-obs-on-accent ep:hover:opacity-90"
				: "ep:bg-obs-secondary ep:text-obs-normal ep:hover:bg-obs-modifier-hover";

	return (
		<Clickable
			class={`ep:w-full ep:py-3 ep:px-4 ep:rounded-md ep:border ep:border-obs-border ep:transition-colors ep:text-left ${btnCls}`}
			onClick={onClick}
		>
			<div class="ep:flex ep:items-center ep:gap-3">
				<span class="ep:text-lg">{ICON_MAP[icon] ?? "\u2022"}</span>
				<div>
					<div class="ep:font-medium ep:text-ui-small">{label}</div>
					<div class="ep:text-ui-smaller ep:opacity-70">{description}</div>
				</div>
			</div>
		</Clickable>
	);
}

interface UidRemovedBodyProps {
	app: App;
	fileName: string;
	removedUid: string;
	cardCount: number;
	allNotes: TFile[];
	onResolve: (result: UidRemovedResult) => void;
}

function UidRemovedBody({
	app,
	fileName,
	removedUid,
	cardCount,
	allNotes,
	onResolve,
}: UidRemovedBodyProps) {
	const [showMoveSection, setShowMoveSection] = useState(false);

	const handleDelete = useCallback(async () => {
		const confirmed = await confirm(app, {
			message: `Are you sure you want to delete ${cardCount} flashcard${cardCount === 1 ? "" : "s"}? This cannot be undone.`,
		});
		if (confirmed) {
			onResolve({ cancelled: false, action: "delete" });
		}
	}, [app, cardCount, onResolve]);

	return (
		<>
			<p class="ep:text-obs-normal ep:text-ui-small ep:mb-4">
				The <code>flashcard_uid</code> was removed from "{fileName}".{" "}
				{cardCount} flashcard{cardCount === 1 ? "" : "s"} linked via UID{" "}
				<code>{removedUid}</code> {cardCount === 1 ? "is" : "are"} now
				disconnected.
			</p>

			<div class="ep:flex ep:flex-col ep:gap-2">
				<ActionButton
					icon="undo"
					label="Restore UID"
					description={`Put flashcard_uid: ${removedUid} back into frontmatter`}
					type="primary"
					onClick={() => onResolve({ cancelled: false, action: "restore" })}
				/>
				<ActionButton
					icon="folder"
					label="Move to another note"
					description="Transfer cards to an existing note"
					type="secondary"
					onClick={() => setShowMoveSection(true)}
				/>
				<ActionButton
					icon="trash-2"
					label="Delete cards"
					description="Permanently remove these flashcards"
					type="danger"
					onClick={() => void handleDelete()}
				/>
			</div>

			{showMoveSection && (
				<div class="ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border">
					<NotePicker
						notes={allNotes}
						onSelect={(note) =>
							onResolve({
								cancelled: false,
								action: "move",
								targetNotePath: note.path,
							})
						}
						onCancel={() => setShowMoveSection(false)}
						maxResults={30}
						title="Select target note"
					/>
				</div>
			)}
		</>
	);
}
