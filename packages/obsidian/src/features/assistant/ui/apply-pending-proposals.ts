import type {
	AssistantManifest,
	AssistantProposal,
	AssistantTask,
} from "@true-recall/core/ai/assistant";

import type { AssistantApplyService } from "@true-recall/obsidian/services/assistant/assistant-apply.service";

export interface ApplyPendingProposalsResult {
	appliedCount: number;
	conflictedCount: number;
	/** Conflicting field names per proposal id, for the per-card conflict UI. */
	conflicts: Record<string, string[]>;
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
	options?: { shouldApply?: (proposal: AssistantProposal) => boolean },
): Promise<ApplyPendingProposalsResult> {
	let appliedCount = 0;
	let conflictedCount = 0;
	const conflicts: Record<string, string[]> = {};

	for (const proposal of manifest.proposals) {
		if (proposal.status !== "proposed") continue;
		if (options?.shouldApply && !options.shouldApply(proposal)) continue;
		const result = await apply.apply(task, proposal, {
			fields: proposalFields(proposal),
		});
		if (result.conflictFields) {
			conflictedCount++;
			conflicts[proposal.id] = result.conflictFields;
			continue;
		}
		if (!result.ok) {
			return {
				appliedCount,
				conflictedCount,
				conflicts,
				error: result.error ?? "Could not apply all drafts",
			};
		}
		proposal.status = "applied";
		appliedCount++;
	}

	return { appliedCount, conflictedCount, conflicts };
}
