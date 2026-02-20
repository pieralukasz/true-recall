import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { useIcon } from "@shared/ui/preact/hooks";

export interface CollapsibleSectionProps {
	title: string;
	icon?: string;
	defaultExpanded?: boolean;
	description?: string;
	showTopBorder?: boolean;
	class?: string;
	onToggle?: (isExpanded: boolean) => void;
	children: ComponentChildren;
}

export function CollapsibleSection({
	title,
	icon,
	defaultExpanded = false,
	description,
	showTopBorder,
	class: cls,
	onToggle,
	children,
}: CollapsibleSectionProps) {
	const [expanded, setExpanded] = useState(defaultExpanded);
	const chevronRef = useIcon(expanded ? "chevron-down" : "chevron-right");
	const leadingIconRef = useIcon(icon ?? "");

	const toggle = () => {
		const next = !expanded;
		setExpanded(next);
		onToggle?.(next);
	};

	const containerCls = [
		showTopBorder ? "ep:pt-3 ep:border-t ep:border-obs-border" : "",
		cls ?? "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div class={containerCls || undefined}>
			<button
				type="button"
				class="ep:flex ep:items-center ep:gap-2 ep:cursor-pointer ep:text-obs-muted ep:hover:text-obs-normal ep:transition-colors ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:text-left ep:w-full"
				aria-expanded={expanded}
				onClick={toggle}
			>
				<span class="ep:w-4 ep:h-4 ep:transition-transform" ref={chevronRef} />
				{leadingIconRef && <span class="ep:w-4 ep:h-4" ref={leadingIconRef} />}
				<span class="ep:text-ui-smaller ep:font-medium">{title}</span>
				{description && (
					<span class="ep:text-ui-smaller ep:opacity-70">({description})</span>
				)}
			</button>
			{expanded && <div class="ep:mt-2">{children}</div>}
		</div>
	);
}
