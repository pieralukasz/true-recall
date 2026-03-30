import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useFsrsHelperOp } from "./useFsrsHelperOp";
import { ActionButton, FormCard, FormField, InfoBlock, TextInput, ToggleInput, } from "@true-recall/obsidian/components";
import { useMemo } from "preact/hooks";
export function SiblingDisperseSection({ settings, save, plugin, }) {
    const opConfig = useMemo(() => ({
        plugin,
        operationName: "disperse-siblings",
        undoDescription: (n) => `Disperse siblings (${n} cards)`,
        successMessage: (n) => `Dispersed ${n} cards (Ctrl+Z to undo)`,
        emptyMessage: "No siblings needed dispersing",
        errorPrefix: "Disperse failed",
    }), [plugin]);
    const { running: dispersing, execute } = useFsrsHelperOp(opConfig);
    return (_jsxs(FormCard, { title: "Sibling dispersal", children: [_jsx(InfoBlock, { children: _jsx("p", { children: "Cards from the same source note are \"siblings\". Spreading them apart helps avoid interference during review." }) }), _jsx(FormField, { name: "Enable sibling dispersal", description: "Automatically space out cards from the same note", children: _jsx(ToggleInput, { value: settings.siblingDisperseEnabled, onChange: (v) => void save({ siblingDisperseEnabled: v }) }) }), _jsx(FormField, { name: "Minimum sibling interval", description: "Minimum days between siblings from the same source", children: _jsx(TextInput, { value: String(settings.siblingMinInterval), onChange: (v) => {
                        const num = parseInt(v, 10) || 3;
                        void save({ siblingMinInterval: Math.max(1, num) });
                    }, placeholder: "3" }) }), _jsx(FormField, { name: "Disperse siblings now", description: "Spread out siblings that are currently too close", children: _jsx(ActionButton, { label: dispersing ? "Dispersing..." : "Disperse now", variant: "secondary", disabled: dispersing, onClick: () => void execute(() => { var _a; return (_a = plugin.fsrsHelper) === null || _a === void 0 ? void 0 : _a.disperseSiblings({ dryRun: false }); }) }) })] }));
}
