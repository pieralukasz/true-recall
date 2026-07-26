import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDebouncedCommit } from "@true-recall/plugins/shared/debounced-commit";

const DELAY = 150;

describe("createDebouncedCommit", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("commits only the last value once the source goes quiet", () => {
		const commit = vi.fn();
		const debounced = createDebouncedCommit<string>(commit, DELAY);

		debounced.push("P");
		debounced.push("Pr");
		debounced.push("Prz");
		vi.advanceTimersByTime(DELAY - 1);
		expect(commit).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(commit).toHaveBeenCalledExactlyOnceWith("Prz");
	});

	it("reports a pending edit until it is committed", () => {
		const debounced = createDebouncedCommit<string>(vi.fn(), DELAY);
		expect(debounced.hasPending()).toBe(false);

		debounced.push("draft");
		expect(debounced.hasPending()).toBe(true);

		vi.advanceTimersByTime(DELAY);
		expect(debounced.hasPending()).toBe(false);
	});

	it("flushes immediately without waiting out the delay", () => {
		const commit = vi.fn();
		const debounced = createDebouncedCommit<string>(commit, DELAY);

		debounced.push("typed");
		debounced.flush();

		expect(commit).toHaveBeenCalledExactlyOnceWith("typed");

		// The cancelled timer must not fire a second time.
		vi.advanceTimersByTime(DELAY);
		expect(commit).toHaveBeenCalledOnce();
	});

	it("ignores a flush with nothing pending", () => {
		const commit = vi.fn();
		const debounced = createDebouncedCommit<string>(commit, DELAY);

		debounced.flush();
		debounced.flush();

		expect(commit).not.toHaveBeenCalled();
	});

	it("drops the pending value on cancel", () => {
		const commit = vi.fn();
		const debounced = createDebouncedCommit<string>(commit, DELAY);

		debounced.push("abandoned");
		debounced.cancel();
		vi.advanceTimersByTime(DELAY);

		expect(commit).not.toHaveBeenCalled();
		expect(debounced.hasPending()).toBe(false);
	});

	it("keeps working after a flush", () => {
		const commit = vi.fn();
		const debounced = createDebouncedCommit<string>(commit, DELAY);

		debounced.push("first");
		debounced.flush();
		debounced.push("second");
		vi.advanceTimersByTime(DELAY);

		expect(commit).toHaveBeenNthCalledWith(1, "first");
		expect(commit).toHaveBeenNthCalledWith(2, "second");
	});
});
