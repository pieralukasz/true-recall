import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { TRUERECALL_BMC_URL, TRUERECALL_DISCORD_URL, TRUERECALL_GITHUB_URL, TRUERECALL_WEB_URL, } from "@true-recall/core/constants";
import { Clickable, FormCard, FormField, InfoBlock, SelectInput, SliderInput, TextInput, ToggleInput, } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { useSettings } from "../hooks/useSettings";
export function GeneralTab() {
    var _a;
    const { settings, save, plugin } = useSettings();
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-3", children: [!settings.proKey && (_jsx(FormCard, { title: "True Recall Pro", children: _jsxs(InfoBlock, { children: ["True Recall Pro \u2014 zero-setup AI with optimized prompts, included in your subscription. Set up your key in the ", _jsx("strong", { children: "AI" }), " ", "settings tab."] }) })), _jsxs(FormCard, { title: "Review interface", children: [_jsx(FormField, { name: "Review mode", description: "Where to open the review session", children: _jsx(SelectInput, { value: settings.reviewMode, onChange: (v) => void save({ reviewMode: v }), options: [
                                { value: "fullscreen", label: "Fullscreen (main area)" },
                                { value: "panel", label: "Side panel" },
                            ] }) }), _jsx(FormField, { name: "Show review header", description: "Display header with close button, stats and progress in review session", children: _jsx(ToggleInput, { value: settings.showReviewHeader, onChange: (v) => void save({ showReviewHeader: v }) }) }), _jsx(FormField, { name: "Show header stats", description: "Display new/learning/due counters in review session header", children: _jsx(ToggleInput, { value: settings.showReviewHeaderStats, onChange: (v) => void save({ showReviewHeaderStats: v }) }) }), _jsx(FormField, { name: "Show next review time", description: "Display predicted interval on answer buttons", children: _jsx(ToggleInput, { value: settings.showNextReviewTime, onChange: (v) => void save({ showNextReviewTime: v }) }) }), _jsx(FormField, { name: "Continuous custom reviews", description: "Show 'Next session' button after completing a custom review session", children: _jsx(ToggleInput, { value: settings.continuousCustomReviews, onChange: (v) => void save({ continuousCustomReviews: v }) }) }), _jsx(FormField, { name: "Ignore daily limits for note study", description: "When studying a specific note from the dashboard, show all its cards regardless of daily limits", children: _jsx(ToggleInput, { value: settings.ignoreDailyLimitsForNoteStudy, onChange: (v) => void save({ ignoreDailyLimitsForNoteStudy: v }) }) }), _jsx(FormField, { name: "Default type-in mode", description: "Type-in mode used when a new review session starts (T still cycles modes in-session)", children: _jsx(SelectInput, { value: settings.defaultTypeInMode, onChange: (v) => void save({ defaultTypeInMode: v }), options: [
                                { value: "off", label: "Off" },
                                { value: "diff", label: "Diff" },
                                { value: "ai", label: "AI" },
                            ] }) })] }), _jsxs(FormCard, { title: "Editor integration", children: [_jsx(FormField, { name: "Show link status indicators", description: "Display inline flashcard counts (new/learning/review) next to [[links]] that point to notes with flashcards", children: _jsx(ToggleInput, { value: settings.showLinkStatusIndicators, onChange: (v) => void save({ showLinkStatusIndicators: v }) }) }), _jsx(FormField, { name: "Show donuts in flashcard panel", description: "Display donut indicators next to links inside flashcard panel cards", children: _jsx(ToggleInput, { value: settings.showDonutsInPanel, onChange: (v) => void save({ showDonutsInPanel: v }) }) }), _jsx(FormField, { name: "Show donuts in review", description: "Display donut indicators next to links during review sessions", children: _jsx(ToggleInput, { value: settings.showDonutsInReview, onChange: (v) => void save({ showDonutsInReview: v }) }) }), _jsx(FormField, { name: "Show status bar widget", description: "Display global due/new/learning card counts in the bottom status bar", children: _jsx(ToggleInput, { value: settings.showStatusBarWidget, onChange: (v) => void save({ showStatusBarWidget: v }) }) })] }), _jsx(FormCard, { title: "Day boundary", children: _jsx(FormField, { name: "Next day starts at", description: "Hour when a new day begins (0-23). Default: 4 (4:00 am)", children: _jsx(SliderInput, { value: settings.dayStartHour, onChange: (v) => void save({ dayStartHour: v }), min: 0, max: 23, step: 1, formatTooltip: (v) => `${v}:00` }) }) }), _jsxs(FormCard, { title: "Local API (MCP)", children: [_jsx(InfoBlock, { children: "Expose a local HTTP API for Claude Code and other MCP-compatible tools. Binds to 127.0.0.1 only \u2014 never exposed to the network." }), _jsx(FormField, { name: "Enable local API", description: "Start an HTTP server for MCP/CLI integration when the plugin loads", children: _jsx(ToggleInput, { value: settings.enableLocalApi, onChange: (v) => {
                                var _a;
                                void save({ enableLocalApi: v });
                                if (v) {
                                    void (() => __awaiter(this, void 0, void 0, function* () {
                                        var _a;
                                        if (!plugin.localApi) {
                                            const { LocalApiServer } = yield import("@true-recall/obsidian/plugin/api/LocalApiServer");
                                            plugin.localApi = new LocalApiServer(plugin, settings.apiPort);
                                        }
                                        (_a = plugin.localApi) === null || _a === void 0 ? void 0 : _a.start();
                                    }))();
                                }
                                else {
                                    (_a = plugin.localApi) === null || _a === void 0 ? void 0 : _a.stop();
                                }
                            } }) }), _jsx(FormField, { name: "Port", description: "Local API port (default: 27182). Restart Obsidian after changing.", children: _jsx(TextInput, { value: String(settings.apiPort), placeholder: "27182", onChange: (v) => {
                                const port = Number.parseInt(v, 10);
                                if (!Number.isNaN(port) && port >= 1024 && port <= 65535) {
                                    void save({ apiPort: port });
                                }
                            } }) }), ((_a = plugin.localApi) === null || _a === void 0 ? void 0 : _a.isRunning()) && (_jsxs(InfoBlock, { children: ["API running on", " ", _jsxs("code", { children: ["http://127.0.0.1:", plugin.localApi.getPort()] })] }))] }), _jsxs(FormCard, { title: "About", children: [_jsx(FormField, { name: "What's New", description: `See release notes for version ${plugin.manifest.version}`, children: _jsx(Clickable, { class: "ep-btn ep-btn-outline", onClick: () => void (() => __awaiter(this, void 0, void 0, function* () {
                                const { fetchLatestRelease } = yield import("@true-recall/obsidian/services/release-notes.service");
                                const release = yield fetchLatestRelease();
                                if (!release) {
                                    notify().error("Could not fetch release notes. Check your internet connection.");
                                    return;
                                }
                                const { WhatsNewModal } = yield import("@true-recall/obsidian/modals/shared/WhatsNewModal");
                                new WhatsNewModal(plugin, release).open();
                            }))(), children: "View release notes" }) }), _jsx(FormField, { name: "Website", description: "Visit the True Recall website", children: _jsx(Clickable, { class: "ep-btn ep-btn-outline", onClick: () => window.open(TRUERECALL_WEB_URL, "_blank"), children: "truerecall.app" }) }), _jsx(FormField, { name: "Discord", description: "Join the True Recall community", children: _jsx(Clickable, { class: "ep-btn ep-btn-outline", onClick: () => window.open(TRUERECALL_DISCORD_URL, "_blank"), children: "Join Discord" }) })] }), _jsx(SupportCard, {})] }));
}
function SupportCard() {
    const heartRef = useIcon("heart");
    const githubRef = useIcon("github");
    return (_jsxs(FormCard, { title: "Support", children: [_jsx(InfoBlock, { children: "If True Recall helps your learning, consider supporting its development." }), _jsxs("div", { class: "ep:flex ep:gap-2 ep:mt-1", children: [_jsxs(Clickable, { class: "ep-btn ep-btn-outline ep:inline-flex ep:items-center ep:gap-1.5", onClick: () => window.open(TRUERECALL_BMC_URL, "_blank"), children: [_jsx("div", { ref: heartRef, class: "ep:w-4 ep:h-4" }), "Buy Me a Coffee"] }), _jsxs(Clickable, { class: "ep-btn ep-btn-outline ep:inline-flex ep:items-center ep:gap-1.5", onClick: () => window.open(TRUERECALL_GITHUB_URL, "_blank"), children: [_jsx("div", { ref: githubRef, class: "ep:w-4 ep:h-4" }), "GitHub"] })] })] }));
}
