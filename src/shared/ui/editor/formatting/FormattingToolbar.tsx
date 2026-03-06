import { useIcon } from "@shared/ui/preact/hooks";
import type { App, TFile } from "obsidian";
import { SuggestModal } from "obsidian";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import {
	clearFormatting,
	insertAtCursor,
	toggleAsymmetricMarker,
	toggleMarker,
} from "./cm6-formatting";
import type { GetFormattingEditorView } from "./types";

interface FormattingToolbarProps {
	app: App;
	getEditorView: GetFormattingEditorView;
	typeInEnabled?: boolean;
	onTypeInToggle?: (enabled: boolean) => void;
}

const COLOR_SWATCHES = [
	{ name: "Red", css: "var(--color-red)" },
	{ name: "Orange", css: "var(--color-orange)" },
	{ name: "Yellow", css: "var(--color-yellow)" },
	{ name: "Green", css: "var(--color-green)" },
	{ name: "Cyan", css: "var(--color-cyan)" },
	{ name: "Blue", css: "var(--color-blue)" },
	{ name: "Purple", css: "var(--color-purple)" },
	{ name: "Pink", css: "var(--color-pink)" },
];

const IMAGE_EXTENSIONS = new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"svg",
	"webp",
	"bmp",
	"avif",
]);

class MediaFilePicker extends SuggestModal<TFile> {
	private resolve: ((file: TFile | null) => void) | null = null;

	constructor(app: App) {
		super(app);
		this.setPlaceholder("Search for an image...");
	}

	getSuggestions(query: string): TFile[] {
		const lowerQuery = query.toLowerCase();
		return this.app.vault
			.getFiles()
			.filter((f) => {
				const ext = f.extension.toLowerCase();
				if (!IMAGE_EXTENSIONS.has(ext)) return false;
				return !lowerQuery || f.path.toLowerCase().includes(lowerQuery);
			})
			.slice(0, 50);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.createDiv({ text: file.name, cls: "suggestion-title" });
		el.createDiv({
			text: file.parent?.path ?? "/",
			cls: "suggestion-note",
		});
	}

	onChooseSuggestion(file: TFile): void {
		this.resolve?.(file);
	}

	onClose(): void {
		setTimeout(() => this.resolve?.(null), 0);
	}

	pick(): Promise<TFile | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}

