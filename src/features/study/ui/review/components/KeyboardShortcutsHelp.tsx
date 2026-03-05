import { Clickable } from "@shared/ui/components";
import { useEffect, useRef, useState } from "preact/hooks";
import { KeyboardHandler } from "../handlers/KeyboardHandler";

export function KeyboardShortcutsHelp() {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen) return;

		const handlePointerDown = (e: PointerEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setIsOpen(false);
		};

		document.addEventListener("pointerdown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen]);

	const shortcuts = KeyboardHandler.getShortcutsHelp();

	return (
		<div ref={containerRef} class="ep:relative">
			<Clickable
				class="ep:flex ep:items-center ep:justify-center ep:w-5 ep:h-5 ep:rounded ep:text-obs-faint ep:hover:text-obs-muted ep:hover:bg-obs-modifier-hover ep:transition-colors ep:text-ui-small ep:font-medium"
				onClick={() => setIsOpen((v) => !v)}
				aria-expanded={isOpen}
				aria-label="Keyboard shortcuts"
				title="Keyboard shortcuts"
			>
				?
			</Clickable>

			{isOpen && (
				<div class="ep:absolute ep:bottom-full ep:left-0 ep:mb-2 ep:z-50 ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:shadow-lg ep:py-2 ep:px-3 ep:w-[340px] ep:max-w-[92vw]">
					<div class="ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:mb-2 ep:pb-1 ep:border-b ep:border-obs-border">
						Keyboard shortcuts
					</div>
					<ul class="ep:space-y-1">
						{shortcuts.map(({ key, description }) => (
							<li key={key} class="ep:flex ep:items-center ep:justify-between ep:gap-6 ep:text-ui-small">
								<kbd class="ep:px-1.5 ep:py-0.5 ep:rounded ep:bg-obs-secondary ep:border ep:border-obs-border ep:text-obs-muted ep:font-mono ep:text-ui-smaller">
									{key}
								</kbd>
								<span class="ep:text-obs-muted">{description}</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
