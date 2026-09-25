import type { AssistantProposal } from "@true-recall/core/ai/assistant";

import { ActionButton } from "@true-recall/obsidian/components";

import { contentField } from "../thread-utils";
import type { ProposalDraft } from "./proposal-draft";
import { CardAIField } from "@true-recall/plugins/shared/CardAIField";

type ImageProposal = Extract<AssistantProposal, { type: "attach_images" }>;

export function CardFieldsView({
	names,
	fields,
	onChange,
}: {
	names: readonly string[];
	fields: Readonly<Record<string, string>>;
	onChange: (name: string, value: string) => void;
}) {
	return (
		<>
			{names.map((name) => (
				<CardAIField
					key={name}
					label={name}
					value={fields[name] ?? ""}
					onChange={(value) => onChange(name, value)}
				/>
			))}
		</>
	);
}

export function ImageCandidatesView({
	proposal,
	selected,
	onToggle,
}: {
	proposal: ImageProposal;
	selected: readonly number[];
	onToggle: (index: number) => void;
}) {
	return (
		<div class="ep:grid ep:gap-2 ep:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
			{proposal.candidates.map((candidate, index) => (
				<label
					key={candidate.url}
					class="ep:flex ep:flex-col ep:gap-1 ep:text-ui-smaller ep:cursor-pointer"
				>
					<input
						type="checkbox"
						checked={selected.includes(index)}
						onChange={() => onToggle(index)}
					/>
					<img
						class="ep:w-full ep:max-h-30 ep:object-cover ep:rounded-md"
						src={candidate.thumbnailUrl ?? candidate.url}
						alt={candidate.title ?? ""}
						loading="lazy"
					/>
					<span>
						{candidate.title ?? candidate.url}{" "}
						{candidate.license ? `(${candidate.license})` : ""}
					</span>
				</label>
			))}
		</div>
	);
}

/** Editors for one pending proposal, chosen by its type. */
export function ProposalBody({
	proposal,
	draft,
	onFieldChange,
	onTextChange,
	onToggleImage,
}: {
	proposal: AssistantProposal;
	draft: ProposalDraft;
	onFieldChange: (name: string, value: string) => void;
	onTextChange: (text: string) => void;
	onToggleImage: (index: number) => void;
}) {
	const content = contentField(proposal);
	switch (proposal.type) {
		case "create_card":
		case "update_card":
		case "update_draft":
			return (
				<CardFieldsView
					names={Object.keys(proposal.fields)}
					fields={draft.fields ?? proposal.fields}
					onChange={onFieldChange}
				/>
			);
		case "attach_images":
			return (
				<ImageCandidatesView
					proposal={proposal}
					selected={draft.selectedImages ?? []}
					onToggle={onToggleImage}
				/>
			);
		default:
			return content ? (
				<CardAIField
					label={content.label}
					value={draft.text ?? content.value}
					onChange={onTextChange}
				/>
			) : null;
	}
}

export function ConflictNotice({
	fields,
	disabled,
	onForce,
	onDismiss,
}: {
	fields: readonly string[];
	disabled: boolean;
	onForce: () => void;
	onDismiss: () => void;
}) {
	return (
		<div class="ep:flex ep:flex-wrap ep:items-center ep:gap-2 ep:p-2 ep:rounded-md ep:border ep:border-obs-border ep:bg-surface-raised ep:text-ui-smaller ep:text-obs-muted">
			<span>Fields changed since the AI saw them: {fields.join(", ")}.</span>
			<div class="ep:flex ep:gap-1.5 ep:ml-auto">
				<ActionButton
					label="Apply anyway"
					variant="danger"
					size="sm"
					disabled={disabled}
					onClick={onForce}
				/>
				<ActionButton
					label="Cancel"
					variant="ghost"
					size="sm"
					onClick={onDismiss}
				/>
			</div>
		</div>
	);
}
