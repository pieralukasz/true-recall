import { FSRS_COLORS, MUTED_STATES } from "@shared/ui/helpers/fsrs-colors";
import { State } from "ts-fsrs";

export type CardStateType =
	| "new"
	| "learning"
	| "review"
	| "relearning"
	| "suspended"
	| "buried"
	| "unknown";

export interface StateBadgeProps {
	state: State;
	suspended?: boolean;
	buriedUntil?: string | null;
	size?: "sm" | "md";
}

interface StateConfig {
	label: string;
	colorCls: string;
}

const STATE_CONFIGS: Record<CardStateType, StateConfig> = {
	new: { label: "New", colorCls: FSRS_COLORS.new.badgeCls },
	learning: { label: "Learning", colorCls: FSRS_COLORS.learning.badgeCls },
	review: { label: "Review", colorCls: FSRS_COLORS.review.badgeCls },
	relearning: { label: "Relearn", colorCls: FSRS_COLORS.relearning.badgeCls },
	suspended: { label: "Suspended", colorCls: FSRS_COLORS.suspended.badgeCls },
	buried: { label: "Buried", colorCls: MUTED_STATES.buried.badgeCls },
	unknown: { label: "Unknown", colorCls: MUTED_STATES.unknown.badgeCls },
};

export function getCardStateType(props: StateBadgeProps): CardStateType {
	const now = new Date();
	if (props.suspended) return "suspended";
	if (props.buriedUntil && new Date(props.buriedUntil) > now) return "buried";

	switch (props.state) {
		case State.New:
			return "new";
		case State.Learning:
			return "learning";
		case State.Review:
			return "review";
		case State.Relearning:
			return "relearning";
		default:
			return "unknown";
	}
}

export function getStateConfig(stateType: CardStateType): StateConfig {
	return STATE_CONFIGS[stateType];
}

export function StateBadge(props: StateBadgeProps) {
	const stateType = getCardStateType(props);
	const config = getStateConfig(stateType);
	const sizeCls = "ep:text-ui-smaller ep:py-1 ep:px-2";

	return (
		<span
			class={`ep:inline-flex ep:items-center ep:gap-1 ep:rounded-xl ep:font-semibold ep:uppercase ep:tracking-wide ${sizeCls} ${config.colorCls}`}
		>
			{config.label}
		</span>
	);
}
