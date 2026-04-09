import { describe, expect, it } from "vitest";

import {
	formatBrowserTotalCount,
	getBrowserQueryResetKey,
	shouldLoadMoreCards,
} from "../../../src/features/library/ui/browser/helpers/infinite-scroll";
import {
	EMPTY_FILTER,
	type SortConfig,
} from "../../../src/features/library/ui/browser/types";

describe("browser infinite scroll helpers", () => {
	it("should trigger load when near bottom and has more cards", () => {
		const shouldLoad = shouldLoadMoreCards(
			{
				scrollTop: 680,
				clientHeight: 320,
				scrollHeight: 1000,
			},
			true,
			40,
		);

		expect(shouldLoad).toBe(true);
	});

	it("should not trigger load when not near bottom", () => {
		const shouldLoad = shouldLoadMoreCards(
			{
				scrollTop: 200,
				clientHeight: 300,
				scrollHeight: 1000,
			},
			true,
			40,
		);

		expect(shouldLoad).toBe(false);
	});

	it("should not trigger load when there are no more cards", () => {
		const shouldLoad = shouldLoadMoreCards(
			{
				scrollTop: 680,
				clientHeight: 320,
				scrollHeight: 1000,
			},
			false,
			40,
		);

		expect(shouldLoad).toBe(false);
	});

	it("should change reset key when search/filter/sort changes", () => {
		const baseSort: SortConfig = { column: "due", direction: "asc" };
		const keyA = getBrowserQueryResetKey(
			{ ...EMPTY_FILTER, textSearch: "" },
			baseSort,
		);
		const keySearchChanged = getBrowserQueryResetKey(
			{ ...EMPTY_FILTER, textSearch: "biology" },
			baseSort,
		);
		const keySortChanged = getBrowserQueryResetKey(
			{ ...EMPTY_FILTER, textSearch: "" },
			{ column: "due", direction: "desc" },
		);

		expect(keySearchChanged).not.toBe(keyA);
		expect(keySortChanged).not.toBe(keyA);
	});

	it("should keep reset key stable for same query criteria", () => {
		const sort: SortConfig = { column: "state", direction: "asc" };
		const filter = {
			...EMPTY_FILTER,
			textSearch: "mitosis",
			states: ["new"],
		};

		const keyA = getBrowserQueryResetKey(filter, sort);
		const keyB = getBrowserQueryResetKey(
			{
				...EMPTY_FILTER,
				textSearch: "mitosis",
				states: ["new"],
			},
			{ column: "state", direction: "asc" },
		);

		expect(keyA).toBe(keyB);
	});

	it("should format toolbar count as total only", () => {
		expect(formatBrowserTotalCount(5000)).toBe("5000 cards");
	});
});
