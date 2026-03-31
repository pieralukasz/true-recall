import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useErrorBoundary } from "preact/hooks";
import { Clickable } from "./Clickable";
export function ErrorBoundary({ children, fallbackMessage = "Something went wrong", }) {
    const [error, resetError] = useErrorBoundary((err) => console.error("[True Recall] Render error:", err));
    if (error) {
        return (_jsxs("div", { class: "ep:flex ep:flex-col ep:items-center ep:justify-center ep:p-8 ep:gap-4 ep:text-center", children: [_jsx("div", { class: "ep:text-ui-small ep:font-medium ep:text-obs-normal", children: fallbackMessage }), _jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:max-w-[300px]", children: error instanceof Error ? error.message : String(error) }), _jsx(Clickable, { class: "ep:py-2 ep:px-4 ep:rounded-md ep:bg-obs-interactive ep:text-obs-on-accent ep:border-none ep:text-ui-small ep:font-medium", onClick: resetError, children: "Try again" })] }));
    }
    return _jsx(_Fragment, { children: children });
}
