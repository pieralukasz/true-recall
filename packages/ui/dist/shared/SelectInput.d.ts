export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}
export interface SelectOptionGroup {
    label: string;
    options: SelectOption[];
}
export type SelectInputOption = SelectOption | SelectOptionGroup;
export interface SelectInputProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectInputOption[];
    disabled?: boolean;
    class?: string;
    ariaLabel?: string;
}
export declare function SelectInput({ value, onChange, options, disabled, class: cls, ariaLabel, }: SelectInputProps): import("preact").JSX.Element;
