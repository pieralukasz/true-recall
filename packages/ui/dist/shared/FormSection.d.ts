import type { ComponentChildren } from "preact";
export interface FormSectionProps {
    title: string;
    description?: string;
    children?: ComponentChildren;
}
export declare function FormSection({ title, description, children, }: FormSectionProps): import("preact").JSX.Element;
