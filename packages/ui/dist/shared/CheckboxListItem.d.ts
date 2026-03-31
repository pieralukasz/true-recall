export interface CheckboxListItemProps {
    label: string;
    itemKey: string;
    selectedSet: Set<string>;
    onToggle: (key: string, checked: boolean) => void;
}
export declare function CheckboxListItem({ label, itemKey, selectedSet, onToggle, }: CheckboxListItemProps): import("preact").JSX.Element;
