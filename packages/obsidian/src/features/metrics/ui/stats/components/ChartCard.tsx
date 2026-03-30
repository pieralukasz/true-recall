import type { ComponentChildren } from "preact";

interface ChartCardProps {
	title: string;
	subtitle?: string;
	children: ComponentChildren;
}

export function ChartCard({ title, subtitle, children }: ChartCardProps) {
	return (
		<div class="ep:rounded-lg ep:border ep:border-obs-modifier-border ep:bg-obs-primary ep:p-4">
			<div class="ep:mb-3">
				<h3 class="ep:text-sm ep:font-semibold ep:text-obs-normal">{title}</h3>
				{subtitle && (
					<p class="ep:text-xs ep:text-obs-muted ep:mt-0.5">{subtitle}</p>
				)}
			</div>
			{children}
		</div>
	);
}
