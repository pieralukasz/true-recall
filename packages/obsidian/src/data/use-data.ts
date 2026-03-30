import { type ReadonlySignal, signal } from "@preact/signals";
import type { DataLayer, QueryKey } from "./data-layer";

let _dl: DataLayer | null = null;
const EMPTY = signal(undefined);

export function setDataLayer(dl: DataLayer): void {
	_dl = dl;
}

export function getDataLayer(): DataLayer {
	if (!_dl) throw new Error("DataLayer not initialized");
	return _dl;
}

export function useQuery<T>(key: QueryKey): ReadonlySignal<T> {
	if (!_dl) return EMPTY as ReadonlySignal<T>;
	return _dl.signal<T>(key) ?? (EMPTY as ReadonlySignal<T>);
}
