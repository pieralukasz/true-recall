import { useMemo, useState } from "preact/hooks";

import type { CardFields } from "@true-recall/core";

interface CardAIPreviewModalProps {
	original: CardFields;
	proposed: CardFields | null;
	proposedNewCards: CardFields[];
	rawResponse?: string;
	onAccept: (selectedNewCardIndices: number[]) => void;
	onReject: () => void;
	onRetry: (extraInstruction: string) => Promise<void>;
}

export function CardAIPreviewModal(props: CardAIPreviewModalProps) {
	const [extra, setExtra] = useState("");
	const [retrying, setRetrying] = useState(false);
	const [selectedNew, setSelectedNew] = useState<Set<number>>(
		() => new Set(props.proposedNewCards.map((_, i) => i)),
	);

	// Reset selection when the proposed list changes via Retry.
	useMemo(() => {
		setSelectedNew(new Set(props.proposedNewCards.map((_, i) => i)));
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
		props.onAccept([...selectedNew].sort((a, b) => a - b));
	};

	const toggleNewCard = (idx: number) => {
		setSelectedNew((prev) => {
			const next = new Set(prev);
			if (next.has(idx)) next.delete(idx);
			else next.add(idx);
			return next;
		});
	};

	const hasEdits = props.proposed !== null;
	const hasNew = props.proposedNewCards.length > 0;

	if (!hasEdits && !hasNew && props.rawResponse !== undefined) {
		return (
			<div className="tr-card-ai-preview-root">
				<h4>LLM returned an unparseable response</h4>
				<pre className="tr-card-ai-preview-block">{props.rawResponse}</pre>
				<div className="tr-card-ai-preview-actions">
					<input
						type="text"
						placeholder="Try a sharper instruction"
						value={extra}
						onInput={(e) => setExtra((e.target as HTMLInputElement).value)}
						disabled={retrying}
					/>
					<button
						type="button"
						onClick={handleRetry}
						disabled={retrying || !extra.trim()}
					>
						Retry
					</button>
					<button type="button" onClick={props.onReject}>
						Close
					</button>
				</div>
			</div>
		);
	}

	const fieldNames = Object.keys(props.original);
	const acceptDisabled = !hasEdits && selectedNew.size === 0;

	return (
		<div className="tr-card-ai-preview-root">
			{hasEdits && (
				<section>
					<h4>Edits to current card</h4>
					<div className="tr-card-ai-preview-grid">
						<div>
							<h5>Original</h5>
							<div className="tr-card-ai-preview-block">
								{fieldNames.map((name) => (
									<div key={name}>
										<strong>{name}</strong>
										<pre>{props.original[name]}</pre>
									</div>
								))}
							</div>
						</div>
						<div>
							<h5>Proposed</h5>
							<div className="tr-card-ai-preview-block">
								{fieldNames.map((name) => (
									<div key={name}>
										<strong>{name}</strong>
										<pre>{props.proposed?.[name] ?? ""}</pre>
									</div>
								))}
							</div>
						</div>
					</div>
				</section>
			)}

			{hasNew && (
				<section>
					<h4>New cards ({props.proposedNewCards.length})</h4>
					<div className="tr-card-ai-preview-new-list">
						{props.proposedNewCards.map((card, idx) => (
							<label key={`new-${idx}`} className="tr-card-ai-preview-new-item">
								<input
									type="checkbox"
									checked={selectedNew.has(idx)}
									onChange={() => toggleNewCard(idx)}
								/>
								<div className="tr-card-ai-preview-block">
									{fieldNames.map((name) => (
										<div key={name}>
											<strong>{name}</strong>
											<pre>{card[name] ?? ""}</pre>
										</div>
									))}
								</div>
							</label>
						))}
					</div>
				</section>
			)}

			<div className="tr-card-ai-preview-actions">
				<input
					type="text"
					placeholder="Extra instruction for retry (optional)"
					value={extra}
					onInput={(e) => setExtra((e.target as HTMLInputElement).value)}
					disabled={retrying}
				/>
				<button
					type="button"
					onClick={handleRetry}
					disabled={retrying || !extra.trim()}
				>
					Retry
				</button>
				<button type="button" onClick={props.onReject}>
					Reject
				</button>
				<button
					type="button"
					className="mod-cta"
					onClick={handleAccept}
					disabled={acceptDisabled}
				>
					Accept
				</button>
			</div>
		</div>
	);
}
