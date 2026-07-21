import { useState } from "preact/hooks";

import type { AssistantContext } from "@true-recall/core/ai/assistant";
import {
	type AIWorkflow,
	listAIWorkflows,
} from "@true-recall/core/ai/workflows/ai-workflow";

import { Clickable } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { cn } from "@true-recall/obsidian/utils/cn";

import { AIWorkspaceNav } from "./AIWorkspaceNav";
import { AiComposer } from "./AiComposer";
import {
	type AIWorkspaceMode,
	getAIWorkspaceMode,
	isAIWorkspaceModeAvailable,
	workflowMatchesMode,
} from "./ai-workspace-modes";

interface AskAiPromptProps {
	context: AssistantContext;
	onSubmitted: (
		threadId: string,
		mode: "inline" | "inbox" | "background",
	) => void;
	onDismiss: () => void;
	autoFocus?: boolean;
	class?: string;
	presentation?: "compact" | "workspace";
	initialMode?: AIWorkspaceMode;
}

const WORKFLOW_ICONS: Record<AIWorkflow["kind"], string> = {
	agent: "sparkles",
	"generate-cards": "layers",
	"modify-card": "wand",
};

function WorkflowAction({
	workflow,
	onSelect,
}: {
	workflow: AIWorkflow;
	onSelect: (workflow: AIWorkflow) => void;
}) {
	const iconRef = useIcon(WORKFLOW_ICONS[workflow.kind]);

	return (
		<Clickable
			class="tr-assistant-workflow"
			title={workflow.instruction}
			onClick={() => onSelect(workflow)}
		>
			<span ref={iconRef} class="tr-assistant-workflow__icon" />
			<span class="tr-assistant-workflow__label">{workflow.name}</span>
			<svg
				class="tr-assistant-workflow__arrow"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="m9 18 6-6-6-6" />
			</svg>
		</Clickable>
	);
}

