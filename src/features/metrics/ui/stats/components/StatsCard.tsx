interface StatsCardProps {
	title?: string;
	hoverLift?: boolean;
	children: preact.ComponentChildren;
}

export function StatsCard({ title, hoverLift = true, children }: StatsCardProps) {
	return (
		<div
			class={[
				"ep:mb-5 ep:p-5 ep:rounded-lg ep:bg-obs-secondary ep:transition-all ep:duration-200",
				hoverLift ? "ep:hover:-translate-y-px" : "",
			].join(" ")}
		>
			{title && (
				<div class="ep:flex ep:items-center ep:justify-between ep:mb-4 ep:pb-3 ep:border-b ep:border-obs-border">
					<span class="ep:text-ui-large ep:font-semibold ep:text-obs-normal ep:tracking-tight">
						{title}
					</span>
				</div>
			)}
			{children}
		</div>
	);
}
