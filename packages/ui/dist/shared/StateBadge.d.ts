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
export declare function getCardStateType(props: StateBadgeProps): CardStateType;
export declare function getStateConfig(stateType: CardStateType): StateConfig;
export declare function StateBadge(props: StateBadgeProps): import("preact").JSX.Element;
export {};
