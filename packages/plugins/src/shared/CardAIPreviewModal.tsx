import { useEffect, useState } from "preact/hooks";

import type { CardFields } from "@true-recall/core";

import { CardAIFieldEditor } from "./CardAIFieldEditor";

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
			<div class="tr-card-ai-preview-root">
				<section class="tr-card-ai-preview-section">
					<h4 class="tr-card-ai-preview-section-title">
						LLM returned an unparseable response
					</h4>
					<pre class="tr-card-ai-preview-raw">{props.rawResponse}</pre>
				</section>
				<ActionsBar
					extra={extra}
					setExtra={setExtra}
					retrying={retrying}
					onRetry={handleRetry}
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

	return (
		<div class="tr-card-ai-preview-root">
			{hasEdits && (
				<section class="tr-card-ai-preview-section">
					<h4 class="tr-card-ai-preview-section-title">
						Edits to current card
					</h4>
					<div class="tr-card-ai-preview-grid">
						<div class="tr-card-ai-preview-column">
							<h5 class="tr-card-ai-preview-column-title">Original</h5>
							{fieldNames.map((name) => (
								<FieldBlock
									key={`orig-${name}`}
									label={name}
									value={props.original[name] ?? ""}
									readOnly
								/>
							))}
						</div>
						<div class="tr-card-ai-preview-column">
							<h5 class="tr-card-ai-preview-column-title">Proposed</h5>
							{fieldNames.map((name) => (
								<FieldBlock
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
						<h4 class="tr-card-ai-preview-section-title">Source card</h4>
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
								<FieldBlock
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
					<h4 class="tr-card-ai-preview-section-title">
						New cards ({editedNewCards.length})
					</h4>
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
											<FieldBlock
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
				onRetry={handleRetry}
				onReject={props.onReject}
				showAccept
				acceptDisabled={acceptDisabled}
				onAccept={handleAccept}
				rejectLabel="Reject"
			/>
		</div>
	);
}

interface FieldBlockProps {
	label: string;
	value: string;
	onChange?: (next: string) => void;
	readOnly?: boolean;
	disabled?: boolean;
}

function FieldBlock({
	label,
	value,
	onChange,
	readOnly = false,
	disabled = false,
}: FieldBlockProps) {
	const isReadOnly = readOnly || disabled;
	return (
		<div class={`tr-card-ai-preview-field${disabled ? " is-disabled" : ""}`}>
			<div class="tr-card-ai-preview-field-label">{label}</div>
			<CardAIFieldEditor
				value={value}
				onChange={isReadOnly ? undefined : onChange}
				readOnly={isReadOnly}
				ariaLabel={label}
			/>
		</div>
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
	rejectLabel: string;
}

function ActionsBar(props: ActionsBarProps) {
	return (
		<div class="tr-card-ai-preview-actions">
			<input
				type="text"
				class="tr-card-ai-preview-extra-input"
				placeholder="Extra instruction for retry (optional)"
				value={props.extra}
				onInput={(e) => props.setExtra((e.target as HTMLInputElement).value)}
				disabled={props.retrying}
			/>
			<button
				type="button"
				onClick={props.onRetry}
				disabled={props.retrying || !props.extra.trim()}
			>
				Retry
			</button>
			<button type="button" onClick={props.onReject}>
				{props.rejectLabel}
			</button>
			{props.showAccept && (
				<button
					type="button"
					class="mod-cta"
					onClick={props.onAccept}
					disabled={props.acceptDisabled}
				>
					Accept
				</button>
			)}
		</div>
	);
}
