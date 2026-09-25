import type {
	AssistantManifest,
	AssistantProposal,
} from "@true-recall/core/ai/assistant";

import { ActionButton, StatusPill } from "@true-recall/obsidian/components";

import { proposalTitle, statusTone } from "../thread-utils";
import { ConflictNotice, ProposalBody } from "./ProposalViews";
import { pendingProposalCount } from "./proposal-draft";
import type { ProposalReviewController } from "./proposal-review-controller";
import { useProposalDraft } from "./useProposalReview";

export function ProposalCard({
	controller,
	proposal,
	index,
}: {
	controller: ProposalReviewController;
	proposal: AssistantProposal;
	index?: number;
}) {
	const { draft, setField, setText, toggleImage } = useProposalDraft(
		controller,
		proposal,
	);
	const { busy } = controller.state.value;
	const conflict = controller.conflictFor(proposal.id);
	const stateClass =
		proposal.status === "proposed"
			? "is-proposed is-selected"
			: `is-${proposal.status}`;

	return (
		<article class={`tr-card-ai-preview-new-card ${stateClass}`}>
			<header class="tr-card-ai-preview-new-card-header">
				<span class="tr-card-ai-preview-new-card-index">
					{proposalTitle(proposal)}
					{index ? ` #${index}` : ""}
				</span>
				<StatusPill
					label={proposal.status}
					tone={statusTone(proposal.status)}
				/>
			</header>

			{proposal.status === "proposed" ? (
				<div class="tr-card-ai-preview-new-card-body">
					<ProposalBody
						proposal={proposal}
						draft={draft}
						onFieldChange={setField}
						onTextChange={setText}
						onToggleImage={toggleImage}
					/>
					{conflict ? (
						<ConflictNotice
							fields={conflict}
							disabled={busy}
							onForce={() => void controller.applyOne(proposal.id, true)}
							onDismiss={() => controller.dismissConflict(proposal.id)}
						/>
					) : null}
					<div class="tr-card-ai-preview-actions">
						<ActionButton
							label="Reject"
							variant="ghost"
							disabled={busy}
							onClick={() => controller.reject(proposal.id)}
						/>
					</div>
				</div>
			) : null}
		</article>
	);
}

/** The shared Apply / Apply all button under a proposal list. */
export function ProposalActions({
	controller,
	manifest,
	disabled = false,
}: {
	controller: ProposalReviewController;
	manifest: AssistantManifest;
	disabled?: boolean;
}) {
	const pending = pendingProposalCount(manifest);
	if (pending === 0) return null;
	return (
		<ActionButton
			label={pending === 1 ? "Apply" : `Apply all (${pending})`}
			variant="primary"
			disabled={disabled || controller.state.value.busy}
			onClick={() => void controller.applyAll()}
		/>
	);
}
