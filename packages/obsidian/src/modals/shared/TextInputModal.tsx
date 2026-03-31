import { Clickable } from "@true-recall/obsidian/components";
import type { App } from "obsidian";
import { render } from "preact";
import { useCallback, useRef } from "preact/hooks";
import { BasePromiseModal } from "./BasePromiseModal";

export interface TextInputResult {
	value: string | null;
}

export interface TextInputModalOptions {
	title?: string;
	label: string;
	placeholder?: string;
	defaultValue?: string;
	confirmLabel?: string;
	cancelLabel?: string;
}

export class TextInputModal extends BasePromiseModal<TextInputResult> {
	private options: TextInputModalOptions;

	constructor(app: App, options: TextInputModalOptions) {
		super(app, {
			title: options.title ?? "Input",
			width: "400px",
		});
		this.options = options;
	}

	protected getDefaultResult(): TextInputResult {
		return { value: null };
	}

	protected renderBody(container: HTMLElement): void {
		const handleConfirm = (value: string) =>
			this.resolve({ value: value || null });
		const handleCancel = () => this.resolve({ value: null });

		render(
			<TextInputBody
				label={this.options.label}
				placeholder={this.options.placeholder}
				defaultValue={this.options.defaultValue}
				confirmLabel={this.options.confirmLabel}
				cancelLabel={this.options.cancelLabel}
				onConfirm={handleConfirm}
				onCancel={handleCancel}
			/>,
			container,
		);
	}
}

function TextInputBody({
	label,
	placeholder,
	defaultValue,
	confirmLabel,
	cancelLabel,
	onConfirm,
	onCancel,
}: {
	label: string;
	placeholder?: string;
	defaultValue?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	onConfirm: (value: string) => void;
	onCancel: () => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);

	const handleSubmit = useCallback(() => {
		onConfirm(inputRef.current?.value ?? "");
	}, [onConfirm]);

	return (
		<div>
			<label class="ep:block ep:text-obs-normal ep:text-sm ep:mb-2">
				{label}
				<input
					ref={inputRef}
					type="text"
					class="ep:w-full ep:p-2 ep:rounded ep:border ep:border-obs-border ep:bg-obs-background-modifier-form ep:text-obs-normal ep:mt-1 ep:mb-4"
					placeholder={placeholder}
					value={defaultValue}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleSubmit();
					}}
				/>
			</label>
			<div class="ep:flex ep:justify-end ep:gap-2">
				<Clickable
					class="ep-btn ep-btn-outline"
					onClick={onCancel}
					stopPropagation={false}
				>
					{cancelLabel ?? "Cancel"}
				</Clickable>
				<Clickable
					class="mod-cta ep-btn"
					onClick={handleSubmit}
					stopPropagation={false}
				>
					{confirmLabel ?? "OK"}
				</Clickable>
			</div>
		</div>
	);
}

export async function promptText(
	app: App,
	options: TextInputModalOptions,
): Promise<string | null> {
	const modal = new TextInputModal(app, options);
	const result = await modal.openAndWait();
	return result.value;
}
