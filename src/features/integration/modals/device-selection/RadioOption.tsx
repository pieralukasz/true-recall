export function RadioOption({
	value,
	label,
	description,
	checked,
	onChange,
}: {
	value: string;
	label: string;
	description: string;
	checked: boolean;
	onChange: () => void;
}) {
	return (
		<button
			type="button"
			class={`ep:flex ep:items-start ep:gap-3 ep:p-3 ep:rounded-md ep:mb-2 ep:cursor-pointer ep:bg-obs-secondary ep:transition-colors ep:hover:bg-obs-modifier-hover ep:border-none ep:font-inherit ep:text-left ep:w-full ${checked ? "ep-radio-active" : ""}`}
			onClick={() => onChange()}
		>
			<input
				type="radio"
				name="device-action"
				value={value}
				checked={checked}
				class="ep:mt-0.5 ep:shrink-0"
				onChange={onChange}
				onClick={(e) => e.stopPropagation()}
			/>
			<div>
				<div class="ep:font-medium">{label}</div>
				<div class="setting-item-description ep:mt-0.5">{description}</div>
			</div>
		</button>
	);
}
