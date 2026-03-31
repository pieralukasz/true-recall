import { jsx as _jsx } from "preact/jsx-runtime";
import { SimulatorSliderRow } from "./SimulatorSliderRow";
import { ALL_SLIDERS } from "../constants";
import { useCallback } from "preact/hooks";
export function SimulatorSliders({ simulator, onParameterChange, version, }) {
    const handleValueChange = useCallback((index, value) => {
        if (index === -1) {
            simulator.setDesiredRetention(value);
        }
        else {
            simulator.setParameter(index, value);
        }
        onParameterChange();
    }, [simulator, onParameterChange]);
    // Read current values, keyed off version to react to undo/redo/reset
    const getSliderValue = useCallback((index) => {
        var _a;
        if (index === -1)
            return simulator.getDesiredRetention();
        return (_a = simulator.getParameters()[index]) !== null && _a !== void 0 ? _a : 0;
    }, [simulator, version]);
    return (_jsx("div", { class: "ep:bg-obs-secondary ep:rounded-lg ep:p-4 ep:mb-4", children: _jsx("div", { class: "ep:grid ep:grid-cols-1 md:ep:grid-cols-2 lg:ep:grid-cols-3 ep:gap-3", children: ALL_SLIDERS.map((config) => (_jsx(SimulatorSliderRow, { config: config, value: getSliderValue(config.index), onValueChange: handleValueChange }, config.index))) }) }));
}
