import { setIcon } from "obsidian";
import { useEffect, useRef } from "preact/hooks";

import { Clickable } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { isMobile } from "@true-recall/obsidian/utils/platform";

const ANKI_SHARED_DECKS_URL = "https://ankiweb.net/shared/decks";

function SmallIcon({ icon }: { icon: string }) {
	const ref = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		if (!ref.current) return;
		setIcon(ref.current, icon);
		const svg = ref.current.querySelector("svg");
		if (svg) {
			svg.setAttribute("width", "12");
			svg.setAttribute("height", "12");
		}
	}, [icon]);

	return <span ref={ref} class="ep:flex ep:items-center" />;
}

function BarButton({
	label,
	icon,
	onClick,
}: {
	label: string;
	icon: string;
	onClick: () => void;
}) {
	return (
		<Clickable
			class="ep:flex ep:items-center ep:gap-1.5 ep:py-1 ep:px-3 ep:rounded-md ep:text-xs ep:text-obs-muted ep:bg-obs-border/50 ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors ep:border-none ep:cursor-pointer"
			onClick={onClick}
		>
			<SmallIcon icon={icon} />
			<span>{label}</span>
		</Clickable>
	);
}

export function BottomActionBar() {
	const plugin = usePlugin();

	if (isMobile()) return null;

	return (
		<div class="ep:shrink-0 ep:bg-obs-primary">
			<div class="ep:flex ep:justify-center ep:gap-3 ep:px-4 ep:py-2">
				<BarButton
					label="Get Shared"
					icon="globe"
					onClick={() => window.open(ANKI_SHARED_DECKS_URL, "_blank")}
				/>
				<BarButton
					label="Import File"
					icon="file-down"
					onClick={() => void plugin.importAnki()}
				/>
			</div>
		</div>
	);
}
