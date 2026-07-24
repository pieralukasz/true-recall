import {
	autoUpdate,
	computePosition,
	flip,
	offset,
	shift,
} from "@floating-ui/dom";
import { h, render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import type { CardAIPreset } from "@true-recall/core";

import { Clickable } from "@true-recall/obsidian/components";
import { AiComposer } from "@true-recall/obsidian/features/assistant/ui/AiComposer";
import { useIcon } from "@true-recall/obsidian/preact/hooks";

const DESCRIPTION_LIMIT = 88;

export function cardPolishPresetIcon(preset: CardAIPreset): string {
	const name = `${preset.id} ${preset.name}`.toLowerCase();
	if (name.includes("markdown")) return "file-text";
	if (name.includes("condense")) return "minimize-2";
	if (name.includes("backlink")) return "unlink";
	if (name.includes("answer")) return "message-circle";
	if (name.includes("split")) return "list";
	if (name.includes("ambigu")) return "search";
	if (name.includes("rewrite")) return "refresh-cw";
	if (name.includes("why")) return "circle-help";
	if (name.includes("reverse")) return "arrow-left-right";
	if (name.includes("magic")) return "wand";
	if (name.includes("attachment")) return "paperclip";
	return "sparkles";
}

export function cardPolishPresetDescription(preset: CardAIPreset): string {
	const description = preset.prompt.replace(/\s+/g, " ").trim();
	if (!description) return "Improve this flashcard with the saved instruction.";
	if (description.length <= DESCRIPTION_LIMIT) return description;
	return `${description.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`;
}

function MenuIcon({ icon }: { icon: string }) {
	const iconRef = useIcon(icon);
	return <span ref={iconRef} class="tr-card-polish-menu__item-icon" />;
}

function CardAIPresetMenu({
	presets,
	onSelect,
	onCustom,
}: {
	presets: CardAIPreset[];
	onSelect: (preset: CardAIPreset) => void;
	onCustom: (instruction: string) => void;
}) {
	const rootRef = useRef<HTMLDivElement>(null);
	const headerIconRef = useIcon("wand");
	const [customInstruction, setCustomInstruction] = useState("");

	useEffect(() => {
		rootRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus();
	}, []);

	const moveFocus = (event: KeyboardEvent) => {
		if ((event.target as HTMLElement | null)?.matches("input, textarea"))
			return;
		if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
		const items = Array.from(
			rootRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? [],
		);
		if (items.length === 0) return;
		event.preventDefault();
		const current = items.indexOf(
			rootRef.current?.ownerDocument.activeElement as HTMLElement,
		);
		const next =
			event.key === "Home"
				? 0
				: event.key === "End"
					? items.length - 1
					: event.key === "ArrowDown"
						? (current + 1 + items.length) % items.length
						: (current - 1 + items.length) % items.length;
		items[next]?.focus();
	};

	return (
		<div
			ref={rootRef}
			class="tr-card-polish-menu"
			role="dialog"
			aria-label="Card Polish presets"
			onKeyDown={moveFocus}
		>
			<header class="tr-card-polish-menu__header">
				<span ref={headerIconRef} class="tr-card-polish-menu__header-icon" />
				<div>
					<strong>Card Polish</strong>
					<span>Choose how to improve this flashcard</span>
				</div>
			</header>

			<div class="tr-card-polish-menu__list" role="menu">
				{presets.map((preset) => (
					<Clickable
						key={preset.id}
						class="tr-card-polish-menu__item"
						role="menuitem"
						onClick={() => onSelect(preset)}
					>
						<MenuIcon icon={cardPolishPresetIcon(preset)} />
						<span class="tr-card-polish-menu__item-copy">
							<strong>{preset.name}</strong>
							<small>{cardPolishPresetDescription(preset)}</small>
						</span>
						<span class="tr-card-polish-menu__item-mode">
							{preset.autoApply ? "Apply" : "Preview"}
						</span>
					</Clickable>
				))}
			</div>

			<footer class="tr-card-polish-menu__footer">
				<label
					class="tr-card-polish-menu__custom-label"
					for="tr-card-polish-custom-input"
				>
					Custom instruction
				</label>
				<AiComposer
					class="tr-card-polish-menu__composer"
					inputId="tr-card-polish-custom-input"
					value={customInstruction}
					onChange={setCustomInstruction}
					placeholder="Describe a change…"
					onSubmit={() => {
						const instruction = customInstruction.trim();
						if (instruction) onCustom(instruction);
					}}
				/>
			</footer>
		</div>
	);
}

let disposeActiveMenu: (() => void) | null = null;

export function openCardAIPresetMenu({
	anchor,
	presets,
	onSelect,
	onCustom,
}: {
	anchor: HTMLElement;
	presets: CardAIPreset[];
	onSelect: (preset: CardAIPreset) => void;
	onCustom: (instruction: string) => void;
}): () => void {
	disposeActiveMenu?.();

	const doc = anchor.ownerDocument;
	const container = doc.createElement("div");
	container.className = "tr-card-polish-menu-host";
	container.dataset.trCardPolishMenu = "true";
	doc.body.appendChild(container);

	let disposed = false;
	let stopPositioning: (() => void) | null = null;
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		stopPositioning?.();
		doc.removeEventListener("pointerdown", handleOutsidePointer);
		doc.removeEventListener("keydown", handleEscape, true);
		render(null, container);
		container.remove();
		if (disposeActiveMenu === dispose) disposeActiveMenu = null;
	};
	const handleOutsidePointer = (event: PointerEvent) => {
		if (!container.contains(event.target as Node)) dispose();
	};
	const handleEscape = (event: KeyboardEvent) => {
		if (event.key !== "Escape") return;
		event.preventDefault();
		dispose();
		anchor.focus();
	};

	render(
		h(CardAIPresetMenu, {
			presets,
			onSelect: (preset) => {
				dispose();
				onSelect(preset);
			},
			onCustom: (instruction) => {
				dispose();
				onCustom(instruction);
			},
		}),
		container,
	);

	const updatePosition = () =>
		computePosition(anchor, container, {
			strategy: "fixed",
			placement: "top-end",
			middleware: [offset(8), flip(), shift({ padding: 8 })],
		}).then(({ x, y }) => {
			if (disposed) return;
			container.style.left = `${x}px`;
			container.style.top = `${y}px`;
		});
	stopPositioning = autoUpdate(anchor, container, updatePosition);

	doc.addEventListener("pointerdown", handleOutsidePointer);
	doc.addEventListener("keydown", handleEscape, true);
	disposeActiveMenu = dispose;
	return dispose;
}
