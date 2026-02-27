import { Clickable } from "@shared/ui/components/Clickable";
import { useApp, useIcon, usePlugin } from "@shared/ui/preact";
import { cn } from "@shared/ui/utils";
import { useCallback } from "preact/hooks";

interface NavItem {
	id: string;
	label: string;
	icon: string;
	isActive?: boolean;
}

const NAV_ITEMS: NavItem[] = [
	{
		id: "dashboard",
		label: "Dashboard",
		icon: "layout-dashboard",
		isActive: true,
	},
	{ id: "add", label: "Add", icon: "plus" },
	{ id: "browse", label: "Browse", icon: "list" },
	{ id: "stats", label: "Stats", icon: "bar-chart-2" },
];

export function DashboardNavBar() {
	const plugin = usePlugin();
	const app = useApp();

	const handleClick = useCallback(
		async (id: string) => {
			switch (id) {
				case "add": {
					const { SimpleFlashcardEditorModal } = await import(
						"@shared/ui/modals/SimpleFlashcardEditorModal"
					);
					const file = app.workspace.getActiveFile();
					const modal = new SimpleFlashcardEditorModal(
						app,
						{ mode: "add", currentFilePath: file?.path ?? "" },
						plugin.EmbeddableEditor,
					);
					const result = await modal.openAndWait();
					if (!result.cancelled && result.flashcards.length > 0 && file) {
						await plugin.flashcardManager.saveFlashcardsToSql(
							file,
							result.flashcards,
						);
					}
					break;
				}
				case "browse":
					await plugin.openCardBrowser();
					break;
				case "stats":
					await plugin.openStatsView();
					break;
			}
		},
		[app, plugin],
	);

	return (
		<nav class="ep:shrink-0 ep:bg-obs-primary">
			<div class="ep:flex ep:justify-center ep:gap-1 ep:px-2 ep:py-1.5">
				{NAV_ITEMS.map((item) => (
					<NavBarItem
						key={item.id}
						item={item}
						onClick={() => void handleClick(item.id)}
					/>
				))}
			</div>
		</nav>
	);
}

function NavBarItem({ item, onClick }: { item: NavItem; onClick: () => void }) {
	const iconRef = useIcon(item.icon);

	return (
		<Clickable
			role="tab"
			aria-selected={item.isActive}
			class={cn(
				"ep:flex ep:items-center ep:gap-1.5 ep:px-3 ep:py-1.5 ep:rounded-md ep:text-sm ep:transition-colors ep:duration-150",
				item.isActive
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
