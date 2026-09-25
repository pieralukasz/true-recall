import { DEFAULT_FSRS_WEIGHTS } from "@true-recall/core/constants";
import type { TrueRecallSettings } from "@true-recall/core/types";

import type {
	AppState,
	AppStoreDeps,
	SimulatorSliceActions,
	SimulatorSliceState,
} from "@true-recall/obsidian/store/types";

import { DEFAULT_SEQUENCES } from "../ui/simulator/constants";
import type { MetricType, SequenceSimulation } from "../ui/simulator/types";

const MAX_HISTORY_SIZE = 50;

type SimulatorSlice = SimulatorSliceState & SimulatorSliceActions;

/**
 * Starting point of the simulator: the default preset's weights and desired
 * retention, the same preset the scheduler falls back to (PresetService
 * .getDefaultPreset). The flat fsrsWeights / fsrsRequestRetention settings are
 * a stale legacy mirror and only serve pre-preset settings files.
 */
export function resolveSimulatorBaseline(settings: TrueRecallSettings): {
	parameters: number[];
	desiredRetention: number;
} {
	const presets = settings.fsrsPresets ?? [];
	const preset =
		presets.find((p) => p.id === settings.defaultPresetId) ?? presets[0];
	const weights = preset ? preset.weights : (settings.fsrsWeights ?? null);
	return {
		parameters: weights ? [...weights] : [...DEFAULT_FSRS_WEIGHTS],
		desiredRetention:
			preset?.requestRetention ?? settings.fsrsRequestRetention ?? 0.9,
	};
}

function createInitialState(deps: AppStoreDeps): SimulatorSliceState {
	const { parameters: initialParams, desiredRetention: initialRetention } =
		resolveSimulatorBaseline(deps.getSettings());

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
			const { parameters: initialParams, desiredRetention: initialRetention } =
				resolveSimulatorBaseline(deps.getSettings());
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
