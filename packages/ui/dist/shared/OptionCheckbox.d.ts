export interface OptionCheckboxProps {
    label: string;
    description: string;
    checked: boolean;
    onChange: (val: boolean) => void;
}
export declare function OptionCheckbox({ label, description, checked, onChange, }: OptionCheckboxProps): import("preact").JSX.Element;
