import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "preact/jsx-runtime";
import { Clickable, MarkdownContent } from "@true-recall/obsidian/components";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";
import { render } from "preact";
function WhatsNewBody({ release, onClose, }) {
    const date = new Date(release.publishedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    return (_jsxs(_Fragment, { children: [_jsxs("div", { class: "ep:text-ui-small ep:text-obs-muted ep:mb-3", children: [release.name, " \u2014 ", date] }), _jsx("div", { class: "ep:max-h-[60vh] ep:overflow-y-auto ep:pr-2", children: _jsx(MarkdownContent, { markdown: release.body }) }), _jsxs("div", { class: "ep:flex ep:justify-between ep:mt-4 ep:pt-3 ep:border-t ep:border-obs-border", children: [_jsx(Clickable, { stopPropagation: false, class: "ep-btn ep-btn-outline", onClick: () => window.open(release.htmlUrl), children: "View on GitHub" }), _jsx(Clickable, { stopPropagation: false, class: "mod-cta ep-btn", onClick: onClose, children: "Close" })] })] }));
}
export class WhatsNewModal extends BaseModal {
    constructor(plugin, release) {
        super(plugin.app, {
            title: `What's New in v${release.version}`,
            width: "550px",
        });
        this.plugin = plugin;
        this.release = release;
    }
    renderBody(container) {
        render(_jsx(ObsidianProvider, { value: { app: this.plugin.app, plugin: this.plugin }, children: _jsx(WhatsNewBody, { release: this.release, onClose: () => this.close() }) }), container);
    }
}
