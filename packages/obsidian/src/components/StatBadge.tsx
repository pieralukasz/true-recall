import type { ComponentChildren } from "preact";

import { cn } from "@true-recall/obsidian/utils/cn";

export interface StatBadgeProps {
	label: string;
	count: number;
	colorCls?: string;
}

export function StatBadge({ label, count, colorCls }: StatBadgeProps) {
	return (
		<div
			class={cn(
				"ep:bg-surface-raised ep:rounded-md ep:p-2 ep:text-center",
				colorCls,
			)}
		>
			<div class="ep:text-lg ep:font-bold">{count}</div>
			<div class="ep:text-ui-smaller ep:text-obs-muted">{label}</div>
		</div>
	);
}

export interface StatGridProps {
	children: ComponentChildren;
	columns?: number;
}

export function StatGrid({ children, columns = 2 }: StatGridProps) {
	return (
		<div
			class="ep:grid ep:gap-2"
			style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
		>
			{children}
		</div>
	);
}
