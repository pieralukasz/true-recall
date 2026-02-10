/**
 * State Badge Component
 * Displays FSRS card state with colored badge styling
 */
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
	/** FSRS state value */
	state: State;
	/** Whether the card is suspended */
	suspended?: boolean;
	/** ISO date string when the card is buried until */
	buriedUntil?: string | null;
	/** Size variant */
	size?: "sm" | "md";
}

interface StateConfig {
	label: string;
	colorCls: string;
}

const STATE_CONFIGS: Record<CardStateType, StateConfig> = {
	new: {
		label: "New",
		colorCls: "ep-bg-obs-blue-15 ep:text-obs-blue",
	},
	learning: {
		label: "Learning",
		colorCls: "ep-bg-obs-orange-15 ep:text-obs-orange",
	},
	review: {
		label: "Review",
		colorCls: "ep-bg-obs-green-15 ep:text-obs-green",
	},
	relearning: {
		label: "Relearn",
		colorCls: "ep-bg-obs-yellow-15 ep:text-obs-yellow",
	},
	suspended: {
		label: "Suspended",
		colorCls: "ep-bg-obs-red-15 ep:text-obs-error",
	},
	buried: {
		label: "Buried",
		colorCls: "ep:bg-obs-modifier-hover ep:text-obs-muted",
	},
	unknown: {
		label: "Unknown",
		colorCls: "ep:bg-obs-modifier-hover ep:text-obs-muted",
	},
};

/**
 * Determine the effective state type from FSRS state and card status
 */
export function getCardStateType(props: StateBadgeProps): CardStateType {
	const now = new Date();

	if (props.suspended) {
		return "suspended";
	}

	if (props.buriedUntil && new Date(props.buriedUntil) > now) {
		return "buried";
	}

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

/**
 * Get the configuration for a card state
 */
export function getStateConfig(stateType: CardStateType): StateConfig {
	return STATE_CONFIGS[stateType];
}

/**
 * Render a state badge into a container
 */
export function renderStateBadge(
	container: HTMLElement,
	props: StateBadgeProps
): HTMLSpanElement {
	const stateType = getCardStateType(props);
	const config = getStateConfig(stateType);

	const sizeCls =
		props.size === "sm"
			? "ep:text-ui-smaller ep:py-1 ep:px-2"
			: "ep:text-ui-smaller ep:py-1 ep:px-2";

	const baseCls = `ep:inline-flex ep:items-center ep:gap-1 ep:rounded-xl ep:font-semibold ep:uppercase ep:tracking-wide ${sizeCls}`;

	const badge = container.createSpan({
		text: config.label,
		cls: `${baseCls} ${config.colorCls}`,
	});

	return badge;
}

/**
 * Create a standalone state badge element
 */
export function createStateBadge(props: StateBadgeProps): HTMLSpanElement {
	const container = document.createElement("span");
	return renderStateBadge(container, props);
}
