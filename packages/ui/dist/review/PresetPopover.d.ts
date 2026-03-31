export interface PresetPickerOption {
    value: string;
    label: string;
    retention: number;
}
export interface PresetPopoverProps {
    value: string;
    options: PresetPickerOption[];
    onChange: (presetName: string) => void;
}
export declare function PresetPopover({ value, options, onChange, }: PresetPopoverProps): import("preact").JSX.Element;
