import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/obsidian/utils/cn";

import { AiComposer } from "./AiComposer";

interface AiPromptComposerProps {
	value: string;
	onChange: (value: string) => void;
	onRun: () => void;
	onRunInInbox: () => void;
	onDismiss?: () => void;
	placeholder: string;
	autoFocus?: boolean;
	class?: string;
}

/**
 * The free-text half of the AI workspace. Every surface gets the same field —
 * same keyboard hints, same "Run in inbox" escape hatch — so asking in the
 * anchored preset menu is not a lesser experience than asking in the panel.
 */
export function AiPromptComposer({
	value,
	onChange,
	onRun,
	onRunInInbox,
	onDismiss,
	placeholder,
	autoFocus = false,
	class: cls,
}: AiPromptComposerProps) {
	const canSend = value.trim() !== "";

	return (
		<AiComposer
			variant="workspace"
			class={cls}
			value={value}
			onChange={onChange}
			onSubmit={onRun}
			onDismiss={onDismiss}
			autoFocus={autoFocus}
			placeholder={placeholder}
			submitLabel="Run"
			hint={
				<span>
					<kbd>Enter</kbd> run <span aria-hidden="true">·</span>{" "}
					<kbd>Shift Enter</kbd> new line
				</span>
			}
			trailing={
				<Clickable
					class={cn("tr-ai-composer__inbox-action", !canSend && "is-disabled")}
					disabled={!canSend}
					title="Run and open the AI inbox"
					onClick={onRunInInbox}
				>
					Run in inbox
				</Clickable>
			}
		/>
	);
}
