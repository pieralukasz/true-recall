export interface TextAreaInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    class?: string;
    disabled?: boolean;
    ariaLabel?: string;
    onKeyDown?: (event: KeyboardEvent) => void;
    onFocus?: () => void;
    onBlur?: () => void;
}
export declare function TextAreaInput({ value, onChange, placeholder, rows, class: cls, disabled, ariaLabel, onKeyDown, onFocus, onBlur, }: TextAreaInputProps): import("preact").JSX.Element;
