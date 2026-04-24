import { useState } from "preact/hooks";

import type { CardFields } from "@true-recall/core";

interface CardAIPreviewModalProps {
	original: CardFields;
	proposed: CardFields | null;
	rawResponse?: string;
	onAccept: () => void;
	onReject: () => void;
	onRetry: (extraInstruction: string) => Promise<void>;
}

export function CardAIPreviewModal(props: CardAIPreviewModalProps) {
	const [extra, setExtra] = useState("");
	const [retrying, setRetrying] = useState(false);

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

	if (!props.proposed) {
		return (
			<div className="tr-card-ai-preview-root">
				<h4>LLM returned an unparseable response</h4>
				<pre className="tr-card-ai-preview-block">
					{props.rawResponse ?? ""}
				</pre>
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
	return (
		<div className="tr-card-ai-preview-root">
			<div className="tr-card-ai-preview-grid">
				<div>
					<h4>Original</h4>
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
					<h4>Proposed</h4>
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
				<button type="button" className="mod-cta" onClick={props.onAccept}>
					Accept
				</button>
			</div>
		</div>
	);
}
