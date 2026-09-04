import { resolveAIClientConfig } from "@true-recall/core/ai/config/ai-client-config";
import { FACT_CHECK_WORKFLOW } from "@true-recall/core/ai/workflows/ai-workflow";
import type { TrueRecallSettings } from "@true-recall/core/types";

import type TrueRecallPlugin from "@true-recall/obsidian/main";

import {
	type AssistantContextCard,
	assistantContextFromCard,
} from "./ai-context-source";
import { isWorkflowFamilyEnabled } from "./workflow-family-gate";

export const FACT_CHECK_QUEUED_MESSAGE =
	"Fact check queued, result in AI inbox";

/** Thread titles are set before the verdict exists, so the card question is the best handle. */
const DISPLAY_QUESTION_LENGTH = 60;

/**
 * Fact check needs web search, which only the OpenRouter and Pro providers
 * offer. Every entry point hides the action when this returns false; the
 * service re-checks at run time for tasks queued before a provider change.
 */
export function isFactCheckAvailable(settings: TrueRecallSettings): boolean {
	if (!isWorkflowFamilyEnabled(settings, "fact-check")) return false;
	try {
		const { providerType } = resolveAIClientConfig(settings, "assistant");
		return providerType === "openrouter" || providerType === "pro";
	} catch {
		return false;
	}
}

export function factCheckDisplayMessage(question: string): string {
	const compact = question
		.replace(/\*\*|\[\[|\]\]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	const excerpt =
		compact.length > DISPLAY_QUESTION_LENGTH
			? `${compact.slice(0, DISPLAY_QUESTION_LENGTH - 3)}...`
			: compact;
	return `Fact check: ${excerpt || "(empty question)"}`;
}

/** Queues a background fact check; the thread starts in the inbox. Returns the task id, or null when the assistant service is not running. */
export function startFactCheck(
	plugin: TrueRecallPlugin,
	card: AssistantContextCard,
): string | null {
	const service = plugin.assistantService;
	if (!service) return null;
	return service.enqueue({
		instruction: FACT_CHECK_WORKFLOW.instruction,
		presetId: FACT_CHECK_WORKFLOW.id,
		context: assistantContextFromCard(card),
		displayMessage: factCheckDisplayMessage(card.question),
	});
}
