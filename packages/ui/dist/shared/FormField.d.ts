import type { ComponentChildren } from "preact";
export interface FormFieldProps {
    name: string;
    description?: string | ComponentChildren;
    children?: ComponentChildren;
    class?: string;
}
export declare function FormField({ name, description, children, class: cls, }: FormFieldProps): import("preact").JSX.Element;