export function AskAiPrompt({
	context,
	onSubmitted,
	onDismiss,
	autoFocus = true,
	class: cls,
	presentation = "compact",
	initialMode = "assistant",
}: AskAiPromptProps) {
	const plugin = usePlugin();
	const [text, setText] = useState("");
	const [showAllWorkflows, setShowAllWorkflows] = useState(false);
	const [activeMode, setActiveMode] = useState<AIWorkspaceMode>(() =>
		isAIWorkspaceModeAvailable(initialMode, context)
			? initialMode
			: "assistant",
	);
	const workflows = listAIWorkflows(plugin.settings, {
		hasSelection: !!context.selectedText?.trim(),
		hasSourceText: !!context.source?.text?.trim(),
		hasCard: !!context.card,
		hasDraftCard: !!context.draftCard,
	});
	const selectedText = context.selectedText?.trim();
	const canSend = text.trim() !== "";
	const modeDefinition = getAIWorkspaceMode(activeMode);
	const modeWorkflows = workflows.filter((workflow) =>
		workflowMatchesMode(workflow, activeMode),
	);
	const workflowLimit = presentation === "compact" ? 4 : 8;
	const visibleWorkflows = showAllWorkflows
		? modeWorkflows
		: modeWorkflows.slice(0, workflowLimit);
	const hiddenWorkflowCount = modeWorkflows.length - visibleWorkflows.length;

	const submit = (
		instruction: string,
		presetId: string | undefined,
		mode: "inline" | "inbox" | "background",
		displayMessage?: string,
	) => {
		const trimmed = instruction.trim();
		if (trimmed === "" || !plugin.assistantService) return;
		const { threadId } = plugin.assistantService.startThread({
			instruction: trimmed,
			presetId,
			context,
			state: mode === "inline" ? "active" : "inbox",
			displayMessage,
		});
		if (mode === "background") {
			notify().info(
				`Generating with ${displayMessage ?? "preset"} in the background…`,
			);
		}
		onSubmitted(threadId, mode);
	};

	const runWorkflow = (workflow: AIWorkflow) => {
		submit(
			workflow.instruction,
			workflow.id,
			workflow.kind === "generate-cards" ? "background" : "inline",
			workflow.name,
		);
	};

	if (presentation === "compact") {
		return (
			<div class={cn("tr-assistant-selection-prompt", cls)}>
				{selectedText ? (
					<section class="tr-assistant-selection-prompt__context">
						<div class="tr-assistant-prompt__section-label">Selected text</div>
						<div class="tr-assistant-selection-prompt__selection">
							{selectedText}
						</div>
					</section>
				) : null}

				<AIWorkspaceNav
					activeMode={activeMode}
					isAvailable={(mode) => isAIWorkspaceModeAvailable(mode, context)}
					onChange={(mode) => {
						setActiveMode(mode);
						setShowAllWorkflows(false);
					}}
				/>

				{activeMode === "assistant" ? (
					<AiComposer
						variant="workspace"
						class="tr-assistant-selection-prompt__composer"
						value={text}
						onChange={setText}
						onSubmit={() => submit(text, undefined, "inline")}
						onDismiss={onDismiss}
						autoFocus={autoFocus}
						placeholder="Ask about the selection…"
						submitLabel="Run"
						hint={
							<span>
								<kbd>Enter</kbd> run <span aria-hidden="true">·</span>{" "}
								<kbd>Shift Enter</kbd> new line
							</span>
						}
						trailing={
							<Clickable
								class={cn(
									"tr-ai-composer__inbox-action",
									!canSend && "is-disabled",
								)}
								disabled={!canSend}
								title="Run and open the AI inbox"
								onClick={() => submit(text, undefined, "inbox")}
							>
								Run in inbox
							</Clickable>
						}
					/>
				) : null}

				{modeWorkflows.length > 0 ? (
					<section class="tr-assistant-prompt__workflows">
						<div class="tr-assistant-prompt__section-heading">
							<div>
								<h3>
									{activeMode === "assistant" ? "Quick actions" : "Presets"}
								</h3>
								<p>{modeDefinition.description}</p>
							</div>
						</div>
						<div class="tr-assistant-workflow-grid">
							{visibleWorkflows.map((workflow) => (
								<WorkflowAction
									key={workflow.id}
									workflow={workflow}
									onSelect={runWorkflow}
								/>
							))}
						</div>
						{hiddenWorkflowCount > 0 ? (
							<Clickable
								class="tr-assistant-prompt__show-all"
								onClick={() => setShowAllWorkflows(true)}
							>
								Show {hiddenWorkflowCount} more
							</Clickable>
						) : modeWorkflows.length > workflowLimit ? (
							<Clickable
								class="tr-assistant-prompt__show-all"
								onClick={() => setShowAllWorkflows(false)}
							>
								Show fewer
							</Clickable>
						) : null}
					</section>
				) : activeMode !== "assistant" ? (
					<div class="tr-assistant-prompt__empty-mode">
						<strong>No {modeDefinition.label} presets yet</strong>
						<span>Add a preset in True Recall settings.</span>
					</div>
				) : null}
			</div>
		);
	}

	return (
		<div class={cn("tr-assistant-prompt", cls)}>
			<AIWorkspaceNav
				activeMode={activeMode}
				isAvailable={(mode) => isAIWorkspaceModeAvailable(mode, context)}
				onChange={(mode) => {
					setActiveMode(mode);
					setShowAllWorkflows(false);
				}}
			/>

			<header class="tr-assistant-prompt__intro">
				<div class="tr-assistant-prompt__eyebrow">AI workspace</div>
				<h2>{modeDefinition.title}</h2>
				<p>{modeDefinition.description}</p>
			</header>

			{selectedText ? (
				<section class="tr-assistant-prompt__context">
					<div class="tr-assistant-prompt__section-label">Selected text</div>
					<div class="ep:text-ui-small ep:whitespace-pre-wrap ep:break-words ep:text-obs-normal">
						{selectedText}
					</div>
				</section>
			) : null}

			{activeMode === "assistant" ? (
				<AiComposer
					variant="workspace"
					value={text}
					onChange={setText}
					onSubmit={() => submit(text, undefined, "inline")}
					onDismiss={onDismiss}
					autoFocus={autoFocus}
					placeholder="Ask, research, or describe a change…"
					submitLabel="Run"
					hint={
						<span>
							<kbd>Enter</kbd> run <span aria-hidden="true">·</span>{" "}
							<kbd>Shift Enter</kbd> new line
						</span>
					}
					trailing={
						<Clickable
							class={cn(
								"tr-ai-composer__inbox-action",
								!canSend && "is-disabled",
							)}
							disabled={!canSend}
							title="Run and open the AI inbox"
							onClick={() => submit(text, undefined, "inbox")}
						>
							Run in inbox
						</Clickable>
					}
				/>
			) : null}

			{modeWorkflows.length > 0 ? (
				<section class="tr-assistant-prompt__workflows">
					<div class="tr-assistant-prompt__section-heading">
						<div>
							<h3>
								{activeMode === "assistant" ? "Quick actions" : "Presets"}
							</h3>
							<p>
								{activeMode === "assistant"
									? "Run a saved instruction immediately"
									: `Choose a ${modeDefinition.label} workflow`}
							</p>
						</div>
					</div>
					<div class="tr-assistant-workflow-grid">
						{visibleWorkflows.map((workflow) => (
							<WorkflowAction
								key={workflow.id}
								workflow={workflow}
								onSelect={runWorkflow}
							/>
						))}
					</div>
					{hiddenWorkflowCount > 0 ? (
						<Clickable
							class="tr-assistant-prompt__show-all"
							onClick={() => setShowAllWorkflows(true)}
						>
							Show {hiddenWorkflowCount} more actions
						</Clickable>
					) : modeWorkflows.length > workflowLimit ? (
						<Clickable
							class="tr-assistant-prompt__show-all"
							onClick={() => setShowAllWorkflows(false)}
						>
							Show fewer actions
						</Clickable>
					) : null}
				</section>
			) : activeMode !== "assistant" ? (
				<div class="tr-assistant-prompt__empty-mode">
					<strong>No {modeDefinition.label} presets yet</strong>
					<span>
						Add a preset in True Recall settings to use this workflow.
					</span>
				</div>
			) : null}
		</div>
	);
}
