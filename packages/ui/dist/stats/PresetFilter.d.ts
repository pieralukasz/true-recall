import type { Signal } from "@preact/signals";
interface PresetFilterProps {
    presets: string[];
    selected: Signal<Set<string>>;
}
export declare function PresetFilter({ presets, selected }: PresetFilterProps): import("preact").JSX.Element | null;
export {};
