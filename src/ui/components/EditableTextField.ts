/**
 * Editable Text Field Component
 * Provides a textarea with optional formatting toolbar, auto-resize, and toggle logic
 */
import { BaseComponent } from "../component.base";
import {
	toggleTextareaWrap,
	insertAtTextareaCursor,
	setupAutoResize,
} from "./edit-toolbar.utils";

// Button action types
export type ToolbarButtonAction =
	| { type: "toggle"; before: string; after: string }
	| { type: "insert"; text: string }
	| { type: "custom"; handler: (textarea: HTMLTextAreaElement) => void };

// Button definition
export interface ToolbarButton {
	id: string;
	label: string;
	title: string;
	action: ToolbarButtonAction;
	shortcut?: string;
}

// Props for the editable text field
export interface EditableTextFieldProps {
	/** Initial value for the textarea */
	initialValue: string;
	/** Placeholder text */
	placeholder?: string;
	/** Whether to show the formatting toolbar */
	showToolbar?: boolean;
	/** Custom toolbar buttons (defaults to TOOLBAR_BUTTONS.REVIEW) */
	toolbarButtons?: ToolbarButton[];
	/** Position toolbar absolutely below the field */
	toolbarPositioned?: boolean;
	/** Called when content should be saved (blur, escape) */
	onSave?: (value: string) => void;
	/** Called on every input change */
	onChange?: (value: string) => void;
	/** Called when edit is cancelled */
	onCancel?: () => void;
	/** Called when Tab is pressed (for field navigation) */
	onTab?: () => void;
	/** CSS class for the textarea */
	textareaClass?: string;
	/** CSS class for the wrapper */
	wrapperClass?: string;
	/** Auto-focus on render */
	autoFocus?: boolean;
	/** Field identifier (for data attribute) */
	field?: string;
}

// Predefined toolbar button sets
export const TOOLBAR_BUTTONS = {
	/** ReviewView buttons - comprehensive set with HTML tags */
	REVIEW: [
		{
			id: "bold-wiki",
			label: "**[[]]**",
			title: "Bold Wiki Link",
			action: { type: "toggle", before: "**[[", after: "]]**" },
		},
		{
			id: "linebreak",
			label: "\u23CE\u23CE",
			title: "Double Line Break",
			action: { type: "insert", text: "\n\n" },
		},
		{
			id: "bold",
			label: "B",
			title: "Bold",
			action: { type: "toggle", before: "**", after: "**" },
		},
		{
			id: "italic",
			label: "I",
			title: "Italic",
			action: { type: "toggle", before: "*", after: "*" },
		},
		{
			id: "underline",
			label: "U",
			title: "Underline",
			action: { type: "toggle", before: "<u>", after: "</u>" },
		},
		{
			id: "wiki",
			label: "[[]]",
			title: "Wiki Link",
			action: { type: "toggle", before: "[[", after: "]]" },
		},
		{
			id: "math",
			label: "$",
			title: "Math",
			action: { type: "toggle", before: "$", after: "$" },
		},
		{
			id: "superscript",
			label: "x\u00B2",
			title: "Superscript",
			action: { type: "toggle", before: "<sup>", after: "</sup>" },
		},
		{
			id: "subscript",
			label: "x\u2082",
			title: "Subscript",
			action: { type: "toggle", before: "<sub>", after: "</sub>" },
		},
	] as ToolbarButton[],

	/** FlashcardEditorModal buttons - markdown focused */
	EDITOR: [
		{
			id: "bold",
			label: "B",
			title: "Bold",
			shortcut: "Ctrl+B",
			action: { type: "toggle", before: "**", after: "**" },
		},
		{
			id: "italic",
			label: "I",
			title: "Italic",
			shortcut: "Ctrl+I",
			action: { type: "toggle", before: "*", after: "*" },
		},
		{
			id: "wiki",
			label: "[[]]",
			title: "Wiki Link",
			shortcut: "Ctrl+K",
			action: { type: "toggle", before: "[[", after: "]]" },
		},
		{
			id: "math",
			label: "$$",
			title: "Math",
			shortcut: "Ctrl+M",
			action: { type: "toggle", before: "$$", after: "$$" },
		},
		{
			id: "h1",
			label: "H1",
			title: "Heading 1",
			shortcut: "Ctrl+Alt+1",
			action: { type: "insert", text: "# " },
		},
		{
			id: "h2",
			label: "H2",
			title: "Heading 2",
			shortcut: "Ctrl+Alt+2",
			action: { type: "insert", text: "## " },
		},
		{
			id: "list",
			label: "-",
			title: "List",
			shortcut: "Ctrl+L",
			action: { type: "insert", text: "- " },
		},
		{
			id: "quote",
			label: ">",
			title: "Quote",
			shortcut: "Ctrl+Shift+.",
			action: { type: "insert", text: "> " },
		},
		{
			id: "code",
			label: "`",
			title: "Code",
			shortcut: "Ctrl+`",
			action: { type: "toggle", before: "`", after: "`" },
		},
	] as ToolbarButton[],

	/** Minimal buttons for simple editing */
	MINIMAL: [
		{
			id: "bold",
			label: "B",
			title: "Bold",
			action: { type: "toggle", before: "**", after: "**" },
		},
		{
			id: "italic",
			label: "I",
			title: "Italic",
			action: { type: "toggle", before: "*", after: "*" },
		},
		{
			id: "wiki",
			label: "[[]]",
			title: "Wiki Link",
			action: { type: "toggle", before: "[[", after: "]]" },
		},
	] as ToolbarButton[],
};

