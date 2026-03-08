import { CopyPromptButton } from "@features/core/modals/add-flashcards/CopyPromptButton";
import { Clickable } from "@shared/ui/components/Clickable";
import { useIcon } from "@shared/ui/preact/hooks";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

interface FooterBarProps {
	sessionCount: number;
	cardCount: number;
	detectedFormat: string;
	saving: boolean;
	onSave: () => void;
}

export function FooterBar({
	sessionCount,
	cardCount,
	detectedFormat,
	saving,
	onSave,
}: FooterBarProps) {
	const [showHelp, setShowHelp] = useState(false);
	const helpIconRef = useIcon("help-circle");

	return (
		<div class="ep-modal-footer ep:flex ep:items-center ep:gap-2">
			<div class="ep:flex ep:items-center ep:gap-1.5">
				<CopyPromptButton />
				<div class="ep:relative">
					<div
						ref={helpIconRef}
						role="button"
						tabIndex={0}
						class="ep:text-obs-faint ep:hover:text-obs-muted ep:cursor-pointer [&>svg]:ep:w-3.5 [&>svg]:ep:h-3.5"
						onClick={() => setShowHelp((v) => !v)}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								setShowHelp((v) => !v);
							}
						}}
					/>
					{showHelp && (
						<HelpPopover onClose={() => setShowHelp(false)} />
					)}
				</div>
			</div>

			<div class="ep:flex-1 ep:text-ui-smaller ep:text-obs-muted ep:text-center">
				{cardCount > 0
					? `Format: ${detectedFormat} · ${cardCount} card${cardCount !== 1 ? "s" : ""}`
					: sessionCount > 0
						? `${sessionCount} card${sessionCount !== 1 ? "s" : ""} saved this session`
						: null}
			</div>

			<Clickable
				class="mod-cta ep-btn"
				onClick={onSave}
				disabled={cardCount === 0 || saving}
				stopPropagation={false}
			>
				{saving
					? "Saving..."
					: `Save ${cardCount > 0 ? `${cardCount} ` : ""}Card${
							cardCount !== 1 ? "s" : ""
						}`}
			</Clickable>
		</div>
	);
}

function HelpPopover({ onClose }: { onClose: () => void }) {
	const ref = useRef<HTMLDivElement>(null);

	const handleOutsideClick = useCallback(
		(e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) onClose();
		},
		[onClose],
	);

	useEffect(() => {
		document.addEventListener("mousedown", handleOutsideClick);
		return () => document.removeEventListener("mousedown", handleOutsideClick);
	}, [handleOutsideClick]);

	return (
		<div
			ref={ref}
			class="ep:absolute ep:left-0 ep:bottom-8 ep:z-50 ep:w-[300px] ep:p-3 ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-lg ep:shadow-lg ep:text-ui-smaller"
		>
			<div class="ep:font-semibold ep:mb-2">
				How to generate flashcards
			</div>
			<ol class="ep:space-y-1.5 ep:text-obs-muted ep:list-decimal ep:pl-4">
				<li>
					Click <span class="ep:text-obs-normal">Copy Prompt</span> to
					copy the AI prompt
				</li>
				<li>
					Paste the prompt into ChatGPT, Claude, or any AI chat
				</li>
				<li>Add your note text after the prompt and send</li>
				<li>Copy the AI response and paste it into the editor above</li>
			</ol>
			<div class="ep:mt-2.5 ep:text-obs-faint">
				<div class="ep:font-medium ep:text-obs-muted ep:mb-1">
					Expected format
				</div>
				<pre class="ep:px-2 ep:py-1.5 ep:bg-obs-secondary ep:rounded ep:text-[11px] ep:leading-relaxed ep:whitespace-pre-wrap">
					{`#type/basic\nFront: Question\nBack: Answer\n---`}
				</pre>
			</div>
		</div>
	);
}
