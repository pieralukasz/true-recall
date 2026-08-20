import type { App } from "obsidian";
import { render } from "preact";
import { useCallback, useEffect, useRef } from "preact/hooks";

import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { isMobile } from "@true-recall/obsidian/utils/platform";

interface CardCommentResult {
	value: string | null;
}

class CardCommentModal extends BasePromiseModal<CardCommentResult> {
	constructor(
		app: App,
		private defaultValue: string,
	) {
		super(app, {
			title: "My Note",
			width: "440px",
			modifierClass: "tr-card-comment-modal",
		});
	}

	protected getDefaultResult(): CardCommentResult {
		return { value: null };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<CardCommentBody
				defaultValue={this.defaultValue}
				onSave={(value) => this.resolve({ value })}
				onCancel={() => this.resolve({ value: null })}
			/>,
			container,
		);
	}
}

function CardCommentBody({
	defaultValue,
	onSave,
	onCancel,
}: {
	defaultValue: string;
	onSave: (value: string) => void;
	onCancel: () => void;
}) {
	const inputRef = useRef<HTMLTextAreaElement>(null);
	useEffect(() => {
		if (!isMobile()) inputRef.current?.focus();
	}, []);
	const handleSave = useCallback(
		() => onSave(inputRef.current?.value.trim() ?? ""),
		[onSave],
	);

	return (
		<form
			class="ep:flex ep:flex-col ep:gap-3 ep:overscroll-contain"
			onSubmit={(event) => {
				event.preventDefault();
				handleSave();
			}}
		>
			<p class="ep:m-0 ep:text-ui-small ep:leading-relaxed ep:text-obs-muted">
				Shown above the review controls. Claude can use it when verifying this
				card.
			</p>
			<label class="ep:block">
				<span class="ep:mb-1.5 ep:block ep:text-ui-smaller ep:font-medium ep:text-obs-normal">
					Note
				</span>
				<textarea
					ref={inputRef}
					name="card-comment"
					autoComplete="off"
					defaultValue={defaultValue}
					rows={4}
					placeholder="Add a thought, doubt, or verification request…"
					class="ep:block ep:min-h-28 ep:w-full ep:resize-y ep:rounded-lg ep:border ep:border-obs-border ep:bg-obs-primary ep:px-3 ep:py-2.5 ep:text-ui-small ep:leading-relaxed ep:text-obs-normal ep:shadow-inner ep:transition-colors ep:placeholder:text-obs-faint ep:focus:border-obs-yellow/60 ep:focus:outline-none ep:focus:ring-2 ep:focus:ring-obs-yellow/20"
					onKeyDown={(event) => {
						if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
							event.preventDefault();
							handleSave();
						}
					}}
				/>
			</label>
			<div class="ep:mt-1 ep:flex ep:items-center ep:justify-between ep:gap-3 ep:border-t ep:border-obs-border ep:pt-3">
				<span class="ep:shrink-0 ep:text-[10px] ep:text-obs-faint">
					<kbd>⌘ Enter</kbd> to save
				</span>
				<div class="ep:flex ep:items-center ep:gap-2">
					<button
						type="button"
						class="ep-btn ep-btn-outline ep:focus-visible:outline-none ep:focus-visible:ring-2 ep:focus-visible:ring-obs-interactive/45"
						onClick={onCancel}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="mod-cta ep-btn ep:focus-visible:outline-none ep:focus-visible:ring-2 ep:focus-visible:ring-obs-interactive/45"
					>
						Save Note
					</button>
				</div>
			</div>
		</form>
	);
}

export async function promptCardComment(
	app: App,
	defaultValue = "",
): Promise<string | null> {
	return (await new CardCommentModal(app, defaultValue).openAndWait()).value;
}
