import { NotePicker } from "@shared/ui/components/NotePicker";
import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";
import type { App, TFile } from "obsidian";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";

export type UidRemovedAction = "restore" | "delete" | "move";

export interface UidRemovedResult {
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
	private unmountBody?: () => void;

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
				fileName={this.options.fileName}
				removedUid={this.options.removedUid}
				cardCount={this.options.cardCount}
				allNotes={this.allNotes}
				onResolve={(result) => this.resolve(result)}
			/>,
			container,
		);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		super.onClose();
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
		<button
			type="button"
			class={`ep:w-full ep:py-3 ep:px-4 ep:rounded-md ep:border ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:text-left ${btnCls}`}
			onClick={onClick}
		>
			<div class="ep:flex ep:items-center ep:gap-3">
				<span class="ep:text-lg">{ICON_MAP[icon] ?? "\u2022"}</span>
				<div>
					<div class="ep:font-medium ep:text-ui-small">{label}</div>
					<div class="ep:text-ui-smaller ep:opacity-70">{description}</div>
				</div>
			</div>
		</button>
	);
}

interface UidRemovedBodyProps {
	fileName: string;
	removedUid: string;
	cardCount: number;
	allNotes: TFile[];
	onResolve: (result: UidRemovedResult) => void;
}

function UidRemovedBody({
	fileName,
	removedUid,
	cardCount,
	allNotes,
	onResolve,
}: UidRemovedBodyProps) {
	const [showMoveSection, setShowMoveSection] = useState(false);

	const handleDelete = useCallback(() => {
		const confirmed = window.confirm(
			`Are you sure you want to delete ${cardCount} flashcard${cardCount === 1 ? "" : "s"}? This cannot be undone.`,
		);
		if (confirmed) {
			onResolve({ cancelled: false, action: "delete" });
		}
	}, [cardCount, onResolve]);

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
					onClick={handleDelete}
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
