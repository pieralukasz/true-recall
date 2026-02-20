interface SearchBarProps {
	query: string;
	onChange: (q: string) => void;
}

export function SearchBar({ query, onChange }: SearchBarProps) {
	return (
		<div class="true-recall-search-container ep:mb-2">
			<input
				type="text"
				class="ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted"
				placeholder="Search notes..."
				aria-label="Search notes"
				value={query}
				onInput={(e) =>
					onChange((e.target as HTMLInputElement).value.toLowerCase())
				}
			/>
		</div>
	);
}