/**
 * Editable Text Field Component
 */
export class EditableTextField extends BaseComponent {
	private props: EditableTextFieldProps;
	private textarea: HTMLTextAreaElement | null = null;
	private toolbar: HTMLElement | null = null;
	private cleanupAutoResize: (() => void) | null = null;

	constructor(container: HTMLElement, props: EditableTextFieldProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		// Clear existing
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
			this.cleanupAutoResize?.();
		}

		const wrapperClass = this.props.wrapperClass || "episteme-editable-field";
		this.element = this.container.createDiv({ cls: wrapperClass });

		// Create textarea
		const textareaClass =
			this.props.textareaClass || "episteme-editable-textarea";
		this.textarea = this.element.createEl("textarea", {
			cls: textareaClass,
			attr: {
				placeholder: this.props.placeholder || "",
				...(this.props.field && { "data-field": this.props.field }),
			},
		});

		// Set initial value (convert <br> to newlines for editing)
		this.textarea.value = this.props.initialValue.replace(/<br\s*\/?>/gi, "\n");

		// Setup auto-resize
		this.cleanupAutoResize = setupAutoResize(this.textarea);

		// Render toolbar if enabled
		if (this.props.showToolbar !== false) {
			this.renderToolbar();
		}

		// Setup event handlers
		this.setupEventHandlers();

