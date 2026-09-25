import type {
	AssistantManifest,
	AssistantProposal,
	ProposalStatus,
} from "@true-recall/core/ai/assistant";

/**
 * The user's edits to one proposal before it is applied. Only the slot that
 * matches the proposal type is used: `fields` for card proposals, `text` for
 * note and diagram content, `selectedImages` for image candidates.
 */
export interface ProposalDraft {
	fields?: Readonly<Record<string, string>>;
	text?: string;
	selectedImages?: readonly number[];
}

type CardProposal = Extract<
	AssistantProposal,
	{ type: "create_card" | "update_card" | "update_draft" }
>;

export function isCardProposal(
	proposal: AssistantProposal,
): proposal is CardProposal {
	return (
		proposal.type === "create_card" ||
		proposal.type === "update_card" ||
		proposal.type === "update_draft"
	);
}

/** The draft a proposal starts with before the user edits it. */
export function draftFromProposal(proposal: AssistantProposal): ProposalDraft {
	switch (proposal.type) {
		case "create_card":
		case "update_card":
		case "update_draft":
			return { fields: { ...proposal.fields } };
		case "append_to_note":
		case "create_note":
			return { text: proposal.markdown };
		case "insert_diagram":
			return { text: proposal.code };
		case "attach_images":
			return {
				selectedImages: proposal.candidates.flatMap((candidate, index) =>
					candidate.selected ? [index] : [],
				),
			};
	}
}

/** Returns a copy of `proposal` carrying the draft; never mutates the input. */
export function withDraft(
	proposal: AssistantProposal,
	draft: ProposalDraft,
): AssistantProposal {
	switch (proposal.type) {
		case "create_card":
		case "update_card":
		case "update_draft":
			return draft.fields
				? { ...proposal, fields: { ...draft.fields } }
				: proposal;
		case "append_to_note":
		case "create_note":
			return draft.text === undefined
				? proposal
				: { ...proposal, markdown: draft.text };
		case "insert_diagram":
			return draft.text === undefined
				? proposal
				: { ...proposal, code: draft.text };
		case "attach_images": {
			if (!draft.selectedImages) return proposal;
			const selected = new Set(draft.selectedImages);
			return {
				...proposal,
				candidates: proposal.candidates.map((candidate, index) => ({
					...candidate,
					selected: selected.has(index),
				})),
			};
		}
	}
}

/** Field overrides passed to `AssistantApplyService.apply` for card types. */
export function applyFieldOverrides(
	proposal: AssistantProposal,
): Record<string, string> | undefined {
	return isCardProposal(proposal) ? proposal.fields : undefined;
}

export function findProposal(
	manifest: AssistantManifest | undefined,
	proposalId: string,
): AssistantProposal | undefined {
	return manifest?.proposals.find((proposal) => proposal.id === proposalId);
}

/** Copies the manifest, replacing one proposal through `update`. */
export function updateProposal(
	manifest: AssistantManifest,
	proposalId: string,
	update: (proposal: AssistantProposal) => AssistantProposal,
): AssistantManifest {
	return {
		...manifest,
		proposals: manifest.proposals.map((proposal) =>
			proposal.id === proposalId ? update(proposal) : proposal,
		),
	};
}

export function setProposalStatus(
	manifest: AssistantManifest,
	proposalId: string,
	status: ProposalStatus,
): AssistantManifest {
	return updateProposal(manifest, proposalId, (proposal) => ({
		...proposal,
		status,
	}));
}

export function pendingProposalCount(
	manifest: AssistantManifest | undefined,
): number {
	return (
		manifest?.proposals.filter((proposal) => proposal.status === "proposed")
			.length ?? 0
	);
}
