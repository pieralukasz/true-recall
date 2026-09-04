import type { ComponentChildren } from "preact";

import { cn } from "@true-recall/obsidian/utils/cn";

interface StatusItem {
	label: string;
	value: ComponentChildren;
	code?: boolean;
	wide?: boolean;
	tone?: "default" | "positive" | "muted";
}

interface StatusListProps {
	items: StatusItem[];
}

export function StatusList({ items }: StatusListProps) {
	return (
		<dl class="tr-status-list">
			{items.map(({ label, value, code, wide, tone = "default" }) => (
				<div
					key={label}
					class={cn("tr-status-list__row", wide && "tr-status-list__row--wide")}
				>
					<dt class="tr-status-list__label">{label}</dt>
					<dd class={cn("tr-status-list__value", `is-${tone}`)}>
						{code ? <code>{value}</code> : value}
					</dd>
				</div>
			))}
		</dl>
	);
}
