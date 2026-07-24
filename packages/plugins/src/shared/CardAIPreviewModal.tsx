import { useEffect, useState } from "preact/hooks";

import type { CardFields } from "@true-recall/core";

import { ActionButton, StatusPill } from "@true-recall/obsidian/components";
import { AiComposer } from "@true-recall/obsidian/features/assistant/ui/AiComposer";

import { CardAIField } from "./CardAIField";

interface CardAIPreviewModalProps {
	original: CardFields;
	proposed: CardFields | null;
	proposedNewCards: CardFields[];
	rawResponse?: string;
	/** Whether a source card exists in the store and can be deleted on accept. */
	canDeleteSource?: boolean;
	onAccept: (
		editedProposed: CardFields | null,
		editedSelectedNewCards: CardFields[],
		deleteSource: boolean,
	) => void;
	onReject: () => void;
	onRetry: (extraInstruction: string) => Promise<void>;
}

export function CardAIPreviewModal(props: CardAIPreviewModalProps) {
	const [extra, setExtra] = useState("");
	const [retrying, setRetrying] = useState(false);

	const [editedProposed, setEditedProposed] = useState<CardFields | null>(
		props.proposed,
	);
	const [editedNewCards, setEditedNewCards] = useState<CardFields[]>(
		props.proposedNewCards,
	);
	const [selectedNew, setSelectedNew] = useState<Set<number>>(
		() => new Set(props.proposedNewCards.map((_, i) => i)),
	);
	const [deleteSource, setDeleteSource] = useState(false);

	useEffect(() => {
		setEditedProposed(props.proposed);
	}, [props.proposed]);

	useEffect(() => {
		setEditedNewCards(props.proposedNewCards);
		setSelectedNew(new Set(props.proposedNewCards.map((_, i) => i)));
		setDeleteSource(false);
	}, [props.proposedNewCards]);

	const handleRetry = async () => {
		if (!extra.trim() || retrying) return;
		setRetrying(true);
		try {
			await props.onRetry(extra.trim());
			setExtra("");
		} finally {
			setRetrying(false);
		}
	};

	const handleAccept = () => {
		const selectedSorted = [...selectedNew].sort((a, b) => a - b);
		const selectedCards = selectedSorted
			.map((idx) => editedNewCards[idx])
			.filter((c): c is CardFields => !!c);
		const reallyDelete =
			!!props.canDeleteSource && !hasEdits && hasNew && deleteSource;
		props.onAccept(editedProposed, selectedCards, reallyDelete);
	};

	const toggleNewCard = (idx: number) => {
		setSelectedNew((prev) => {
			const next = new Set(prev);
			if (next.has(idx)) next.delete(idx);
			else next.add(idx);
			return next;
		});
	};

	const updateProposedField = (name: string, value: string) => {
		setEditedProposed((prev) => (prev ? { ...prev, [name]: value } : prev));
	};

	const updateNewCardField = (idx: number, name: string, value: string) => {
		setEditedNewCards((prev) => {
			const next = prev.slice();
			const card = next[idx];
			if (!card) return prev;
			next[idx] = { ...card, [name]: value };
			return next;
		});
	};

	const hasEdits = props.proposed !== null;
	const hasNew = props.proposedNewCards.length > 0;

	if (!hasEdits && !hasNew && props.rawResponse !== undefined) {
		return (
			<div class="tr-card-ai-preview-root tr-card-ai-preview-dialog">
				<section class="tr-card-ai-preview-section">
					<SectionHeading
						title="AI response needs attention"
						description="The response could not be converted into flashcards. Refine the instruction or inspect the raw output."
						badge="Raw response"
					/>
					<pre class="tr-card-ai-preview-raw">{props.rawResponse}</pre>
				</section>
				<ActionsBar
					extra={extra}
					setExtra={setExtra}
					retrying={retrying}
					onRetry={() => void handleRetry()}
					onReject={props.onReject}
					showAccept={false}
					acceptDisabled
					onAccept={handleAccept}
					rejectLabel="Close"
				/>
			</div>
		);
	}

	const fieldNames = Object.keys(props.original);
	const acceptDisabled = !hasEdits && selectedNew.size === 0;
	const acceptLabel = hasEdits
		? hasNew
			? "Apply changes"
			: "Apply edit"
		: "Add selected cards";

	return (
		<div class="tr-card-ai-preview-root tr-card-ai-preview-dialog">
			{hasEdits && (
				<section class="tr-card-ai-preview-section">
					<SectionHeading
						title="Current card"
						description="Compare the original with the AI proposal. You can edit the proposed fields before applying."
						badge="1 edit"
					/>
					<div class="tr-card-ai-preview-grid">
						<div class="tr-card-ai-preview-column is-original">
							<h5 class="tr-card-ai-preview-column-title">Original</h5>
							{fieldNames.map((name) => (
								<CardAIField
									key={`orig-${name}`}
									label={name}
									value={props.original[name] ?? ""}
									readOnly
								/>
							))}
						</div>
						<div class="tr-card-ai-preview-column is-proposed">
							<h5 class="tr-card-ai-preview-column-title">Proposed</h5>
							{fieldNames.map((name) => (
								<CardAIField
									key={`prop-${name}`}
									label={name}
									value={editedProposed?.[name] ?? ""}
									onChange={(v) => updateProposedField(name, v)}
								/>
							))}
						</div>
					</div>
				</section>
			)}

			{hasNew && !hasEdits && (
				<section class="tr-card-ai-preview-section">
					<div class="tr-card-ai-preview-source-header">
						<SectionHeading
							title="Source card"
							description="The card used as context for these suggestions."
						/>
						{props.canDeleteSource && (
							<label class="tr-card-ai-preview-delete-toggle">
								<input
									type="checkbox"
									checked={deleteSource}
									onChange={() => setDeleteSource((v) => !v)}
								/>
								<span>Delete after applying</span>
							</label>
						)}
					</div>
					<article
						class={`tr-card-ai-preview-source-card${
							deleteSource ? " is-doomed" : ""
						}`}
					>
						{deleteSource && (
							<div class="tr-card-ai-preview-source-banner">
								Will be deleted when you click Accept.
							</div>
						)}
						<div class="tr-card-ai-preview-source-body">
							{fieldNames.map((name) => (
								<CardAIField
									key={`source-${name}`}
									label={name}
									value={props.original[name] ?? ""}
									readOnly
								/>
							))}
						</div>
					</article>
				</section>
			)}

			{hasNew && (
				<section class="tr-card-ai-preview-section">
					<SectionHeading
						title="New cards"
						description="Select the suggestions you want to add. Every field remains editable."
						badge={`${selectedNew.size} of ${editedNewCards.length} selected`}
					/>
					<div class="tr-card-ai-preview-new-list">
						{editedNewCards.map((card, idx) => {
							const isSelected = selectedNew.has(idx);
							return (
								<article
									key={`new-${idx}`}
									class={`tr-card-ai-preview-new-card${
										isSelected ? " is-selected" : ""
									}`}
								>
									<header class="tr-card-ai-preview-new-card-header">
										<span class="tr-card-ai-preview-new-card-index">
											#{idx + 1}
										</span>
										<label class="tr-card-ai-preview-new-card-toggle">
											<input
												type="checkbox"
												checked={isSelected}
												onChange={() => toggleNewCard(idx)}
											/>
											<span>Include</span>
										</label>
									</header>
									<div class="tr-card-ai-preview-new-card-body">
										{fieldNames.map((name) => (
											<CardAIField
												key={`new-${idx}-${name}`}
												label={name}
												value={card[name] ?? ""}
												onChange={(v) => updateNewCardField(idx, name, v)}
												disabled={!isSelected}
											/>
										))}
									</div>
								</article>
							);
						})}
					</div>
				</section>
			)}

			<ActionsBar
				extra={extra}
				setExtra={setExtra}
				retrying={retrying}
				onRetry={() => void handleRetry()}
				onReject={props.onReject}
				showAccept
				acceptDisabled={acceptDisabled}
				onAccept={handleAccept}
				acceptLabel={acceptLabel}
				rejectLabel="Reject"
			/>
		</div>
	);
}

