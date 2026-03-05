import { Clickable } from "@shared/ui/components";
import { cn } from "@shared/ui/utils/cn";

export type EditorTab = "front" | "back" | "styling";

interface EditorTabsProps {
	activeTab: EditorTab;
	onTabChange: (tab: EditorTab) => void;
}

const TABS: { id: EditorTab; label: string }[] = [
	{ id: "front", label: "Front Template" },
	{ id: "back", label: "Back Template" },
	{ id: "styling", label: "Styling" },
];

export function EditorTabs({ activeTab, onTabChange }: EditorTabsProps) {
	return (
		<div class="ep:flex ep:gap-1 ep:pt-3" role="tablist">
			{TABS.map(({ id, label }) => (
				<Clickable
					key={id}
					role="tab"
					class={cn(
						"ep:px-3 ep:py-1.5 ep:text-ui-small ep:rounded-t-md ep:transition-colors ep:border-b-2",
						activeTab === id
							? "ep:text-obs-accent ep:border-obs-accent ep:bg-obs-accent/5"
							: "ep:text-obs-muted ep:border-transparent ep:hover:text-obs-normal ep:hover:bg-obs-hover",
					)}
					onClick={() => onTabChange(id)}
				>
					{label}
				</Clickable>
			))}
		</div>
	);
}
