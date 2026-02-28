interface StatsCardProps {
	title?: string;
	children: preact.ComponentChildren;
}

export function StatsCard({ title, children }: StatsCardProps) {
	return (
		<div class="ep:p-4 ep:rounded-lg ep:bg-obs-secondary">
			{title && (
				<div class="ep:flex ep:items-center ep:justify-between ep:mb-3 ep:pb-2.5 ep:border-b ep:border-obs-border">
					<span class="ep:text-ui-large ep:font-semibold ep:text-obs-normal ep:tracking-tight">
						{title}
					</span>
				</div>
			)}
			{children}
		</div>
	);
}