export function FormattingToolbar({
	app,
	getEditorView,
	typeInEnabled = false,
	onTypeInToggle,
}: FormattingToolbarProps) {
	const [showColors, setShowColors] = useState(false);
	const colorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!showColors) return;
		const handleClick = (e: MouseEvent) => {
			if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
				setShowColors(false);
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [showColors]);

	const handleMedia = useCallback(async () => {
		const view = getEditorView();
		if (!view) return;
		const picker = new MediaFilePicker(app);
		const file = await picker.pick();
		if (file) {
			insertAtCursor(view, `![[${file.name}]]`);
		}
	}, [app, getEditorView]);

	const handleColor = useCallback(
		(css: string) => {
			const view = getEditorView();
			if (!view) return;
			toggleAsymmetricMarker(view, `<span style="color:${css}">`, "</span>");
			setShowColors(false);
		},
		[getEditorView],
	);

	const handleClear = useCallback(() => {
		const view = getEditorView();
		if (view) clearFormatting(view);
	}, [getEditorView]);

	const prevent = (e: MouseEvent) => e.preventDefault();

	const handleKeyDown = (action: () => void) => (e: KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			action();
		}
	};

	const btnCls =
		"ep:px-1.5 ep:py-1 ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-tertiary ep:rounded ep:cursor-pointer ep:select-none ep:leading-tight";

	return (
		<div class="ep:flex ep:items-center ep:gap-0.5 ep:px-2 ep:py-1 ep:bg-obs-secondary ep:rounded-md ep:border ep:border-obs-border ep:w-full">
			<div
				role="button"
				tabIndex={0}
				title="Bold (Ctrl+B)"
				class={`${btnCls} ep:font-bold`}
				onMouseDown={(e: MouseEvent) => {
					prevent(e);
					const v = getEditorView();
					if (v) toggleMarker(v, "**");
				}}
				onKeyDown={handleKeyDown(() => {
					const v = getEditorView();
					if (v) toggleMarker(v, "**");
				})}
			>
				B
			</div>
			<div
				role="button"
				tabIndex={0}
				title="Italic (Ctrl+I)"
				class={`${btnCls} ep:italic`}
				onMouseDown={(e: MouseEvent) => {
					prevent(e);
					const v = getEditorView();
					if (v) toggleMarker(v, "*");
				}}
				onKeyDown={handleKeyDown(() => {
					const v = getEditorView();
					if (v) toggleMarker(v, "*");
				})}
			>
				I
			</div>
			<div
				role="button"
				tabIndex={0}
				title="Underline (Ctrl+U)"
				class={`${btnCls} ep:underline`}
				onMouseDown={(e: MouseEvent) => {
					prevent(e);
					const v = getEditorView();
					if (v) toggleAsymmetricMarker(v, "<u>", "</u>");
				}}
				onKeyDown={handleKeyDown(() => {
					const v = getEditorView();
					if (v) toggleAsymmetricMarker(v, "<u>", "</u>");
				})}
			>
				U
			</div>

			<Separator />

			<div
				role="button"
				tabIndex={0}
				title="Inline code"
				class={`${btnCls} ep:font-mono`}
				onMouseDown={(e: MouseEvent) => {
					prevent(e);
					const v = getEditorView();
					if (v) toggleMarker(v, "`");
				}}
				onKeyDown={handleKeyDown(() => {
					const v = getEditorView();
					if (v) toggleMarker(v, "`");
				})}
			>
				{"`"}
			</div>
			<div
				role="button"
				tabIndex={0}
				title="Math (LaTeX)"
				class={btnCls}
				onMouseDown={(e: MouseEvent) => {
					prevent(e);
					const v = getEditorView();
					if (v) toggleMarker(v, "$");
				}}
				onKeyDown={handleKeyDown(() => {
					const v = getEditorView();
					if (v) toggleMarker(v, "$");
				})}
			>
				$
			</div>
			<div
				role="button"
				tabIndex={0}
				title="Wiki link"
				class={`${btnCls} ep:text-[11px]`}
				onMouseDown={(e: MouseEvent) => {
					prevent(e);
					const v = getEditorView();
					if (v) toggleAsymmetricMarker(v, "[[", "]]");
				}}
				onKeyDown={handleKeyDown(() => {
					const v = getEditorView();
					if (v) toggleAsymmetricMarker(v, "[[", "]]");
				})}
			>
				[[]]
			</div>

			<Separator />

			<IconButton
				iconId="image"
				title="Insert image"
				onMouseDown={(e: MouseEvent) => {
					prevent(e);
					void handleMedia();
				}}
			/>

			<div ref={colorRef} class="ep:relative">
				<IconButton
					iconId="palette"
					title="Text color"
					onMouseDown={(e: MouseEvent) => {
						prevent(e);
						setShowColors((v) => !v);
					}}
				/>
				{showColors && (
					<div class="ep:absolute ep:top-full ep:left-0 ep:mt-1 ep:p-1.5 ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:shadow-lg ep:z-50 ep:flex ep:gap-1">
						{COLOR_SWATCHES.map((swatch) => (
							<div
								key={swatch.name}
								role="button"
								tabIndex={0}
								title={swatch.name}
								class="ep:w-5 ep:h-5 ep:rounded ep:cursor-pointer ep:hover:scale-110 ep:transition-transform ep:border ep:border-obs-border"
								style={{ backgroundColor: swatch.css }}
								onMouseDown={(e: MouseEvent) => {
									prevent(e);
									handleColor(swatch.css);
								}}
								onKeyDown={handleKeyDown(() => handleColor(swatch.css))}
							/>
						))}
					</div>
				)}
			</div>

			<IconButton
				iconId="eraser"
				title="Clear formatting"
				onMouseDown={(e: MouseEvent) => {
					prevent(e);
					handleClear();
				}}
			/>

			{onTypeInToggle && (
				<>
					<div class="ep:ml-auto" />
					<Separator />
					<div
						role="button"
						tabIndex={0}
						title="Always type-in for created card"
						class={`${btnCls} ${typeInEnabled ? "ep:text-obs-accent ep:bg-obs-accent/10" : ""}`}
						onMouseDown={(e: MouseEvent) => {
							prevent(e);
							onTypeInToggle(!typeInEnabled);
						}}
						onKeyDown={handleKeyDown(() => onTypeInToggle(!typeInEnabled))}
					>
						Type in
					</div>
				</>
			)}
		</div>
	);
}

function Separator() {
	return <div class="ep:w-px ep:h-4 ep:bg-obs-border ep:mx-0.5 ep:shrink-0" />;
}

function IconButton({
	iconId,
	title,
	onMouseDown,
}: {
	iconId: string;
	title: string;
	onMouseDown: (e: MouseEvent) => void;
}) {
	const ref = useIcon(iconId);
	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			const mockEvent = { preventDefault: () => {} } as MouseEvent;
			onMouseDown(mockEvent);
		}
	};
	return (
		<div
			ref={ref}
			role="button"
			tabIndex={0}
			title={title}
			class="ep:px-1.5 ep:py-1 ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-tertiary ep:rounded ep:cursor-pointer ep:select-none [&>svg]:ep:w-3.5 [&>svg]:ep:h-3.5"
			onMouseDown={onMouseDown}
			onKeyDown={handleKeyDown}
		/>
	);
}
