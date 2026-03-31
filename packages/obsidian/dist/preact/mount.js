import { jsx as _jsx } from "preact/jsx-runtime";
import { ErrorBoundary } from "@true-recall/obsidian/components/ErrorBoundary";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";
import { render } from "preact";
export function mountPreact(container, plugin, children) {
    render(_jsx(ObsidianProvider, { value: { app: plugin.app, plugin }, children: _jsx(ErrorBoundary, { children: children }) }), container);
    return () => render(null, container);
}
