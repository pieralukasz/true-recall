export function StatusDot({ color, title }: { color: string; title: string }) {
	return (
		<div
			class="ep:w-2.5 ep:h-2.5 ep:rounded-full ep:shrink-0 ep-dynamic-bg"
			title={title}
			style={{ "--ep-dynamic-color": color } as Record<string, string>}
		/>
	);
}
