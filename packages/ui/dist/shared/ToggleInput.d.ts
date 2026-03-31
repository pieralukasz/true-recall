export interface ToggleInputProps {
    value: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    ariaLabel?: string;
}
export declare function ToggleInput({ value, onChange, disabled, ariaLabel, }: ToggleInputProps): import("preact").JSX.Element;
