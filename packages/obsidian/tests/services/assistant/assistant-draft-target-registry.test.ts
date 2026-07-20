import { describe, expect, it } from "vitest";

import {
	getAssistantDraftTarget,
	registerAssistantDraftTarget,
} from "../../../src/services/assistant/assistant-draft-target-registry";

describe("assistant draft target registry", () => {
	it("addresses an open editor by session id and unregisters it safely", () => {
		let fields = { Front: "Before", Back: "" };
		const dispose = registerAssistantDraftTarget("draft-1", {
			getFields: () => fields,
			applyFields: (next) => {
				fields = next as typeof fields;
			},
		});

		const target = getAssistantDraftTarget("draft-1");
		target?.applyFields({ Front: "After", Back: "Answer" });
		expect(fields).toEqual({ Front: "After", Back: "Answer" });

		dispose();
		expect(getAssistantDraftTarget("draft-1")).toBeNull();
	});
});
