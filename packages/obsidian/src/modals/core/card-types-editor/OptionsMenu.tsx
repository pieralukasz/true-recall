import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/ui/utils/cn";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

interface OptionsMenuProps {
	onAdd: () => void;
	onRemove: () => void;
	onRename: (newName: string) => void;
	currentName: string;
	canRemove: boolean;
}

export function OptionsMenu({
	onAdd,
	onRemove,
	onRename,
	currentName,
	canRemove,
}: OptionsMenuProps) {
	const [open, setOpen] = useState(false);
	const [renaming, setRenaming] = useState(false);
	const [renameValue, setRenameValue] = useState("");
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const handleClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setOpen(false);
				setRenaming(false);
			}
		};
		document.addEventListener("click", handleClick, true);
		return () => document.removeEventListener("click", handleClick, true);
	}, [open]);

	const handleRenameStart = useCallback(() => {
		setRenameValue(currentName);
		setRenaming(true);
	}, [currentName]);

	const handleRenameCommit = useCallback(() => {
		const trimmed = renameValue.trim();
		if (trimmed && trimmed !== currentName) {
			onRename(trimmed);
		}
		setRenaming(false);
		setOpen(false);
	}, [renameValue, currentName, onRename]);

	return (
		<div ref={menuRef} class="ep:relative">
			<Clickable
				class="ep:px-3 ep:py-1.5 ep:text-ui-small ep:border ep:border-obs-border ep:rounded ep:hover:bg-obs-hover ep:transition-colors"
				onClick={() => setOpen((v) => !v)}
			>
				Options ▾
			</Clickable>

			{open && (
				<div class="ep:absolute ep:right-0 ep:top-full ep:mt-1 ep:w-52 ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:shadow-lg ep:z-50 ep:py-1">
					{renaming ? (
						<div class="ep:px-3 ep:py-2">
							<input
								type="text"
								class="ep:w-full ep:px-2 ep:py-1 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-accent ep:rounded"
								value={renameValue}
								onInput={(e) =>
									setRenameValue((e.target as HTMLInputElement).value)
								}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleRenameCommit();
									if (e.key === "Escape") {
										setRenaming(false);
										setOpen(false);
									}
								}}
								onBlur={handleRenameCommit}
							/>
						</div>
					) : (
						<>
							<MenuItem
								label="Add Card Type"
								onClick={() => {
									onAdd();
									setOpen(false);
								}}
							/>
							<MenuItem
								label="Remove Card Type"
								onClick={() => {
									onRemove();
									setOpen(false);
								}}
								disabled={!canRemove}
								danger
							/>
							<MenuItem label="Rename Card Type" onClick={handleRenameStart} />
						</>
					)}
				</div>
			)}
		</div>
	);
}

function MenuItem({
	label,
	onClick,
	disabled,
	danger,
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
	danger?: boolean;
}) {
	return (
		<Clickable
			class={cn(
				"ep:w-full ep:text-left ep:px-3 ep:py-1.5 ep:text-ui-small ep:transition-colors",
				disabled
					? "ep:text-obs-muted ep:cursor-not-allowed"
					: danger
						? "ep:text-obs-error ep:hover:bg-obs-hover"
						: "ep:text-obs-normal ep:hover:bg-obs-hover",
			)}
			onClick={onClick}
			disabled={disabled}
		>
			{label}
		</Clickable>
	);
}
