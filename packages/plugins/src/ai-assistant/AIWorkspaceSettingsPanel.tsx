import { useState } from "preact/hooks";

import { FormCard } from "@true-recall/obsidian/components";

import { AIGenerationSettingsPanel } from "../ai-generation/AIGenerationSettingsPanel";
import { CardPolishSettingsPanel } from "../card-polish";
import type { PluginSettingsProps } from "../types";
import { AssistantSettingsPanel } from "./AssistantSettingsPanel";

type WorkspaceSection = "assistant" | "generate" | "improve";

const WORKSPACE_SECTIONS: { id: WorkspaceSection; label: string }[] = [
	{ id: "assistant", label: "Assistant" },
	{ id: "generate", label: "Generate cards" },
	{ id: "improve", label: "Improve cards" },
];

export function AIWorkspaceSettingsPanel(props: PluginSettingsProps) {
	const [activeSection, setActiveSection] =
		useState<WorkspaceSection>("assistant");

	return (
		<div class="ep:flex ep:flex-col ep:gap-4">
			<div class="ep:text-ui-smaller ep:text-obs-muted ep:p-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-secondary">
				Assistant, card generation, and card editing share one workspace, task
				queue, and Inbox.
			</div>
			<div
				class="tr-ai-workspace-nav"
				role="group"
				aria-label="AI Workspace settings"
			>
				{WORKSPACE_SECTIONS.map((section) => (
					<button
						key={section.id}
						type="button"
						class={activeSection === section.id ? "is-active" : undefined}
						aria-pressed={activeSection === section.id}
						onClick={() => setActiveSection(section.id)}
					>
						{section.label}
					</button>
				))}
			</div>
			<div hidden={activeSection !== "assistant"}>
				<FormCard
					title="Assistant"
					description="Research, questions, and reusable quick actions."
				>
					<AssistantSettingsPanel {...props} />
				</FormCard>
			</div>
			<div hidden={activeSection !== "generate"}>
				<FormCard
					title="Generate cards"
					description="Presets that turn notes and selections into new flashcards."
				>
					<AIGenerationSettingsPanel {...props} />
				</FormCard>
			</div>
			<div hidden={activeSection !== "improve"}>
				<FormCard
					title="Improve existing cards"
					description="Presets that rewrite, complete, or split a flashcard."
				>
					<CardPolishSettingsPanel {...props} />
				</FormCard>
			</div>
		</div>
	);
}
