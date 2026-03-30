import { DEFAULT_SEQUENCES } from "../ui/simulator/constants";
import { DEFAULT_FSRS_WEIGHTS } from "@true-recall/core/constants";
const MAX_HISTORY_SIZE = 50;
function createInitialState(deps) {
    var _a;
    const settings = deps.getSettings();
    const initialParams = settings.fsrsWeights
        ? [...settings.fsrsWeights]
        : [...DEFAULT_FSRS_WEIGHTS];
    const initialRetention = (_a = settings.fsrsRequestRetention) !== null && _a !== void 0 ? _a : 0.9;
    return {
        sequences: [...DEFAULT_SEQUENCES],
        parameters: initialParams,
        desiredRetention: initialRetention,
        metricType: "interval",
        useAnimation: false,
        useLogarithmic: false,
        parameterHistory: [initialParams],
        historyIndex: 0,
        simulations: [],
    };
}
export function createSimulatorSlice(set, get, deps) {
    const initial = createInitialState(deps);
    const pushParameterHistory = (params) => {
        const state = get().simulator;
        const history = state.parameterHistory.slice(0, state.historyIndex + 1);
        history.push([...params]);
        while (history.length > MAX_HISTORY_SIZE) {
            history.shift();
        }
        set((s) => ({
            simulator: Object.assign(Object.assign({}, s.simulator), { parameterHistory: history, historyIndex: history.length - 1 }),
        }));
    };
    const slice = {
        // State
        sequences: initial.sequences,
        parameters: initial.parameters,
        desiredRetention: initial.desiredRetention,
        metricType: initial.metricType,
        useAnimation: initial.useAnimation,
        useLogarithmic: initial.useLogarithmic,
        parameterHistory: initial.parameterHistory,
        historyIndex: initial.historyIndex,
        simulations: initial.simulations,
        // Getters
        getSequences: () => [...get().simulator.sequences],
        getParameters: () => [...get().simulator.parameters],
        getDesiredRetention: () => get().simulator.desiredRetention,
        getMetricType: () => get().simulator.metricType,
        getUseAnimation: () => get().simulator.useAnimation,
        getUseLogarithmic: () => get().simulator.useLogarithmic,
        getSimulations: () => get().simulator.simulations,
        canUndo: () => get().simulator.historyIndex > 0,
        canRedo: () => {
            const s = get().simulator;
            return s.historyIndex < s.parameterHistory.length - 1;
        },
        // Setters
        setSequences: (sequences) => {
            set((s) => ({
                simulator: Object.assign(Object.assign({}, s.simulator), { sequences: [...sequences] }),
            }));
        },
        setParameter: (index, value) => {
            const newParams = [...get().simulator.parameters];
            newParams[index] = value;
            pushParameterHistory(newParams);
            set((s) => ({
                simulator: Object.assign(Object.assign({}, s.simulator), { parameters: newParams }),
            }));
        },
        setAllParameters: (parameters) => {
            const newParams = [...parameters];
            pushParameterHistory(newParams);
            set((s) => ({
                simulator: Object.assign(Object.assign({}, s.simulator), { parameters: newParams }),
            }));
        },
        setDesiredRetention: (value) => {
            set((s) => ({
                simulator: Object.assign(Object.assign({}, s.simulator), { desiredRetention: value }),
            }));
        },
        setMetricType: (type) => {
            set((s) => ({
                simulator: Object.assign(Object.assign({}, s.simulator), { metricType: type }),
            }));
        },
        setUseAnimation: (value) => {
            set((s) => ({
                simulator: Object.assign(Object.assign({}, s.simulator), { useAnimation: value }),
            }));
        },
        setUseLogarithmic: (value) => {
            set((s) => ({
                simulator: Object.assign(Object.assign({}, s.simulator), { useLogarithmic: value }),
            }));
        },
        setSimulations: (simulations) => {
            set((s) => ({
                simulator: Object.assign(Object.assign({}, s.simulator), { simulations }),
            }));
        },
        resetSequences: () => {
            set((s) => ({
                simulator: Object.assign(Object.assign({}, s.simulator), { sequences: [...DEFAULT_SEQUENCES] }),
            }));
        },
        resetParameters: () => {
            var _a;
            const settings = deps.getSettings();
            const initialParams = settings.fsrsWeights
                ? [...settings.fsrsWeights]
                : [...DEFAULT_FSRS_WEIGHTS];
            const initialRetention = (_a = settings.fsrsRequestRetention) !== null && _a !== void 0 ? _a : 0.9;
            pushParameterHistory(initialParams);
            set((s) => ({
                simulator: Object.assign(Object.assign({}, s.simulator), { parameters: initialParams, desiredRetention: initialRetention }),
            }));
        },
        undo: () => {
            const state = get().simulator;
            if (state.historyIndex <= 0)
                return;
            const newIndex = state.historyIndex - 1;
            const prevParams = state.parameterHistory[newIndex];
            if (!prevParams)
                return;
            set((s) => ({
                simulator: Object.assign(Object.assign({}, s.simulator), { parameters: [...prevParams], historyIndex: newIndex }),
            }));
        },
        redo: () => {
            const state = get().simulator;
            if (state.historyIndex >= state.parameterHistory.length - 1)
                return;
            const newIndex = state.historyIndex + 1;
            const nextParams = state.parameterHistory[newIndex];
            if (!nextParams)
                return;
            set((s) => ({
                simulator: Object.assign(Object.assign({}, s.simulator), { parameters: [...nextParams], historyIndex: newIndex }),
            }));
        },
        reset: () => {
            const initialState = createInitialState(deps);
            set((s) => ({
                simulator: Object.assign(Object.assign({}, s.simulator), { sequences: initialState.sequences, parameters: initialState.parameters, desiredRetention: initialState.desiredRetention, metricType: initialState.metricType, useAnimation: initialState.useAnimation, useLogarithmic: initialState.useLogarithmic, parameterHistory: initialState.parameterHistory, historyIndex: initialState.historyIndex, simulations: initialState.simulations }),
            }));
        },
        getParametersString: () => {
            return get()
                .simulator.parameters.map((p) => p.toFixed(4))
                .join(", ");
        },
    };
    return slice;
}
