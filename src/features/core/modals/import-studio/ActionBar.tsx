import { Clickable } from "@shared/ui/components/Clickable";
import { NotePickerCombobox } from "@shared/ui/components/NotePickerCombobox";
import { useIcon } from "@shared/ui/preact/hooks";
import type { App, TFile } from "obsidian";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

interface ImportStudioActionBarProps {
	app: App;
	selectedSourceNote: TFile | null;
	onSourceSelect: (file: TFile | null) => void;
}

export function ActionBar({
	app,
	selectedSourceNote,
	onSourceSelect,
}: ImportStudioActionBarProps) {
	const [showHelp, setShowHelp] = useState(false);
	const helpIconRef = useIcon("help-circle");

	return (
		<div class="ep:flex ep:items-center ep:gap-2">
			<div class="ep:flex-1 ep:flex ep:items-center ep:gap-1">
				<div class="ep:flex-1">
					<NotePickerCombobox
						app={app}
						selectedNote={selectedSourceNote}
						onSelect={onSourceSelect}
					/>
				</div>
				{selectedSourceNote && (
					<Clickable
						class="ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal"
						onClick={() => onSourceSelect(null)}
					>
						Clear
					</Clickable>
				)}
			</div>
			<div class="ep:relative">
				<div
					ref={helpIconRef}
					role="button"
					tabIndex={0}
					class="ep:text-obs-faint ep:hover:text-obs-muted ep:cursor-pointer [&>svg]:ep:w-4 [&>svg]:ep:h-4"
					onClick={() => setShowHelp((v) => !v)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							setShowHelp((v) => !v);
						}
					}}
				/>
				{showHelp && <HelpPopover onClose={() => setShowHelp(false)} />}
			</div>
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
			class="ep:absolute ep:right-0 ep:top-8 ep:z-50 ep:w-[340px] ep:p-4 ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-lg ep:shadow-lg ep:text-ui-smaller"
		>
			<div class="ep:font-semibold ep:mb-2">Supported Formats</div>
			<div class="ep:space-y-3 ep:text-obs-muted">
				<div>
					<div class="ep:font-medium ep:text-obs-normal">
						Block format (recommended)
					</div>
					<pre class="ep:mt-1 ep:px-2 ep:py-1.5 ep:bg-obs-secondary ep:rounded ep:text-[11px] ep:leading-relaxed ep:whitespace-pre-wrap">
						{`#type/basic\nFront: Question\nBack: Answer\n---`}
					</pre>
				</div>
				<div>
					<div class="ep:font-medium ep:text-obs-normal">Double colon</div>
					<pre class="ep:mt-1 ep:px-2 ep:py-1.5 ep:bg-obs-secondary ep:rounded ep:text-[11px] ep:leading-relaxed">
						{`Question :: Answer`}
					</pre>
				</div>
				<div>
					<div class="ep:font-medium ep:text-obs-normal">Tab-separated</div>
					<pre class="ep:mt-1 ep:px-2 ep:py-1.5 ep:bg-obs-secondary ep:rounded ep:text-[11px] ep:leading-relaxed">
						{`Question\tAnswer`}
					</pre>
					<div class="ep:mt-1 ep:text-obs-faint">
						Requires note type selection in footer
					</div>
				</div>
			</div>
		</div>
	);
}
