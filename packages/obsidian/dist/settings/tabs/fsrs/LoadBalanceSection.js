import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useFsrsHelperOp } from "./useFsrsHelperOp";
import { ActionButton, FormCard, FormField, SliderInput, TextInput, ToggleInput, } from "@true-recall/obsidian/components";
import { useMemo } from "preact/hooks";
export function LoadBalanceSection({ settings, save, plugin, }) {
    const opConfig = useMemo(() => ({
        plugin,
        operationName: "balance-workload",
        undoDescription: (n) => `Balance workload (${n} cards)`,
        successMessage: (n) => `Balanced ${n} cards (Ctrl+Z to undo)`,
        emptyMessage: "No cards needed balancing",
        errorPrefix: "Balance failed",
    }), [plugin]);
    const { running: balancing, execute } = useFsrsHelperOp(opConfig);
    return (_jsxs(FormCard, { title: "Load balance", children: [_jsx(FormField, { name: "Enable load balancing", description: "Automatically distribute reviews to prevent workload spikes", children: _jsx(ToggleInput, { value: settings.loadBalanceEnabled, onChange: (v) => void save({ loadBalanceEnabled: v }) }) }), _jsx(FormField, { name: "Target daily reviews", description: "Target number of reviews per day for balancing", children: _jsx(TextInput, { value: String(settings.loadBalanceTarget), onChange: (v) => {
                        const num = parseInt(v, 10) || 100;
                        void save({ loadBalanceTarget: Math.max(1, num) });
                    }, placeholder: "100" }) }), _jsx(FormField, { name: "Maximum deviation (%)", description: "Allow this much deviation from target before rebalancing", children: _jsx(SliderInput, { value: settings.loadBalanceMaxDeviation, onChange: (v) => void save({ loadBalanceMaxDeviation: v }), min: 0, max: 50, step: 5, formatTooltip: (v) => `${v}%` }) }), _jsx(FormField, { name: "Balance workload now", description: "Redistribute reviews for the next 30 days", children: _jsx(ActionButton, { label: balancing ? "Balancing..." : "Balance now", variant: "secondary", disabled: balancing, onClick: () => void execute(() => { var _a; return (_a = plugin.fsrsHelper) === null || _a === void 0 ? void 0 : _a.balanceWorkload({ dryRun: false }); }) }) })] }));
}
