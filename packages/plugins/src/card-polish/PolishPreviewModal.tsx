import { useState } from "preact/hooks";

interface PolishPreviewModalProps {
	original: { front: string; back: string };
	proposed: { front: string; back: string } | null; // null => raw fallback
	rawResponse?: string;
	onAccept: () => void;
	onReject: () => void;
	onRetry: (extraInstruction: string) => Promise<void>;
}

export function PolishPreviewModal(props: PolishPreviewModalProps) {
	// Hooks must stay at the top level; the `proposed === null` branch renders a different UI but reuses the same hook state.
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
			<div className="tr-card-polish-preview-root">
				<h4>LLM returned an unparseable response</h4>
				<pre className="tr-card-polish-preview-block">
					{props.rawResponse ?? ""}
				</pre>
				<div className="tr-card-polish-preview-actions">
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

	return (
		<div className="tr-card-polish-preview-root">
			<div className="tr-card-polish-preview-grid">
				<div>
					<h4>Original</h4>
					<div className="tr-card-polish-preview-block">
						<strong>Front</strong>
						<pre>{props.original.front}</pre>
						<strong>Back</strong>
						<pre>{props.original.back}</pre>
					</div>
				</div>
				<div>
					<h4>Proposed</h4>
					<div className="tr-card-polish-preview-block">
						<strong>Front</strong>
						<pre>{props.proposed.front}</pre>
						<strong>Back</strong>
						<pre>{props.proposed.back}</pre>
					</div>
				</div>
			</div>
			<div className="tr-card-polish-preview-actions">
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
