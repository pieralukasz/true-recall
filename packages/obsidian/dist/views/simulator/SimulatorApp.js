import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { FSRSSimulatorService, } from "@true-recall/core/services/fsrs/fsrs-simulator.service";
import { ParametersBar, SimulatorChart, SimulatorControls, SimulatorResultsTable, SimulatorSliders, } from "@true-recall/obsidian/features/metrics/ui/simulator/components";
import { getSequenceColors } from "@true-recall/obsidian/features/metrics/ui/simulator/constants";
import { useSignal } from "@preact/signals";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";
export function SimulatorApp() {
    var _a;
    const plugin = usePlugin();
    const simulator = (_a = plugin.store) === null || _a === void 0 ? void 0 : _a.getState().simulator;
    const simulatorService = useMemo(() => new FSRSSimulatorService(), []);
    const simulations = useSignal([]);
    const parametersString = useSignal("");
    const canUndoSig = useSignal(false);
    const canRedoSig = useSignal(false);
    const sliderVersion = useSignal(0);
    const runSimulation = useCallback(() => {
        if (!simulator)
            return;
        const sequences = simulator.getSequences();
        const parameters = simulator.getParameters();
        const retention = simulator.getDesiredRetention();
        const results = simulatorService.simulate(sequences, parameters, retention, getSequenceColors());
        simulator.setSimulations(results);
        simulations.value = results;
        parametersString.value = simulator.getParametersString();
        canUndoSig.value = simulator.canUndo();
        canRedoSig.value = simulator.canRedo();
    }, [
        simulator,
        simulatorService,
        simulations,
        parametersString,
        canUndoSig,
        canRedoSig,
    ]);
    const timerRef = useRef(null);
    const scheduleUpdate = useCallback(() => {
        if (timerRef.current)
            clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            runSimulation();
            timerRef.current = null;
        }, 100);
    }, [runSimulation]);
    useEffect(() => {
        return () => {
            if (timerRef.current)
                clearTimeout(timerRef.current);
        };
    }, []);
    const refreshChart = useCallback(() => {
        if (!simulator)
            return;
        simulations.value = [...simulator.getSimulations()];
    }, [simulator, simulations]);
    useEffect(() => {
        runSimulation();
    }, [runSimulation]);
    const handleResetParams = useCallback(() => {
        if (!simulator)
            return;
        simulator.resetParameters();
        sliderVersion.value = sliderVersion.peek() + 1;
        scheduleUpdate();
    }, [simulator, sliderVersion, scheduleUpdate]);
    const handleUndo = useCallback(() => {
        if (!simulator)
            return;
        simulator.undo();
        sliderVersion.value = sliderVersion.peek() + 1;
        scheduleUpdate();
    }, [simulator, sliderVersion, scheduleUpdate]);
    const handleRedo = useCallback(() => {
        if (!simulator)
            return;
        simulator.redo();
        sliderVersion.value = sliderVersion.peek() + 1;
        scheduleUpdate();
    }, [simulator, sliderVersion, scheduleUpdate]);
    if (!simulator)
        return null;
    return (_jsxs("div", { class: "ep:p-2 ep:max-w-[1400px] ep:mx-auto", children: [_jsx("div", { class: "ep:flex ep:items-center ep:justify-between ep:mb-4", children: _jsx("h2", { class: "ep:text-xl ep:font-bold ep:text-obs-normal ep:m-0", children: "FSRS 6" }) }), _jsxs("div", { class: "ep:flex ep:gap-4 ep:mb-4", children: [_jsx("div", { class: "ep:w-[220px] ep:flex-shrink-0", children: _jsx(SimulatorControls, { simulator: simulator, onSequencesChange: scheduleUpdate, onMetricChange: refreshChart, onOptionsChange: refreshChart }) }), _jsx("div", { class: "ep:flex-1 ep:min-w-0", children: _jsx(SimulatorChart, { simulations: simulations.value, metricType: simulator.getMetricType(), useLogarithmic: simulator.getUseLogarithmic(), useAnimation: simulator.getUseAnimation() }) })] }), _jsx(ParametersBar, { parametersString: parametersString.value, canUndo: canUndoSig.value, canRedo: canRedoSig.value, onReset: handleResetParams, onUndo: handleUndo, onRedo: handleRedo }), _jsx(SimulatorSliders, { simulator: simulator, onParameterChange: scheduleUpdate, version: sliderVersion.value }), _jsx(SimulatorResultsTable, { simulations: simulations.value })] }));
}
