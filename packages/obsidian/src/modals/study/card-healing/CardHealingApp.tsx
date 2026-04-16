import { useEffect, useState } from "preact/hooks";

import type { HealingSuggestion } from "@true-recall/core/ai/healing/healing.types";

import type { CardHealingResult } from "./types";

interface CardHealingAppProps {
	healPromise: Promise<HealingSuggestion>;
	originalQuestion: string;
	originalAnswer: string;
	onDone: (result: CardHealingResult) => void;
}

export function CardHealingApp({
	healPromise,
	originalQuestion,
	originalAnswer,
	onDone,
}: CardHealingAppProps) {
	const [suggestion, setSuggestion] = useState<HealingSuggestion | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		healPromise
			.then((result) => {
				if (!cancelled) setSuggestion(result);
			})
			.catch((e) => {
				if (!cancelled) setError(String(e.message ?? e));
			});
		return () => {
			cancelled = true;
		};
	}, [healPromise]);

	if (error) {
		return (
			<div class="ep:p-4">
				<p class="ep:text-red-500">Failed to analyze card: {error}</p>
				<button
					type="button"
					class="mod-cta"
					onClick={() => onDone({ cancelled: true })}
				>
					Close
				</button>
			</div>
		);
	}

	if (!suggestion) {
		return (
			<div class="ep:flex ep:flex-col ep:items-center ep:gap-3 ep:p-8">
				<div class="ep:animate-spin ep:w-6 ep:h-6 ep:border-2 ep:border-obs-accent ep:border-t-transparent ep:rounded-full" />
				<p class="ep:text-obs-muted">Analyzing card...</p>
			</div>
		);
	}

	const hasRewrite = suggestion.rewrittenQuestion || suggestion.rewrittenAnswer;
	const newQ = suggestion.rewrittenQuestion ?? originalQuestion;
	const newA = suggestion.rewrittenAnswer ?? originalAnswer;

	return (
		<div class="ep:flex ep:flex-col ep:gap-4 ep:p-4">
			<div>
				<h4 class="ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:mb-1">
					Diagnosis
				</h4>
				<p class="ep:text-obs-normal">{suggestion.diagnosis}</p>
			</div>

			{hasRewrite && (
				<div>
					<h4 class="ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:mb-2">
						Suggested Rewrite
					</h4>
					<div class="ep:flex ep:flex-col ep:gap-2">
						{suggestion.rewrittenQuestion && (
							<div class="ep:bg-obs-secondary ep:rounded ep:p-3">
								<span class="ep:text-ui-smaller ep:text-obs-muted">
									Question
								</span>
								<p class="ep:mt-1">{suggestion.rewrittenQuestion}</p>
							</div>
						)}
						{suggestion.rewrittenAnswer && (
							<div class="ep:bg-obs-secondary ep:rounded ep:p-3">
								<span class="ep:text-ui-smaller ep:text-obs-muted">Answer</span>
								<p class="ep:mt-1">{suggestion.rewrittenAnswer}</p>
							</div>
						)}
					</div>
				</div>
			)}

			{suggestion.mnemonic && (
				<div>
					<h4 class="ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:mb-1">
						Mnemonic
					</h4>
					<p class="ep:text-obs-normal ep:italic">{suggestion.mnemonic}</p>
				</div>
			)}

			<div class="ep:flex ep:gap-2 ep:justify-end ep:pt-2">
				<button
					type="button"
					class="mod-muted"
					onClick={() => onDone({ cancelled: true })}
				>
					Dismiss
				</button>
				{hasRewrite && (
					<button
						type="button"
						class="mod-cta"
						onClick={() =>
							onDone({
								cancelled: false,
								appliedQuestion: newQ,
								appliedAnswer: newA,
							})
						}
					>
						Apply Changes
					</button>
				)}
			</div>
		</div>
	);
}
