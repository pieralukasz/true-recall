import type { ComponentChildren } from "preact";
export interface ErrorBoundaryProps {
    children: ComponentChildren;
    fallbackMessage?: string;
}
export declare function ErrorBoundary({ children, fallbackMessage, }: ErrorBoundaryProps): import("preact").JSX.Element;
