import type { ComponentChildren } from "preact";

interface ChartCardProps {
	title: string;
	subtitle?: string;
	/** Optional control rendered at the top-right of the header (e.g. a range picker). */
	action?: ComponentChildren;
	children: ComponentChildren;
}

export function ChartCard({
	title,
	subtitle,
	action,
	children,
}: ChartCardProps) {
	return (
		<div class="ep:rounded-lg ep:border ep:border-obs-modifier-border ep:bg-obs-primary ep:p-4">
			<div class="ep:mb-3 ep:flex ep:items-start ep:justify-between ep:gap-3">
				<div>
					<h3 class="ep:text-sm ep:font-semibold ep:text-obs-normal">
						{title}
					</h3>
					{subtitle && (
						<p class="ep:text-xs ep:text-obs-muted ep:mt-0.5">{subtitle}</p>
					)}
				</div>
				{action}
			</div>
			{children}
		</div>
	);
}
