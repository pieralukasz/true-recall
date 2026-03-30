import type { ComponentChildren } from "preact";
export interface FormCardProps {
    title?: string;
    description?: string;
    children: ComponentChildren;
    class?: string;
}
export declare function FormCard({ title, description, children, class: cls, }: FormCardProps): import("preact").JSX.Element;
