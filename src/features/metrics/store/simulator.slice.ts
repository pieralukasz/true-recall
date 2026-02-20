import { DEFAULT_FSRS_WEIGHTS } from "@shared/constants";
import { DEFAULT_SEQUENCES } from "@features/metrics/ui/simulator/constants";
import type {
	MetricType,
	SequenceSimulation,
} from "@features/metrics/ui/simulator/types";
import type {
	AppState,
	AppStoreDeps,
	SimulatorSliceActions,
	SimulatorSliceState,
} from "@shared/store/types";

const MAX_HISTORY_SIZE = 50;

type SimulatorSlice = SimulatorSliceState & SimulatorSliceActions;

function createInitialState(deps: AppStoreDeps): SimulatorSliceState {
	const settings = deps.getSettings();
	const initialParams = settings.fsrsWeights
		? [...settings.fsrsWeights]
		: [...DEFAULT_FSRS_WEIGHTS];
	const initialRetention = settings.fsrsRequestRetention ?? 0.9;

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

export function createSimulatorSlice(
	set: (fn: (state: AppState) => Partial<AppState>) => void,
	get: () => AppState,
	deps: AppStoreDeps,
): SimulatorSlice {
	const initial = createInitialState(deps);

	const pushParameterHistory = (params: number[]): void => {
		const state = get().simulator;
		const history = state.parameterHistory.slice(0, state.historyIndex + 1);
		history.push([...params]);

		while (history.length > MAX_HISTORY_SIZE) {
			history.shift();
		}

		set((s) => ({
			simulator: {
				...s.simulator,
				parameterHistory: history,
				historyIndex: history.length - 1,
			},
		}));
	};

	const slice: SimulatorSlice = {
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
		setSequences: (sequences: string[]) => {
			set((s) => ({
				simulator: { ...s.simulator, sequences: [...sequences] },
			}));
		},

		setParameter: (index: number, value: number) => {
			const newParams = [...get().simulator.parameters];
			newParams[index] = value;
			pushParameterHistory(newParams);
			set((s) => ({
				simulator: { ...s.simulator, parameters: newParams },
			}));
		},

		setAllParameters: (parameters: number[]) => {
			const newParams = [...parameters];
			pushParameterHistory(newParams);
			set((s) => ({
				simulator: { ...s.simulator, parameters: newParams },
			}));
		},

		setDesiredRetention: (value: number) => {
			set((s) => ({
				simulator: { ...s.simulator, desiredRetention: value },
			}));
		},

		setMetricType: (type: MetricType) => {
			set((s) => ({
				simulator: { ...s.simulator, metricType: type },
			}));
		},

		setUseAnimation: (value: boolean) => {
			set((s) => ({
				simulator: { ...s.simulator, useAnimation: value },
			}));
		},

		setUseLogarithmic: (value: boolean) => {
			set((s) => ({
				simulator: { ...s.simulator, useLogarithmic: value },
			}));
		},

		setSimulations: (simulations: SequenceSimulation[]) => {
			set((s) => ({
				simulator: { ...s.simulator, simulations },
			}));
		},

		resetSequences: () => {
			set((s) => ({
				simulator: { ...s.simulator, sequences: [...DEFAULT_SEQUENCES] },
			}));
		},

		resetParameters: () => {
			const settings = deps.getSettings();
			const initialParams = settings.fsrsWeights
				? [...settings.fsrsWeights]
				: [...DEFAULT_FSRS_WEIGHTS];
			const initialRetention = settings.fsrsRequestRetention ?? 0.9;
			pushParameterHistory(initialParams);
			set((s) => ({
				simulator: {
					...s.simulator,
					parameters: initialParams,
					desiredRetention: initialRetention,
				},
			}));
		},

		undo: () => {
			const state = get().simulator;
			if (state.historyIndex <= 0) return;

			const newIndex = state.historyIndex - 1;
			const prevParams = state.parameterHistory[newIndex];
			if (!prevParams) return;

			set((s) => ({
				simulator: {
					...s.simulator,
					parameters: [...prevParams],
					historyIndex: newIndex,
				},
			}));
		},

		redo: () => {
			const state = get().simulator;
			if (state.historyIndex >= state.parameterHistory.length - 1) return;

			const newIndex = state.historyIndex + 1;
			const nextParams = state.parameterHistory[newIndex];
			if (!nextParams) return;

			set((s) => ({
				simulator: {
					...s.simulator,
					parameters: [...nextParams],
					historyIndex: newIndex,
				},
			}));
		},

		reset: () => {
			const initialState = createInitialState(deps);
			set((s) => ({
				simulator: {
					...s.simulator,
					sequences: initialState.sequences,
					parameters: initialState.parameters,
					desiredRetention: initialState.desiredRetention,
					metricType: initialState.metricType,
					useAnimation: initialState.useAnimation,
					useLogarithmic: initialState.useLogarithmic,
					parameterHistory: initialState.parameterHistory,
					historyIndex: initialState.historyIndex,
					simulations: initialState.simulations,
				},
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
