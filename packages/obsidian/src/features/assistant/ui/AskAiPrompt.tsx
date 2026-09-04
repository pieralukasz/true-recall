import { useState } from "preact/hooks";

import type { AssistantContext } from "@true-recall/core/ai/assistant";
import {
	type AIWorkflow,
	customCardPolishWorkflowId,
	listAIWorkflows,
} from "@true-recall/core/ai/workflows/ai-workflow";

import { Clickable } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { cn } from "@true-recall/obsidian/utils/cn";

import { AIWorkspaceNav } from "./AIWorkspaceNav";
import { AiPresetList } from "./AiPresetList";
import { AiPromptComposer } from "./AiPromptComposer";
import {
	type AIWorkspaceMode,
	getAIWorkspaceMode,
	isAIWorkspaceModeAvailable,
	workflowMatchesMode,
} from "./ai-workspace-modes";
import { isWorkflowFamilyEnabled } from "./workflow-family-gate";

/** Which half of the surface the user lands on. `presets` is the fast path — a
 * one-click list of saved instructions; `compose` is the roomy workspace with
 * mode nav and a focused composer. */
export type AskAiEntry = "presets" | "compose";

interface AskAiPromptProps {
	context: AssistantContext;
	onSubmitted: (
		threadId: string,
		mode: "inline" | "inbox" | "background",
	) => void;
	onDismiss: () => void;
	autoFocus?: boolean;
	class?: string;
	entry?: AskAiEntry;
	initialMode?: AIWorkspaceMode;
	/** Fires when the composer gains or loses draft text. Long-lived surfaces use
	 * it to hold the subject still while the user is mid-sentence. */
	onDraftChange?: (hasDraft: boolean) => void;
}

const WORKFLOW_ICONS: Record<AIWorkflow["kind"], string> = {
	agent: "sparkles",
	"generate-cards": "layers",
	"modify-card": "wand",
	"fact-check": "search-check",
};

const COMPOSE_WORKFLOW_LIMIT = 8;

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
	entry = "compose",
	initialMode = "assistant",
	onDraftChange,
}: AskAiPromptProps) {
	const plugin = usePlugin();
	const [text, setText] = useState("");
	const [showAllWorkflows, setShowAllWorkflows] = useState(false);
	const [activeMode, setActiveMode] = useState<AIWorkspaceMode>(() =>
		isAIWorkspaceModeAvailable(initialMode, context)
			? initialMode
			: "assistant",
	);

	const handleTextChange = (value: string) => {
		setText(value);
		onDraftChange?.(value.trim() !== "");
	};

	const workflows = listAIWorkflows(plugin.settings, {
		hasSelection: !!context.selectedText?.trim(),
		hasSourceText: !!context.source?.text?.trim(),
		hasCard: !!context.card,
		hasDraftCard: !!context.draftCard,
		isFamilyEnabled: (kind) => isWorkflowFamilyEnabled(plugin.settings, kind),
	});
	const isModeAvailable = (mode: AIWorkspaceMode): boolean =>
		isAIWorkspaceModeAvailable(mode, context) &&
		isWorkflowFamilyEnabled(
			plugin.settings,
			getAIWorkspaceMode(mode).workflowKind,
		);
	const selectedText = context.selectedText?.trim();
	const modeDefinition = getAIWorkspaceMode(activeMode);
	const modeWorkflows = workflows.filter((workflow) =>
		workflowMatchesMode(workflow, activeMode),
	);

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
		// The subject may follow the review queue again once nothing is pending.
		onDraftChange?.(false);
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

	/** The preset list keeps keyboard focus, so the fast surface never steals it. */
	const renderComposer = (shouldAutoFocus: boolean) => (
		<AiPromptComposer
			value={text}
			onChange={handleTextChange}
			onRun={() =>
				submit(
					text,
					activeMode === "card-polish"
						? customCardPolishWorkflowId()
						: undefined,
					"inline",
				)
			}
			onRunInInbox={() =>
				submit(
					text,
					activeMode === "card-polish"
						? customCardPolishWorkflowId()
						: undefined,
					"inbox",
				)
			}
			onDismiss={onDismiss}
			placeholder={modeDefinition.placeholder}
			autoFocus={shouldAutoFocus}
		/>
	);

	if (entry === "presets") {
		return (
			<div class={cn("tr-assistant-fast-prompt", cls)}>
				{selectedText ? (
					<div class="tr-assistant-fast-prompt__selection" title={selectedText}>
						{selectedText}
					</div>
				) : null}

				<AiPresetList
					workflows={modeWorkflows}
					onRun={runWorkflow}
					emptyLabel={`No ${modeDefinition.label} presets yet`}
					footer={
						<div class="tr-assistant-fast-prompt__composer">
							{renderComposer(false)}
						</div>
					}
				/>
			</div>
		);
	}

	const visibleWorkflows = showAllWorkflows
		? modeWorkflows
		: modeWorkflows.slice(0, COMPOSE_WORKFLOW_LIMIT);
	const hiddenWorkflowCount = modeWorkflows.length - visibleWorkflows.length;

	return (
		<div class={cn("tr-assistant-prompt", cls)}>
			<AIWorkspaceNav
				activeMode={activeMode}
				isAvailable={isModeAvailable}
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

			{activeMode === "assistant" ? renderComposer(autoFocus) : null}

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
					) : modeWorkflows.length > COMPOSE_WORKFLOW_LIMIT ? (
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
