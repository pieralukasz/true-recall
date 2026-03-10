import { QuickNoteEditorModal } from "@features/study/modals/quick-note-editor/QuickNoteEditorModal";
import { Clickable } from "@shared/ui/components/Clickable";
import { useApp, useIcon, usePlugin } from "@shared/ui/preact";
import { cn } from "@shared/ui/utils";
import { useCallback } from "preact/hooks";

type NavItemId = "dashboard" | "add" | "stats" | "browse";

interface NavItem {
	id: NavItemId;
	label: string;
	icon: string;
}

const NAV_ITEMS: NavItem[] = [
	{ id: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
	{ id: "add", label: "Add", icon: "plus" },
	{ id: "stats", label: "Stats", icon: "bar-chart-3" },
	{ id: "browse", label: "Browse", icon: "list" },
];

export interface AppNavBarProps {
	activeItem: NavItemId;
}

export function AppNavBar({ activeItem }: AppNavBarProps) {
	const plugin = usePlugin();
	const app = useApp();

	const handleClick = useCallback(
		async (id: NavItemId) => {
			if (id === activeItem) return;
			switch (id) {
				case "dashboard":
					await plugin.openDashboard();
					break;
				case "add": {
					const modal = new QuickNoteEditorModal(app, plugin, { mode: "add" });
					await modal.openAndWait();
					break;
				}
				case "stats":
					await plugin.openStats();
					break;
				case "browse":
					await plugin.openCardBrowser();
					break;
			}
		},
		[app, plugin, activeItem],
	);

	return (
		<nav class="ep:shrink-0 ep:bg-obs-primary">
			<div class="ep:flex ep:justify-center ep:gap-1 ep:px-2 ep:py-1.5">
				{NAV_ITEMS.map((item) => (
					<NavBarItem
						key={item.id}
						item={item}
						isActive={item.id === activeItem}
						onClick={() => void handleClick(item.id)}
					/>
				))}
			</div>
		</nav>
	);
}

function NavBarItem({
	item,
	isActive,
	onClick,
}: {
	item: NavItem;
	isActive: boolean;
	onClick: () => void;
}) {
	const iconRef = useIcon(item.icon);

	return (
		<Clickable
			role="tab"
			aria-selected={isActive}
			class={cn(
				"ep:flex ep:items-center ep:gap-1.5 ep:px-3 ep:py-1.5 ep:rounded-md ep:text-sm ep:transition-colors ep:duration-150",
				isActive
					? "ep:bg-obs-interactive/15 ep:text-obs-interactive ep:font-semibold"
					: "ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-hover",
			)}
			onClick={onClick}
		>
			<span ref={iconRef} class="[&_svg]:ep:w-4 [&_svg]:ep:h-4" />
			<span>{item.label}</span>
		</Clickable>
	);
}
