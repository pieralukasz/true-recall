export function SummaryList({ items }: { items: string[] }) {
	if (items.length === 0) return null;
	return (
		<div class="ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border ep:flex ep:flex-col ep:gap-1.5">
			{items.map((item, i) => (
				<div
					key={i}
					class="ep:text-ui-small ep:text-obs-muted ep:flex ep:items-center ep:gap-2"
				>
					<div class="ep:w-1.5 ep:h-1.5 ep:rounded-full ep:bg-obs-interactive ep:shrink-0" />
					<span>{item}</span>
				</div>
			))}
		</div>
	);
}
