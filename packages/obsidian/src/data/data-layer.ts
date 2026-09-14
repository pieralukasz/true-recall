import { type ReadonlySignal, signal } from "@preact/signals";

import { type AppError, toAppError } from "@true-recall/core/errors";

import { reportError } from "@true-recall/obsidian/services/errors";

export type QueryKey = string;
type QueryGroup = string;

interface QueryEntry<T = unknown> {
	sig: { value: T };
	readonly: ReadonlySignal<T>;
	error: { value: AppError | null };
	readonlyError: ReadonlySignal<AppError | null>;
	loader: () => T;
	groups: QueryGroup[];
}

export class DataLayer {
	private queries = new Map<QueryKey, QueryEntry>();
	private batchDepth = 0;
	private pendingGroups = new Set<QueryGroup>();

	register<T>(
		key: QueryKey,
		loader: () => T,
		groups: QueryGroup[],
	): ReadonlySignal<T> {
		const existing = this.queries.get(key);
		if (existing) return existing.readonly as ReadonlySignal<T>;

		const initial = loader();
		const sig = signal<T>(initial);
		const error = signal<AppError | null>(null);

		this.queries.set(key, {
			sig,
			readonly: sig,
			error,
			readonlyError: error,
			loader,
			groups,
		});
		return sig;
	}

	get<T>(key: QueryKey): T | undefined {
		const entry = this.queries.get(key);
		if (!entry) return undefined;
		return entry.sig.value as T;
	}

	signal<T>(key: QueryKey): ReadonlySignal<T> | undefined {
		return this.queries.get(key)?.readonly as ReadonlySignal<T> | undefined;
	}

	errorSignal(key: QueryKey): ReadonlySignal<AppError | null> | undefined {
		return this.queries.get(key)?.readonlyError;
	}

	batch<R>(fn: () => R): R {
		this.batchDepth++;
		try {
			return fn();
		} finally {
			this.batchDepth--;
			if (this.batchDepth === 0 && this.pendingGroups.size > 0) {
				const groups = [...this.pendingGroups];
				this.pendingGroups.clear();
				this.reloadByGroups(groups);
			}
		}
	}

	mutate<R>(groups: QueryGroup[], fn: () => R): R {
		return this.batch(() => {
			const result = fn();
			this.invalidateGroups(groups);
			return result;
		});
	}

	patch<T>(key: QueryKey, patcher: (current: T) => T | undefined): void {
		const entry = this.queries.get(key) as QueryEntry<T> | undefined;
		if (!entry) return;

		const patched = patcher(entry.sig.value);
		if (patched === undefined) {
			this.reload(key);
			return;
		}
		entry.sig.value = patched;
		entry.error.value = null;
	}

	invalidateGroups(groups: QueryGroup[]): void {
		if (this.batchDepth > 0) {
			for (const g of groups) this.pendingGroups.add(g);
			return;
		}
		this.reloadByGroups(groups);
	}

	private reloadByGroups(groups: QueryGroup[]): void {
		for (const [key, entry] of this.queries) {
			for (const g of groups) {
				if (entry.groups.includes(g)) {
					this.reload(key);
					break;
				}
			}
		}
	}

	private reload(key: QueryKey): void {
		const entry = this.queries.get(key);
		if (!entry) return;
		try {
			entry.sig.value = entry.loader();
			entry.error.value = null;
		} catch (e) {
			const error = toAppError(e);
			entry.error.value = error;
			reportError(error, { origin: "data-layer", context: { queryKey: key } });
		}
	}

	dispose(): void {
		this.queries.clear();
	}
}
