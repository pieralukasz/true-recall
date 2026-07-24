import { Clickable } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { cn } from "@true-recall/obsidian/utils/cn";

import {
	AI_WORKSPACE_MODES,
	type AIWorkspaceMode,
	type AIWorkspaceModeDefinition,
} from "./ai-workspace-modes";

function WorkspaceModeButton({
	definition,
	active,
	disabled,
	onSelect,
}: {
	definition: AIWorkspaceModeDefinition;
	active: boolean;
	disabled: boolean;
	onSelect: () => void;
}) {
	const iconRef = useIcon(definition.icon);

	return (
		<Clickable
			class={cn(
				"tr-ai-workspace-nav__item",
				active && "is-active",
				disabled && "is-disabled",
			)}
			disabled={disabled}
			aria-current={active ? "page" : undefined}
			title={
				disabled
					? definition.id === "generator"
						? "Open a note or select source text first"
						: "Open or select a flashcard first"
					: definition.description
			}
			onClick={onSelect}
		>
			<span ref={iconRef} class="tr-ai-workspace-nav__icon" />
			<span class="tr-ai-workspace-nav__copy">
				<strong>{definition.label}</strong>
				<small>
					{definition.id === "assistant"
						? "Ask and research"
						: definition.id === "generator"
							? "Create new cards"
							: "Improve a card"}
				</small>
			</span>
		</Clickable>
	);
}

export function AIWorkspaceNav({
	activeMode,
	isAvailable,
	onChange,
}: {
	activeMode: AIWorkspaceMode;
	isAvailable: (mode: AIWorkspaceMode) => boolean;
	onChange: (mode: AIWorkspaceMode) => void;
}) {
	return (
		<nav class="tr-ai-workspace-nav" aria-label="AI workspace mode">
			{AI_WORKSPACE_MODES.map((definition) => (
				<WorkspaceModeButton
					key={definition.id}
					definition={definition}
					active={activeMode === definition.id}
					disabled={!isAvailable(definition.id)}
					onSelect={() => onChange(definition.id)}
				/>
			))}
		</nav>
	);
}
