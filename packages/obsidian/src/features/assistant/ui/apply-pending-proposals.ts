import type {
	AssistantManifest,
	AssistantProposal,
	AssistantTask,
} from "@true-recall/core/ai/assistant";

import type { AssistantApplyService } from "@true-recall/obsidian/services/assistant/assistant-apply.service";

export interface ApplyPendingProposalsResult {
	appliedCount: number;
	conflictedCount: number;
	error?: string;
}

function proposalFields(
	proposal: AssistantProposal,
): Record<string, string> | undefined {
	if (
		proposal.type === "create_card" ||
		proposal.type === "update_card" ||
		proposal.type === "update_draft"
	) {
		return proposal.fields;
	}
	return undefined;
}

export async function applyPendingProposals(
	task: AssistantTask,
	manifest: AssistantManifest,
	apply: Pick<AssistantApplyService, "apply">,
): Promise<ApplyPendingProposalsResult> {
	let appliedCount = 0;
	let conflictedCount = 0;

	for (const proposal of manifest.proposals) {
		if (proposal.status !== "proposed") continue;
		const result = await apply.apply(task, proposal, {
			fields: proposalFields(proposal),
		});
		if (result.conflictFields) {
			conflictedCount++;
			continue;
		}
		if (!result.ok) {
			return {
				appliedCount,
				conflictedCount,
				error: result.error ?? "Could not apply all drafts",
			};
		}
		proposal.status = "applied";
		appliedCount++;
	}

	return { appliedCount, conflictedCount };
}
