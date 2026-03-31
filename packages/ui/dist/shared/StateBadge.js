import { jsx as _jsx } from "preact/jsx-runtime";
import { FSRS_COLORS, MUTED_STATES } from "../helpers/fsrs-colors";
import { cn } from "../utils/cn";
import { cva } from "class-variance-authority";
import { State } from "ts-fsrs";
const STATE_CONFIGS = {
    new: { label: "New", colorCls: FSRS_COLORS.new.badgeCls },
    learning: { label: "Learning", colorCls: FSRS_COLORS.learning.badgeCls },
    review: { label: "Review", colorCls: FSRS_COLORS.review.badgeCls },
    relearning: { label: "Relearn", colorCls: FSRS_COLORS.relearning.badgeCls },
    suspended: { label: "Suspended", colorCls: FSRS_COLORS.suspended.badgeCls },
    buried: { label: "Buried", colorCls: MUTED_STATES.buried.badgeCls },
    unknown: { label: "Unknown", colorCls: MUTED_STATES.unknown.badgeCls },
};
const stateBadgeVariants = cva("ep:inline-flex ep:items-center ep:gap-1 ep:rounded-xl ep:font-semibold ep:uppercase ep:tracking-wide", {
    variants: {
        size: {
            sm: "ep:text-ui-smaller ep:py-0.5 ep:px-1.5",
            md: "ep:text-ui-smaller ep:py-1 ep:px-2",
        },
    },
    defaultVariants: { size: "md" },
});
export function getCardStateType(props) {
    const now = new Date();
    if (props.suspended)
        return "suspended";
    if (props.buriedUntil && new Date(props.buriedUntil) > now)
        return "buried";
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
export function getStateConfig(stateType) {
    return STATE_CONFIGS[stateType];
}
export function StateBadge(props) {
    const stateType = getCardStateType(props);
    const config = getStateConfig(stateType);
    return (_jsx("span", { class: cn(stateBadgeVariants({ size: props.size }), config.colorCls), children: config.label }));
}
