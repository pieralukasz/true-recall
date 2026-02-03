import { BaseStateManager } from "./base.state";
import type { SimulatorState, MetricType, SequenceSimulation } from "../ui/simulator/types";
import { DEFAULT_SEQUENCES } from "../ui/simulator/constants";
import { DEFAULT_FSRS_WEIGHTS } from "../constants";

const MAX_HISTORY_SIZE = 50;

interface SimulatorInitConfig {
	weights: number[] | null;
	retention: number;
}

function createInitialState(config?: SimulatorInitConfig): SimulatorState {
	const initialParams = config?.weights ? [...config.weights] : [...DEFAULT_FSRS_WEIGHTS];
	const initialRetention = config?.retention ?? 0.9;
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

export class SimulatorStateManager extends BaseStateManager<SimulatorState> {
	private initialConfig?: SimulatorInitConfig;

	constructor(config?: SimulatorInitConfig) {
		super(createInitialState(config));
		this.initialConfig = config;
	}

	getSequences(): string[] {
		return [...this.state.sequences];
	}

	getParameters(): number[] {
		return [...this.state.parameters];
	}

	getDesiredRetention(): number {
		return this.state.desiredRetention;
	}

	getMetricType(): MetricType {
		return this.state.metricType;
	}

	getUseAnimation(): boolean {
		return this.state.useAnimation;
	}

	getUseLogarithmic(): boolean {
		return this.state.useLogarithmic;
	}

	getSimulations(): SequenceSimulation[] {
		return this.state.simulations;
	}

	canUndo(): boolean {
		return this.state.historyIndex > 0;
	}

	canRedo(): boolean {
		return this.state.historyIndex < this.state.parameterHistory.length - 1;
	}

	setSequences(sequences: string[]): void {
		this.setState({ sequences: [...sequences] });
	}

	setParameter(index: number, value: number): void {
		const newParams = [...this.state.parameters];
		newParams[index] = value;
		this.pushParameterHistory(newParams);
		this.setState({ parameters: newParams });
	}

	setAllParameters(parameters: number[]): void {
		const newParams = [...parameters];
		this.pushParameterHistory(newParams);
		this.setState({ parameters: newParams });
	}

	setDesiredRetention(value: number): void {
		this.setState({ desiredRetention: value });
	}

	setMetricType(type: MetricType): void {
		this.setState({ metricType: type });
	}

	setUseAnimation(value: boolean): void {
		this.setState({ useAnimation: value });
	}

	setUseLogarithmic(value: boolean): void {
		this.setState({ useLogarithmic: value });
	}

	setSimulations(simulations: SequenceSimulation[]): void {
		this.setState({ simulations });
	}

	resetSequences(): void {
		this.setState({ sequences: [...DEFAULT_SEQUENCES] });
	}

	resetParameters(): void {
		const initialParams = this.initialConfig?.weights
			? [...this.initialConfig.weights]
			: [...DEFAULT_FSRS_WEIGHTS];
		const initialRetention = this.initialConfig?.retention ?? 0.9;
		this.pushParameterHistory(initialParams);
		this.setState({
			parameters: initialParams,
			desiredRetention: initialRetention,
		});
	}

	undo(): void {
		if (!this.canUndo()) return;

		const newIndex = this.state.historyIndex - 1;
		const prevParams = this.state.parameterHistory[newIndex];
		if (!prevParams) return;
		this.setState({
			parameters: [...prevParams],
			historyIndex: newIndex,
		});
	}

	redo(): void {
		if (!this.canRedo()) return;

		const newIndex = this.state.historyIndex + 1;
		const nextParams = this.state.parameterHistory[newIndex];
		if (!nextParams) return;
		this.setState({
			parameters: [...nextParams],
			historyIndex: newIndex,
		});
	}

	reset(): void {
		this.replaceState(createInitialState());
	}

	/** Clears any redo history when new changes are made */
	private pushParameterHistory(params: number[]): void {
		const history = this.state.parameterHistory.slice(0, this.state.historyIndex + 1);
		history.push([...params]);

		while (history.length > MAX_HISTORY_SIZE) {
			history.shift();
		}

		this.setState({
			parameterHistory: history,
			historyIndex: history.length - 1,
		});
	}

	getParametersString(): string {
		return this.state.parameters.map((p) => p.toFixed(4)).join(", ");
	}
}
