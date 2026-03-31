export interface SliderInputProps {
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    formatTooltip?: (value: number) => string;
    disabled?: boolean;
}
export declare function SliderInput({ value, onChange, min, max, step, formatTooltip, disabled, }: SliderInputProps): import("preact").JSX.Element;
