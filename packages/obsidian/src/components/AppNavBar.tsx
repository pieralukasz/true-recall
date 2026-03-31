import { Clickable } from "@true-recall/obsidian/components";
import { QuickNoteEditorModal } from "@true-recall/obsidian/modals/study/quick-note-editor/QuickNoteEditorModal";
import { useApp, useIcon, usePlugin } from "@true-recall/obsidian/preact";
import { cn } from "@true-recall/obsidian/utils";
import { useCallback, useState } from "preact/hooks";

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
	collapsible?: boolean;
}

export function AppNavBar({ activeItem, collapsible = false }: AppNavBarProps) {
	const plugin = usePlugin();
	const app = useApp();
	const [collapsed, setCollapsed] = useState(false);
	const chevronRef = useIcon(collapsed ? "chevron-down" : "chevron-up");

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
		<nav class="ep:shrink-0 ep:mt-2 ep:bg-obs-primary">
			<div
				class={cn(
					"ep:grid ep:transition-[grid-template-rows] ep:duration-300 ep:ease-in-out",
					collapsed ? "ep:grid-rows-[0fr]" : "ep:grid-rows-[1fr]",
				)}
			>
				<div class="ep:overflow-hidden ep:min-h-0">
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
				</div>
			</div>

			{collapsible && (
				<Clickable
					class={cn(
						"ep:flex ep:items-center ep:justify-center ep:w-full ep:py-0.5",
						"ep:text-obs-faint ep:hover:text-obs-muted ep:transition-colors ep:duration-150",
						"ep:cursor-pointer",
					)}
					onClick={() => setCollapsed((v) => !v)}
					aria-label={collapsed ? "Show navigation" : "Hide navigation"}
				>
					<span
						ref={chevronRef}
						class={cn(
							"[&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5",
							"ep:transition-transform ep:duration-300",
						)}
					/>
				</Clickable>
			)}
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
