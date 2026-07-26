import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/obsidian/utils/cn";

import { resolveComposerKeyAction } from "./composer-keys";

/** Cap the auto-growing textarea so a long draft scrolls instead of shoving
 * the toolbar off-screen. */
const MAX_INPUT_HEIGHT = 200;

interface AiComposerProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onDismiss?: () => void;
	placeholder?: string;
	inputId?: string;
	/** A task is running: the field is disabled and send becomes Stop. */
	busy?: boolean;
	onStop?: () => void;
	autoFocus?: boolean;
	variant?: "compact" | "workspace";
	/** Context block rendered above the field (e.g. selected text). */
	header?: ComponentChildren;
	/** Compact preset actions rendered in the footer. */
	chips?: ComponentChildren;
	/** Optional keyboard or interaction hint displayed in the footer. */
	hint?: ComponentChildren;
	/** Extra actions rendered before the send button. */
	trailing?: ComponentChildren;
	/** Extra actions rendered after the send button. */
	afterSubmit?: ComponentChildren;
	submitLabel?: string;
	class?: string;
}

export function AiComposer({
	value,
	onChange,
	onSubmit,
	onDismiss,
	placeholder,
	inputId,
	busy = false,
	onStop,
	autoFocus = false,
	variant = "compact",
	header,
	chips,
	hint,
	trailing,
	afterSubmit,
	submitLabel,
	class: cls,
}: AiComposerProps) {
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const canSend = value.trim() !== "" && !busy;

	const adjustHeight = () => {
		const el = inputRef.current;
		if (!el) return;
		el.setCssStyles({ height: "auto" });
		el.setCssStyles({
			height: `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`,
		});
	};

	useEffect(() => {
		adjustHeight();
		if (autoFocus) inputRef.current?.focus();
	}, [autoFocus]);

	// Re-measure when the value changes externally (e.g. cleared after send).
	useEffect(() => {
		adjustHeight();
	}, [value]);

	return (
		<div
			class={cn(
				"tr-ai-composer",
				variant === "workspace" && "tr-ai-composer--workspace",
				"ep:flex ep:flex-col ep:gap-2 ep:w-full ep:p-2.5 ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-xl ep:transition-colors ep:focus-within:border-obs-interactive",
				cls,
			)}
		>
			{header}
			<textarea
				ref={inputRef}
				id={inputId}
				name={inputId}
				autoComplete="off"
				class="tr-ai-composer__input ep:w-full ep:min-h-10 ep:p-1 ep:bg-transparent ep:border-none ep:outline-none ep:resize-none ep:text-obs-normal ep:text-ui-small ep:leading-snug ep:placeholder:text-obs-muted ep:disabled:opacity-50"
				placeholder={placeholder}
				rows={1}
				value={value}
				disabled={busy}
				onInput={(e) => {
					onChange((e.target as HTMLTextAreaElement).value);
					adjustHeight();
				}}
				onKeyDown={(e) => {
					const action = resolveComposerKeyAction(e);
					if (action === "submit") {
						e.preventDefault();
						if (canSend) onSubmit();
					}
					if (action === "dismiss") onDismiss?.();
				}}
			/>
			<div class="tr-ai-composer__footer ep:flex ep:items-center ep:gap-2">
				{chips ? (
					<div class="ep:flex ep:flex-1 ep:flex-wrap ep:gap-1.5 ep:min-w-0">
						{chips}
					</div>
				) : hint ? (
					<div class="tr-ai-composer__hint ep:flex-1 ep:min-w-0">{hint}</div>
				) : null}
				<div class="ep:flex ep:items-center ep:gap-2 ep:ml-auto ep:shrink-0">
					{trailing}
					{busy && onStop ? (
						<Clickable
							class={cn(
								"ep:flex ep:items-center ep:justify-center ep:w-8 ep:h-8 ep:rounded-full ep:bg-obs-modifier-hover ep:text-obs-normal",
								variant === "workspace" &&
									"tr-ai-composer__stop ep:w-auto ep:px-3 ep:gap-1.5 ep:rounded-md",
							)}
							aria-label="Stop generating"
							title="Stop generating"
							onClick={() => onStop()}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="currentColor"
								role="img"
								aria-hidden="true"
							>
								<rect x="6" y="6" width="12" height="12" rx="2" />
							</svg>
							{variant === "workspace" ? <span>Stop</span> : null}
						</Clickable>
					) : (
						<Clickable
							class={cn(
								"ep:flex ep:items-center ep:justify-center ep:w-8 ep:h-8 ep:rounded-full ep:bg-obs-interactive ep:text-obs-on-accent ep:transition-colors",
								variant === "workspace" &&
									"tr-ai-composer__submit ep:w-auto ep:px-3.5 ep:gap-1.5 ep:rounded-md ep:font-medium",
								!canSend && "ep:bg-obs-border ep:text-obs-muted ep:opacity-45",
							)}
							disabled={!canSend}
							aria-label="Send"
							title="Send (Enter)"
							onClick={() => onSubmit()}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.4"
								stroke-linecap="round"
								stroke-linejoin="round"
								role="img"
								aria-hidden="true"
							>
								<path d="M12 19V5" />
								<path d="m5 12 7-7 7 7" />
							</svg>
							{submitLabel ? <span>{submitLabel}</span> : null}
						</Clickable>
					)}
					{afterSubmit}
				</div>
			</div>
		</div>
	);
}
