import { describe, expect, it } from "vitest";

import { buildChatInstructions } from "@true-recall/obsidian/features/ai-chat/engine/chat-prompt";
import { describeModel } from "@true-recall/obsidian/features/ai-chat/engine/chat-transport";
import {
	foldText,
	prepareNote,
	queryTerms,
	type SearchableNote,
	searchNotes as searchRaw,
	snippetsFor,
} from "@true-recall/obsidian/features/ai-chat/engine/vault-search";

const note = (over: Partial<SearchableNote>): SearchableNote => ({
	path: `${over.title ?? "n"}.md`,
	title: "n",
	aliases: [],
	tags: [],
	headings: [],
	text: "",
	mtime: 0,
	...over,
});

const searchNotes = (list: SearchableNote[], query: string, limit: number) =>
	searchRaw(list.map(prepareNote), query, limit);

const notes = [
	note({
		title: "Pamięć w przeglądarce",
		path: "Web/Pamięć w przeglądarce.md",
		tags: ["#web"],
		text: "localStorage działa synchronicznie. IndexedDB jest asynchroniczne i przyjmuje obiekty.",
	}),
	note({
		title: "Service worker",
		path: "Web/Service worker.md",
		headings: ["Zdarzenia"],
		text: "Service worker obsługuje fetch, push i sync. Nie ma dostępu do DOM ani localStorage.",
	}),
	note({
		title: "Prawo Ohma",
		path: "Elektronika/Prawo Ohma.md",
		text: "U = R * I",
	}),
];

describe("vault search", () => {
	it("folds Polish diacritics, including ł", () => {
		expect(foldText("Zażółć Łódź")).toBe("zazolc lodz");
		expect(queryTerms("Pamięć, przeglądarka?")).toEqual([
			"pamiec",
			"przegladarka",
		]);
	});

	it("matches without diacritics and ranks title hits first", () => {
		const { total, hits } = searchNotes(notes, "pamiec przegladarce", 10);
		expect(total).toBe(1);
		expect(hits[0]?.path).toBe("Web/Pamięć w przeglądarce.md");
	});

	it("needs every term somewhere in the note", () => {
		expect(searchNotes(notes, "localStorage", 10).total).toBe(2);
		expect(searchNotes(notes, "localStorage ohm", 10).total).toBe(0);
	});

	it("ranks a title match above a body-only match", () => {
		const { hits } = searchNotes(notes, "service worker", 10);
		expect(hits[0]?.title).toBe("Service worker");
	});

	it("returns excerpts from the original text, diacritics kept", () => {
		const [snippet] = snippetsFor(notes[0]?.text ?? "", ["indexeddb"]);
		expect(snippet).toContain("IndexedDB jest asynchroniczne");
		expect(snippetsFor("Zażółć gęślą jaźń", ["gesla"])[0]).toBe(
			"Zażółć gęślą jaźń",
		);
	});

	it("keeps excerpts short and marks cut text", () => {
		const long = `${"a ".repeat(200)}szukane ${"b ".repeat(200)}`;
		const [snippet] = snippetsFor(long, ["szukane"]);
		expect(snippet?.startsWith("…")).toBe(true);
		expect(snippet?.endsWith("…")).toBe(true);
		expect(snippet?.length).toBeLessThan(220);
	});

	it("honours the result limit but reports the total", () => {
		const many = Array.from({ length: 15 }, (_, i) =>
			note({ title: `Notatka ${i}`, text: "wspólne słowo" }),
		);
		const result = searchNotes(many, "wspolne", 10);
		expect(result.total).toBe(15);
		expect(result.hits).toHaveLength(10);
	});
});

describe("chat prompt", () => {
	const base = {
		context: {},
		noteTypes: [],
		webSearch: false,
		userInstructions: "",
		decisions: "",
		today: "2026-10-10",
	};

	it("tells the model it can search the vault and which numbers are due today", () => {
		const prompt = buildChatInstructions(base);
		expect(prompt).toContain("search_notes");
		expect(prompt).toContain("queueToday");
	});

	it("names the model when known", () => {
		expect(
			buildChatInstructions({
				...base,
				model: describeModel({
					providerType: "openrouter",
					model: "google/gemini-3.7-flash",
				}),
			}),
		).toContain("google/gemini-3.7-flash via openrouter");
		expect(describeModel({ providerType: "pro", model: "auto" })).toContain(
			"True Recall Pro",
		);
	});
});
