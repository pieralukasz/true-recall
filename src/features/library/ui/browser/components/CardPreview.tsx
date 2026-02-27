import { FSRS_COLORS, MUTED_STATES } from "@shared/ui/helpers/fsrs-colors";
import { Clickable } from "@shared/ui/components";
import { State } from "ts-fsrs";
import type { BrowserCard } from "../types";

const STATE_LABELS: Record<number, string> = {
	[State.New]: "New",
	[State.Learning]: "Learning",
	[State.Review]: "Review",
	[State.Relearning]: "Relearning",
};

interface CardPreviewProps {
	card: BrowserCard;
	onClose: () => void;
}

export function CardPreview({ card, onClose }: CardPreviewProps) {
	const stateLabel = card.suspended
		? "Suspended"
		: card.buriedUntil && new Date(card.buriedUntil) > new Date()
			? "Buried"
			: STATE_LABELS[card.state] ?? "Unknown";

	const stateColors = card.suspended
		? FSRS_COLORS.suspended
		: card.buriedUntil && new Date(card.buriedUntil) > new Date()
			? null
			: (() => {
					const key =
						STATE_LABELS[card.state]?.toLowerCase() as
							| "new"
							| "learning"
							| "review"
							| "relearning"
							| undefined;
					return key ? FSRS_COLORS[key] : null;
				})();

	const badgeCls =
		stateColors?.badgeCls ?? MUTED_STATES.buried.badgeCls;

	return (
		<div class="ep:w-[320px] ep:border-l ep:border-obs-border ep:flex ep:flex-col ep:shrink-0 ep:overflow-y-auto ep:bg-obs-primary">
			{/* Header */}
			<div class="ep:flex ep:items-center ep:justify-between ep:px-4 ep:py-3 ep:border-b ep:border-obs-border">
				<span
					class={`ep:px-2 ep:py-0.5 ep:rounded-full ep:text-[11px] ep:font-medium ${badgeCls}`}
				>
					{stateLabel}
				</span>
				<Clickable
					class="ep:p-1 ep:rounded hover:ep:bg-obs-modifier-hover ep:text-obs-muted"
					onClick={onClose}
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</Clickable>
			</div>

			{/* Question */}
			<div class="ep:px-4 ep:py-3 ep:border-b ep:border-obs-border/50">
				<div class="ep:text-[10px] ep:uppercase ep:tracking-wider ep:text-obs-muted ep:mb-1.5">
					Question
				</div>
				<div class="ep:text-sm ep:text-obs-normal ep:leading-relaxed ep:whitespace-pre-wrap">
					{card.question}
				</div>
			</div>

			{/* Answer */}
			<div class="ep:px-4 ep:py-3 ep:border-b ep:border-obs-border/50">
				<div class="ep:text-[10px] ep:uppercase ep:tracking-wider ep:text-obs-muted ep:mb-1.5">
					Answer
				</div>
				<div class="ep:text-sm ep:text-obs-normal ep:leading-relaxed ep:whitespace-pre-wrap">
					{card.answer}
				</div>
			</div>

			{/* FSRS Stats */}
			<div class="ep:px-4 ep:py-3 ep:border-b ep:border-obs-border/50">
				<div class="ep:text-[10px] ep:uppercase ep:tracking-wider ep:text-obs-muted ep:mb-2">
					FSRS Statistics
				</div>
				<div class="ep:grid ep:grid-cols-2 ep:gap-x-4 ep:gap-y-1.5 ep:text-sm">
					<StatRow
						label="Stability"
						value={formatStability(card.stability)}
					/>
					<StatRow
						label="Difficulty"
						value={card.difficulty.toFixed(2)}
					/>
					<StatRow label="Reviews" value={String(card.reps)} />
					<StatRow label="Lapses" value={String(card.lapses)} />
					<StatRow
						label="Interval"
						value={`${card.scheduledDays}d`}
					/>
					<StatRow
						label="Last Review"
						value={
							card.lastReview
								? new Date(
										card.lastReview,
									).toLocaleDateString()
								: "Never"
						}
					/>
				</div>
			</div>

			{/* Meta */}
			<div class="ep:px-4 ep:py-3">
				<div class="ep:text-[10px] ep:uppercase ep:tracking-wider ep:text-obs-muted ep:mb-2">
					Card Info
				</div>
				<div class="ep:flex ep:flex-col ep:gap-1.5 ep:text-sm">
					{card.sourceNoteName && (
						<MetaRow label="Source" value={card.sourceNoteName} />
					)}
					<MetaRow label="Type" value={card.cardType} />
					<MetaRow
						label="Created"
						value={card.createdVia ?? "manual"}
					/>
					{card.presetName && (
						<MetaRow label="Preset" value={card.presetName} />
					)}
					{card.projects.length > 0 && (
						<MetaRow
							label="Projects"
							value={card.projects.join(", ")}
						/>
					)}
				</div>
			</div>
		</div>
	);
}

function StatRow({ label, value }: { label: string; value: string }) {
	return (
		<>
			<span class="ep:text-obs-muted">{label}</span>
			<span class="ep:text-obs-normal ep:text-right">{value}</span>
		</>
	);
}

function MetaRow({ label, value }: { label: string; value: string }) {
	return (
		<div class="ep:flex ep:justify-between ep:items-center">
			<span class="ep:text-obs-muted">{label}</span>
			<span class="ep:text-obs-normal">{value}</span>
		</div>
	);
}

function formatStability(days: number): string {
	if (days === 0) return "0";
	if (days < 1) return `${Math.round(days * 24)}h`;
	if (days < 30) return `${Math.round(days)}d`;
	if (days < 365) return `${(days / 30).toFixed(1)} months`;
	return `${(days / 365).toFixed(1)} years`;
}
