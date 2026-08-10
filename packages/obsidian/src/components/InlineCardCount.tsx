interface InlineCardCountProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	ariaLabel: string;
}

/**
 * Suspend the row's HTML5 drag while the pointer is inside the field.
 *
 * `dragstart` fires on the nearest draggable ancestor, not on the input, so
 * stopping propagation from here would never see the event. The row has to be
 * made undraggable for the duration of the interaction instead.
 */
function suspendAncestorDrag(target: HTMLElement): void {
	const row = target.closest<HTMLElement>('[draggable="true"]');
	if (!row) return;

	row.draggable = false;
	const restore = () => {
		row.draggable = true;
		document.removeEventListener("mouseup", restore);
		document.removeEventListener("dragend", restore);
	};
	document.addEventListener("mouseup", restore);
	document.addEventListener("dragend", restore);
}

/**
 * Inline session-size field for dashboard rows.
 *
 * The number is the user's statement of intent, so it sits in the row next to
 * the play button rather than behind a modal — R-Mode never computes how much
 * work is owed.
 */
export function InlineCardCount({
	value,
	onChange,
	onSubmit,
	ariaLabel,
}: InlineCardCountProps) {
	return (
		<input
			type="number"
			min={1}
			value={value}
			aria-label={ariaLabel}
			title={ariaLabel}
			draggable={false}
			class="ep:w-11 ep:shrink-0 ep:rounded-md ep:border ep:border-solid ep:border-obs-border ep:bg-obs-primary ep:px-1 ep:py-0.5 ep:text-center ep:text-ui-smaller ep:font-medium ep:tabular-nums"
			// Obsidian styles `input[type=number]` directly, which outranks a
			// single-class utility — the colour has to come from an inline style.
			style={{ color: "var(--color-blue)" }}
			onMouseDown={(event) => {
				event.stopPropagation();
				suspendAncestorDrag(event.currentTarget);
			}}
			onClick={(event) => event.stopPropagation()}
			onDragStart={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
			onInput={(event) => onChange((event.target as HTMLInputElement).value)}
			onKeyDown={(event) => {
				event.stopPropagation();
				if (event.key === "Enter") onSubmit();
			}}
		/>
	);
}
