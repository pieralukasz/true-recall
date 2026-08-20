import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import type { AIWorkflow } from "@true-recall/core/ai/workflows/ai-workflow";

import { Clickable } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact/hooks";

import { resolvePresetListIndex } from "./preset-list-keys";

const DESCRIPTION_LIMIT = 88;

const WORKFLOW_ICONS: Record<AIWorkflow["kind"], string> = {
	agent: "sparkles",
	"generate-cards": "layers",
	"modify-card": "wand",
};

function describeWorkflow(workflow: AIWorkflow): string {
	const description = workflow.instruction.replace(/\s+/g, " ").trim();
	if (!description) return "Run this saved instruction.";
	if (description.length <= DESCRIPTION_LIMIT) return description;
	return `${description.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`;
}

function polishRunMode(workflow: AIWorkflow): string {
	if (workflow.autoApply && workflow.autoApplyNewCards) return "Apply all";
	if (workflow.autoApply) return "Apply edit";
	if (workflow.autoApplyNewCards) return "Apply new";
	return "Preview";
}

function RowIcon({ icon }: { icon: string }) {
	const iconRef = useIcon(icon);
	return <span ref={iconRef} class="tr-ai-preset-row__icon" />;
}

interface AiPresetListProps {
	workflows: AIWorkflow[];
	onRun: (workflow: AIWorkflow) => void;
	/** Rendered under the list — the collapsed free-text escape hatch. */
	footer?: JSX.Element | null;
	emptyLabel: string;
}

/**
 * The fast AI surface: saved instructions as one-click rows, keyboard-navigable,
 * with no workspace chrome above them. This is the density the anchored Card
 * Polish menu had, and losing it is the whole reason the workspace felt slow.
 */
export function AiPresetList({
	workflows,
	onRun,
	footer,
	emptyLabel,
}: AiPresetListProps) {
	const listRef = useRef<HTMLDivElement>(null);
	const [focusedIndex, setFocusedIndex] = useState(
		workflows.length > 0 ? 0 : -1,
	);

	useEffect(() => {
		const rows =
			listRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']");
		rows?.[focusedIndex]?.focus();
	}, [focusedIndex]);

	const handleKeyDown = (event: KeyboardEvent) => {
		if ((event.target as HTMLElement | null)?.matches("input, textarea"))
			return;
		const next = resolvePresetListIndex(event, focusedIndex, workflows.length);
		if (next === null) return;
		event.preventDefault();
		setFocusedIndex(next);
	};

	if (workflows.length === 0) {
		return (
			<div class="tr-ai-preset-list">
				<div class="tr-assistant-prompt__empty-mode">
					<strong>{emptyLabel}</strong>
				</div>
				{footer}
			</div>
		);
	}

	return (
		<div class="tr-ai-preset-list">
			<div
				class="tr-ai-preset-list__rows"
				role="menu"
				tabIndex={-1}
				onKeyDown={handleKeyDown}
			>
				{workflows.map((workflow) => (
					<Clickable
						key={workflow.id}
						class="tr-ai-preset-row"
						role="menuitem"
						title={workflow.instruction}
						onClick={() => onRun(workflow)}
					>
						<RowIcon icon={WORKFLOW_ICONS[workflow.kind]} />
						<span class="tr-ai-preset-row__copy">
							<strong>{workflow.name}</strong>
							<small>{describeWorkflow(workflow)}</small>
						</span>
						{workflow.kind === "modify-card" ? (
							<span class="tr-ai-preset-row__mode">
								{polishRunMode(workflow)}
							</span>
						) : null}
					</Clickable>
				))}
			</div>
			{footer}
		</div>
	);
}
