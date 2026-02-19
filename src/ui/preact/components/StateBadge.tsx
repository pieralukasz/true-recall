import { State } from "ts-fsrs";

export type CardStateType = "new" | "learning" | "review" | "relearning" | "suspended" | "buried" | "unknown";

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
	new: { label: "New", colorCls: "ep:bg-obs-green/15 ep:text-obs-green" },
	learning: { label: "Learning", colorCls: "ep:bg-obs-orange/15 ep:text-obs-orange" },
	review: { label: "Review", colorCls: "ep:bg-obs-blue/15 ep:text-obs-blue" },
	relearning: { label: "Relearn", colorCls: "ep:bg-obs-yellow/15 ep:text-obs-yellow" },
	suspended: { label: "Suspended", colorCls: "ep:bg-obs-red/15 ep:text-obs-error" },
	buried: { label: "Buried", colorCls: "ep:bg-obs-modifier-hover ep:text-obs-muted" },
	unknown: { label: "Unknown", colorCls: "ep:bg-obs-modifier-hover ep:text-obs-muted" },
};

export function getCardStateType(props: StateBadgeProps): CardStateType {
	const now = new Date();
	if (props.suspended) return "suspended";
	if (props.buriedUntil && new Date(props.buriedUntil) > now) return "buried";

	switch (props.state) {
		case State.New: return "new";
		case State.Learning: return "learning";
		case State.Review: return "review";
		case State.Relearning: return "relearning";
		default: return "unknown";
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
		<span class={`ep:inline-flex ep:items-center ep:gap-1 ep:rounded-xl ep:font-semibold ep:uppercase ep:tracking-wide ${sizeCls} ${config.colorCls}`}>
			{config.label}
		</span>
	);
}
