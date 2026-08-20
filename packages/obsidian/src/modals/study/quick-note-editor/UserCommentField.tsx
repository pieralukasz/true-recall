import type { RefObject } from "preact";

interface UserCommentFieldProps {
	value: string;
	onChange: (value: string) => void;
	inputRef: RefObject<HTMLTextAreaElement>;
}

export function UserCommentField({
	value,
	onChange,
	inputRef,
}: UserCommentFieldProps) {
	return (
		<label class="ep:block ep:border-t ep:border-obs-border ep:pt-3">
			<span class="ep:mb-1.5 ep:flex ep:items-center ep:justify-between ep:gap-3 ep:text-ui-smaller ep:font-medium ep:text-obs-normal">
				<span>My Note</span>
				<kbd class="ep:text-[10px] ep:font-normal ep:text-obs-faint">⌘ K</kbd>
			</span>
			<textarea
				ref={inputRef}
				name="card-comment"
				autoComplete="off"
				value={value}
				onInput={(event) => onChange(event.currentTarget.value)}
				rows={2}
				placeholder="Add a thought, doubt, or verification request…"
				class="ep:block ep:w-full ep:resize-y ep:rounded-lg ep:border ep:border-obs-border ep:bg-obs-primary ep:px-3 ep:py-2 ep:text-ui-small ep:leading-relaxed ep:text-obs-normal ep:transition-colors ep:placeholder:text-obs-faint ep:focus:border-obs-yellow/60 ep:focus:outline-none ep:focus:ring-2 ep:focus:ring-obs-yellow/20"
			/>
		</label>
	);
}