function SectionHeading({
	title,
	description,
	badge,
}: {
	title: string;
	description: string;
	badge?: string;
}) {
	return (
		<header class="tr-card-ai-preview-section-heading">
			<div>
				<h4 class="tr-card-ai-preview-section-title">{title}</h4>
				<p>{description}</p>
			</div>
			{badge ? <StatusPill label={badge} /> : null}
		</header>
	);
}

interface ActionsBarProps {
	extra: string;
	setExtra: (v: string) => void;
	retrying: boolean;
	onRetry: () => void;
	onReject: () => void;
	showAccept: boolean;
	acceptDisabled: boolean;
	onAccept: () => void;
	acceptLabel?: string;
	rejectLabel: string;
}

function ActionsBar(props: ActionsBarProps) {
	return (
		<div class="tr-card-ai-preview-actions">
			<div class="tr-card-ai-preview-refine">
				<label for="tr-card-ai-preview-refine-input">Refine result</label>
				<AiComposer
					variant="workspace"
					class="tr-card-ai-preview-refine-composer"
					inputId="tr-card-ai-preview-refine-input"
					value={props.extra}
					onChange={props.setExtra}
					onSubmit={props.onRetry}
					placeholder="Tell AI what to change…"
					busy={props.retrying}
					submitLabel={props.retrying ? "Retrying…" : "Retry"}
					hint={
						<span>
							<kbd>Enter</kbd> retry <span aria-hidden="true">·</span>{" "}
							<kbd>Shift Enter</kbd> new line
						</span>
					}
					afterSubmit={
						<>
							<ActionButton
								label={props.rejectLabel}
								variant="ghost"
								size="sm"
								onClick={props.onReject}
							/>
							{props.showAccept ? (
								<ActionButton
									label={props.acceptLabel ?? "Apply"}
									variant="primary"
									size="sm"
									disabled={props.acceptDisabled || props.retrying}
									onClick={props.onAccept}
								/>
							) : null}
						</>
					}
				/>
			</div>
		</div>
	);
}