		// Auto-focus if enabled
		if (this.props.autoFocus !== false) {
			setTimeout(() => {
				this.textarea?.focus();
				const len = this.textarea?.value.length || 0;
				this.textarea?.setSelectionRange(len, len);
				this.textarea?.scrollIntoView({ behavior: "smooth", block: "center" });
			}, 10);
		}
	}

	/**
	 * Render the formatting toolbar
	 */
	private renderToolbar(): void {
		if (!this.element || !this.textarea) return;

		const buttons = this.props.toolbarButtons || TOOLBAR_BUTTONS.REVIEW;
		const positioned = this.props.toolbarPositioned !== false;

		this.toolbar = this.element.createDiv({
			cls: `episteme-edit-toolbar${positioned ? " episteme-edit-toolbar--positioned" : ""}`,
		});

		for (const btn of buttons) {
			const title = btn.shortcut ? `${btn.title} (${btn.shortcut})` : btn.title;

			const btnEl = this.toolbar.createEl("button", {
				cls: "episteme-edit-toolbar-btn",
				text: btn.label,
				attr: { title, tabindex: "-1", "data-button-id": btn.id },
			});

			// Prevent blur on textarea when clicking toolbar
			this.events.addEventListener(btnEl, "mousedown", (e) => {
				e.preventDefault();
			});

			// Handle click
			this.events.addEventListener(btnEl, "click", (e) => {
				e.preventDefault();
				this.executeAction(btn.action);
				this.textarea?.focus();
			});
		}
	}

	/**
	 * Setup textarea event handlers
	 */
	private setupEventHandlers(): void {
		if (!this.textarea) return;

		// Blur handler
		this.events.addEventListener(this.textarea, "blur", (e) => {
			// Don't save if clicking toolbar
			const relatedTarget = (e as FocusEvent).relatedTarget as HTMLElement;
			if (relatedTarget?.closest(".episteme-edit-toolbar")) return;

			this.props.onSave?.(this.getValue());
		});

		// Input handler
		this.events.addEventListener(this.textarea, "input", () => {
			this.props.onChange?.(this.getValue());
		});

		// Keydown handler
		this.events.addEventListener(this.textarea, "keydown", (e) => {
			this.handleKeydown(e as KeyboardEvent);
		});
	}

	/**
	 * Handle keydown events
	 */
	private handleKeydown(e: KeyboardEvent): void {
		if (e.key === "Escape") {
			e.preventDefault();
			this.props.onSave?.(this.getValue());
		} else if (e.key === "Tab" && this.props.onTab) {
			e.preventDefault();
			this.props.onSave?.(this.getValue());
			this.props.onTab();
		}
	}

	/**
	 * Execute a toolbar button action
	 */
	private executeAction(action: ToolbarButtonAction): void {
		if (!this.textarea) return;

		switch (action.type) {
			case "toggle":
				toggleTextareaWrap(this.textarea, action.before, action.after);
				break;
			case "insert":
				insertAtTextareaCursor(this.textarea, action.text);
				break;
			case "custom":
				action.handler(this.textarea);
				break;
		}
	}

	/**
	 * Execute action by button ID (for keyboard shortcuts)
	 */
	executeButtonAction(buttonId: string): boolean {
		const buttons = this.props.toolbarButtons || TOOLBAR_BUTTONS.REVIEW;
		const btn = buttons.find((b) => b.id === buttonId);
		if (btn) {
			this.executeAction(btn.action);
			return true;
		}
		return false;
	}

	/**
	 * Get current value (with newlines converted to <br>)
	 */
	getValue(): string {
		return this.textarea?.value.replace(/\n/g, "<br>") || "";
	}

	/**
	 * Get raw value (with newlines preserved)
	 */
	getRawValue(): string {
		return this.textarea?.value || "";
	}

	/**
	 * Set value
	 */
	setValue(value: string): void {
		if (this.textarea) {
			this.textarea.value = value.replace(/<br\s*\/?>/gi, "\n");
		}
	}

	/**
	 * Focus the textarea
	 */
	focus(): void {
		this.textarea?.focus();
	}

	/**
	 * Get the textarea element
	 */
	getTextarea(): HTMLTextAreaElement | null {
		return this.textarea;
	}

	/**
	 * Get the toolbar element
	 */
	getToolbar(): HTMLElement | null {
		return this.toolbar;
	}

	/**
	 * Destroy and cleanup
	 */
	destroy(): void {
		this.cleanupAutoResize?.();
		super.destroy();
	}
}

/**
 * Factory function to create and render editable text field
 */
export function createEditableTextField(
	container: HTMLElement,
	props: EditableTextFieldProps
): EditableTextField {
	const field = new EditableTextField(container, props);
	field.render();
	return field;
}
