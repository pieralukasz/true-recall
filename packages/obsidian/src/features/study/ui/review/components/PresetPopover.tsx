import { Clickable } from "@shared/ui/components";
import { cn } from "@shared/ui/utils/cn";
import { useEffect, useRef, useState } from "preact/hooks";

export interface PresetPickerOption {
	value: string;
	label: string;
	retention: number; // 0.0–1.0
}

export interface PresetPopoverProps {
	value: string;
	options: PresetPickerOption[];
	onChange: (presetName: string) => void;
}

export function PresetPopover({
	value,
	options,
	onChange,
}: PresetPopoverProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen) return;

		const handlePointerDown = (e: PointerEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
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

	return (
		<div ref={containerRef} class="ep:relative">
			<Clickable
				class="ep:flex ep:items-center ep:gap-1 ep:text-obs-faint ep:text-ui-smaller ep:hover:text-obs-muted ep:transition-colors"
				onClick={() => setIsOpen((v) => !v)}
				aria-expanded={isOpen}
				aria-haspopup="listbox"
			>
				<span>FSRS: {value}</span>
				<svg
					aria-hidden="true"
					class={cn(
						"ep:w-3 ep:h-3 ep:transition-transform ep:duration-150",
						isOpen && "ep:rotate-180",
					)}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="6 9 12 15 18 9" />
				</svg>
			</Clickable>

			{isOpen && (
				<ul
					aria-label="FSRS preset"
					class="ep:absolute ep:bottom-full ep:left-1/2 ep:-translate-x-1/2 ep:mb-2 ep:z-50 ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:shadow-lg ep:py-1 ep:min-w-[160px]"
				>
					{options.map((option) => {
						const isActive = option.value === value;
						return (
							<li key={option.value}>
								<Clickable
									class={cn(
										"ep:flex ep:items-center ep:justify-between ep:gap-3 ep:px-3 ep:py-1.5 ep:w-full ep:text-ui-small ep:hover:bg-obs-modifier-hover ep:transition-colors ep:rounded-none",
										isActive ? "ep:text-obs-normal" : "ep:text-obs-muted",
									)}
									onClick={() => {
										onChange(option.value);
										setIsOpen(false);
									}}
								>
									<span class="ep:flex ep:items-center ep:gap-2">
										<span class="ep:w-3 ep:flex-shrink-0">
											{isActive && (
												<svg
													aria-hidden="true"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2.5"
													stroke-linecap="round"
													stroke-linejoin="round"
													class="ep:w-3 ep:h-3 ep:text-obs-accent"
												>
													<polyline points="20 6 9 17 4 12" />
												</svg>
											)}
										</span>
										<span>{option.label}</span>
									</span>
									<span class="ep:text-obs-faint ep:text-[11px] ep:tabular-nums ep:flex-shrink-0">
										{Math.round(option.retention * 100)}%
									</span>
								</Clickable>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
