import type { Extension } from "@codemirror/state";
import { type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { h, render } from "preact";
import { ImageToolbar } from "./ImageToolbar";

export interface ImageToolbarCallbacks {
	onQuickAddImage: (imagePath: string) => Promise<void>;
	onEdit: (imagePath: string) => void;
	onImageOcclusion: (imagePath: string) => void;
	isEnabled: () => boolean;
}

function extractImagePathFromClick(
	target: HTMLElement,
	view: EditorView,
): string | null {
	// Wiki embed: ![[image.png]] → .internal-embed[src] wrapping an <img>
	const embed = target.closest(".internal-embed");
	if (embed) {
		const src = embed.getAttribute("src");
		if (src) return src;
	}

	// Markdown image: ![alt](path) → use CM position to read source
	if (target instanceof HTMLImageElement) {
		const pos = view.posAtDOM(target);
		if (pos != null) {
			const line = view.state.doc.lineAt(pos);
			const wiki = line.text.match(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
			if (wiki?.[1]) return wiki[1].trim();
			const md = line.text.match(/!\[[^\]]*\]\(([^)]+)\)/);
			if (md?.[1]) return md[1].trim();
		}
	}

	return null;
}

export function createImageToolbarExtension(
	callbacks: ImageToolbarCallbacks,
): Extension {
	return ViewPlugin.fromClass(
		class {
			private container: HTMLDivElement | null = null;
			private currentImagePath = "";
			private currentImgEl: HTMLElement | null = null;
			private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

			constructor(private view: EditorView) {
				this.view.dom.addEventListener("click", this.handleClick);
			}

			update(update: ViewUpdate): void {
				if (update.docChanged || (update.focusChanged && !this.view.hasFocus)) {
					this.removeToolbar();
				}
			}

			destroy(): void {
				this.view.dom.removeEventListener("click", this.handleClick);
				this.removeToolbar();
			}

			private handleClick = (e: MouseEvent): void => {
				const target = e.target;
				if (!(target instanceof HTMLElement)) return;

				if (!callbacks.isEnabled()) return;

				// Skip in review/browser contexts
				if (
					this.view.dom.closest(
						".true-recall-review-card-container, .ep-card-browser",
					)
				) {
					return;
				}

				const imgEl =
					target instanceof HTMLImageElement
						? target
						: target.querySelector("img");

				if (!imgEl) {
					this.removeToolbar();
					return;
				}

				const imagePath = extractImagePathFromClick(imgEl, this.view);
				if (!imagePath) {
					this.removeToolbar();
					return;
				}

				// Same image clicked — keep toolbar
				if (this.container && this.currentImagePath === imagePath) return;

				this.currentImagePath = imagePath;
				this.currentImgEl = imgEl;
				this.showToolbar(imagePath, imgEl);
			};

			private showToolbar(imagePath: string, imgEl: HTMLElement): void {
				if (!this.container) {
					this.container = document.createElement("div");
					this.container.className = "true-recall-image-toolbar-container";
					document.body.appendChild(this.container);
					this.registerOutsideClick();
				}

				render(
					h(ImageToolbar, {
						imagePath,
						onQuickAdd: async () => {
							await callbacks.onQuickAddImage(imagePath);
						},
						onEdit: () => callbacks.onEdit(imagePath),
						onImageOcclusion: () => callbacks.onImageOcclusion(imagePath),
						onDismiss: () => this.removeToolbar(),
					}),
					this.container,
				);

				this.positionToolbar(imgEl);
			}

			private positionToolbar(imgEl: HTMLElement): void {
				if (!this.container) return;

				void computePosition(imgEl, this.container, {
					placement: "top",
					middleware: [offset(6), flip(), shift({ padding: 8 })],
				}).then(({ x, y }) => {
					if (!this.container) return;
					this.container.style.left = `${x}px`;
					this.container.style.top = `${y}px`;
				});
			}

			private registerOutsideClick(): void {
				this.outsideClickHandler = (e: MouseEvent) => {
					if (!this.container) return;
					const target = e.target;
					if (!(target instanceof Node)) return;

					// Don't dismiss if clicking inside the toolbar
					if (this.container.contains(target)) return;

					// Don't dismiss if clicking the same image
					if (
						this.currentImgEl &&
						(this.currentImgEl === target || this.currentImgEl.contains(target))
					)
						return;

					this.removeToolbar();
				};

				// Use setTimeout so the current click doesn't immediately dismiss
				setTimeout(() => {
					if (this.outsideClickHandler) {
						document.addEventListener("mousedown", this.outsideClickHandler);
					}
				}, 0);
			}

			private removeToolbar(): void {
				if (this.outsideClickHandler) {
					document.removeEventListener("mousedown", this.outsideClickHandler);
					this.outsideClickHandler = null;
				}

				if (this.container) {
					render(null, this.container);
					this.container.remove();
					this.container = null;
					this.currentImagePath = "";
					this.currentImgEl = null;
				}
			}
		},
	);
}
