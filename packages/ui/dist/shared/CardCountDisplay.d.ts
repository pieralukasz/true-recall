export interface CardCountDisplayProps {
    newCount: number;
    learningCount: number;
    dueCount: number;
    totalCount?: number;
    variant?: "full" | "compact";
    size?: "smaller" | "small";
    bold?: boolean;
}
export declare function CardCountDisplay({ newCount, learningCount, dueCount, totalCount, variant, size, bold, }: CardCountDisplayProps): import("preact").JSX.Element;
