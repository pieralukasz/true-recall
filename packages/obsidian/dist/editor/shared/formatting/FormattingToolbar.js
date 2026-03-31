import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { SuggestModal } from "obsidian";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { clearFormatting, insertAtCursor, toggleAsymmetricMarker, toggleMarker, } from "./cm6-formatting";
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
class MediaFilePicker extends SuggestModal {
    constructor(app) {
        super(app);
        this.resolve = null;
        this.setPlaceholder("Search for an image...");
    }
    getSuggestions(query) {
        const lowerQuery = query.toLowerCase();
        return this.app.vault
            .getFiles()
            .filter((f) => {
            const ext = f.extension.toLowerCase();
            if (!IMAGE_EXTENSIONS.has(ext))
                return false;
            return !lowerQuery || f.path.toLowerCase().includes(lowerQuery);
        })
            .slice(0, 50);
    }
    renderSuggestion(file, el) {
        var _a, _b;
        el.createDiv({ text: file.name, cls: "suggestion-title" });
        el.createDiv({
            text: (_b = (_a = file.parent) === null || _a === void 0 ? void 0 : _a.path) !== null && _b !== void 0 ? _b : "/",
            cls: "suggestion-note",
        });
    }
    onChooseSuggestion(file) {
        var _a;
        (_a = this.resolve) === null || _a === void 0 ? void 0 : _a.call(this, file);
    }
    onClose() {
        setTimeout(() => { var _a; return (_a = this.resolve) === null || _a === void 0 ? void 0 : _a.call(this, null); }, 0);
    }
    pick() {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }
}
export function FormattingToolbar({ app, getEditorView, typeInEnabled = false, onTypeInToggle, }) {
    const [showColors, setShowColors] = useState(false);
    const colorRef = useRef(null);
    useEffect(() => {
        if (!showColors)
            return;
        const handleClick = (e) => {
            if (colorRef.current && !colorRef.current.contains(e.target)) {
                setShowColors(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [showColors]);
    const handleMedia = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const view = getEditorView();
        if (!view)
            return;
        const picker = new MediaFilePicker(app);
        const file = yield picker.pick();
        if (file) {
            insertAtCursor(view, `![[${file.name}]]`);
        }
    }), [app, getEditorView]);
    const handleColor = useCallback((css) => {
        const view = getEditorView();
        if (!view)
            return;
        toggleAsymmetricMarker(view, `<span style="color:${css}">`, "</span>");
        setShowColors(false);
    }, [getEditorView]);
    const handleClear = useCallback(() => {
        const view = getEditorView();
        if (view)
            clearFormatting(view);
    }, [getEditorView]);
    const [copied, setCopied] = useState(false);
    const handleCopy = useCallback(() => {
        const view = getEditorView();
        if (!view)
            return;
        const { from, to } = view.state.selection.main;
        const text = from === to ? view.state.doc.toString() : view.state.sliceDoc(from, to);
        if (!text)
            return;
        void navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }, [getEditorView]);
    const prevent = (e) => e.preventDefault();
    const handleKeyDown = (action) => (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            action();
        }
    };
    const btnCls = "ep:px-1.5 ep:py-1 ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-tertiary ep:rounded ep:cursor-pointer ep:select-none ep:leading-tight";
    return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-0.5 ep:px-2 ep:py-1 ep:bg-obs-secondary ep:rounded-md ep:border ep:border-obs-border ep:w-full", children: [_jsx("div", { role: "button", tabIndex: 0, title: "Bold (Ctrl+B)", class: `${btnCls} ep:font-bold`, onMouseDown: (e) => {
                    prevent(e);
                    const v = getEditorView();
                    if (v)
                        toggleMarker(v, "**");
                }, onKeyDown: handleKeyDown(() => {
                    const v = getEditorView();
                    if (v)
                        toggleMarker(v, "**");
                }), children: "B" }), _jsx("div", { role: "button", tabIndex: 0, title: "Italic (Ctrl+I)", class: `${btnCls} ep:italic`, onMouseDown: (e) => {
                    prevent(e);
                    const v = getEditorView();
                    if (v)
                        toggleMarker(v, "*");
                }, onKeyDown: handleKeyDown(() => {
                    const v = getEditorView();
                    if (v)
                        toggleMarker(v, "*");
                }), children: "I" }), _jsx("div", { role: "button", tabIndex: 0, title: "Underline (Ctrl+U)", class: `${btnCls} ep:underline`, onMouseDown: (e) => {
                    prevent(e);
                    const v = getEditorView();
                    if (v)
                        toggleAsymmetricMarker(v, "<u>", "</u>");
                }, onKeyDown: handleKeyDown(() => {
                    const v = getEditorView();
                    if (v)
                        toggleAsymmetricMarker(v, "<u>", "</u>");
                }), children: "U" }), _jsx(IconButton, { iconId: "highlighter", title: "Highlight (Ctrl+Shift+H)", onMouseDown: (e) => {
                    prevent(e);
                    const v = getEditorView();
                    if (v)
                        toggleMarker(v, "==");
                } }), _jsx(Separator, {}), _jsx("div", { role: "button", tabIndex: 0, title: "Inline code", class: `${btnCls} ep:font-mono`, onMouseDown: (e) => {
                    prevent(e);
                    const v = getEditorView();
                    if (v)
                        toggleMarker(v, "`");
                }, onKeyDown: handleKeyDown(() => {
                    const v = getEditorView();
                    if (v)
                        toggleMarker(v, "`");
                }), children: "`" }), _jsx("div", { role: "button", tabIndex: 0, title: "Math (LaTeX)", class: btnCls, onMouseDown: (e) => {
                    prevent(e);
                    const v = getEditorView();
                    if (v)
                        toggleMarker(v, "$");
                }, onKeyDown: handleKeyDown(() => {
                    const v = getEditorView();
                    if (v)
                        toggleMarker(v, "$");
                }), children: "$" }), _jsx("div", { role: "button", tabIndex: 0, title: "Wiki link", class: `${btnCls} ep:text-[11px]`, onMouseDown: (e) => {
                    prevent(e);
                    const v = getEditorView();
                    if (v)
                        toggleAsymmetricMarker(v, "[[", "]]");
                }, onKeyDown: handleKeyDown(() => {
                    const v = getEditorView();
                    if (v)
                        toggleAsymmetricMarker(v, "[[", "]]");
                }), children: "[[]]" }), _jsx(Separator, {}), _jsx(IconButton, { iconId: "image", title: "Insert image", onMouseDown: (e) => {
                    prevent(e);
                    void handleMedia();
                } }), _jsxs("div", { ref: colorRef, class: "ep:relative", children: [_jsx(IconButton, { iconId: "palette", title: "Text color", onMouseDown: (e) => {
                            prevent(e);
                            setShowColors((v) => !v);
                        } }), showColors && (_jsx("div", { class: "ep:absolute ep:top-full ep:left-0 ep:mt-1 ep:p-1.5 ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:shadow-lg ep:z-50 ep:flex ep:gap-1", children: COLOR_SWATCHES.map((swatch) => (_jsx("div", { role: "button", tabIndex: 0, title: swatch.name, class: "ep:w-5 ep:h-5 ep:rounded ep:cursor-pointer ep:hover:scale-110 ep:transition-transform ep:border ep:border-obs-border", style: { backgroundColor: swatch.css }, onMouseDown: (e) => {
                                prevent(e);
                                handleColor(swatch.css);
                            }, onKeyDown: handleKeyDown(() => handleColor(swatch.css)) }, swatch.name))) }))] }), _jsx(IconButton, { iconId: "eraser", title: "Clear formatting", onMouseDown: (e) => {
                    prevent(e);
                    handleClear();
                } }), _jsx(Separator, {}), _jsx(IconButton, { iconId: copied ? "check" : "copy", title: copied ? "Copied!" : "Copy", onMouseDown: (e) => {
                    prevent(e);
                    handleCopy();
                } }), onTypeInToggle && (_jsxs(_Fragment, { children: [_jsx("div", { class: "ep:ml-auto" }), _jsx(Separator, {}), _jsx("div", { role: "button", tabIndex: 0, title: "Always type-in for created card", class: `${btnCls} ${typeInEnabled ? "ep:text-obs-accent ep:bg-obs-accent/10" : ""}`, onMouseDown: (e) => {
                            prevent(e);
                            onTypeInToggle(!typeInEnabled);
                        }, onKeyDown: handleKeyDown(() => onTypeInToggle(!typeInEnabled)), children: "Type in" })] }))] }));
}
function Separator() {
    return _jsx("div", { class: "ep:w-px ep:h-4 ep:bg-obs-border ep:mx-0.5 ep:shrink-0" });
}
function IconButton({ iconId, title, onMouseDown, }) {
    const ref = useIcon(iconId);
    const handleKeyDown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const mockEvent = { preventDefault: () => { } };
            onMouseDown(mockEvent);
        }
    };
    return (_jsx("div", { ref: ref, role: "button", tabIndex: 0, title: title, class: "ep:px-1.5 ep:py-1 ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-tertiary ep:rounded ep:cursor-pointer ep:select-none [&>svg]:ep:w-3.5 [&>svg]:ep:h-3.5", onMouseDown: onMouseDown, onKeyDown: handleKeyDown }));
}
