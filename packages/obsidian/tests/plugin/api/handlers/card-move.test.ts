import { describe, expect, it, vi } from "vitest";

import { handleMoveCard } from "../../../../src/plugin/api/handlers/card-actions";

function createResponse() {
	let status = 0;
	let body: unknown;
	return {
		response: {
			writeHead(nextStatus: number) {
				status = nextStatus;
			},
			end(data?: string) {
				body = data ? JSON.parse(data) : undefined;
			},
		},
		get status() {
			return status;
		},
		get body() {
			return body as { data?: Record<string, unknown>; error?: string };
		},
	};
}

function createRequest(body: unknown) {
	const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
	const request = {
		on(event: string, listener: (...args: unknown[]) => void) {
			listeners.set(event, [...(listeners.get(event) ?? []), listener]);
			return request;
		},
		destroy() {},
	};

	queueMicrotask(() => {
		for (const listener of listeners.get("data") ?? []) {
			listener(Buffer.from(JSON.stringify(body)));
		}
		for (const listener of listeners.get("end") ?? []) listener();
	});

	return request;
}

function createContext(options?: {
	cardExists?: boolean;
	targetExists?: boolean;
}) {
	const moveCard = vi.fn(async () => true);
	const getSourceNoteUid = vi.fn(async () => "target-uid");
	return {
		moveCard,
		getSourceNoteUid,
		context: {
			plugin: {
				isStoreReady: () => true,
				cardStore: {
					cards: {
						get: () =>
							options?.cardExists === false
								? undefined
								: { id: "card-1", sourceUid: "source-uid" },
					},
				},
				app: {
					vault: {
						getAbstractFileByPath: () =>
							options?.targetExists === false ? null : { extension: "md" },
					},
				},
				flashcardManager: {
					moveCard,
					getFrontmatterService: () => ({ getSourceNoteUid }),
				},
			},
		},
	};
}

describe("move card API", () => {
	it("moves a card and returns the target note link", async () => {
		const result = createResponse();
		const { context, moveCard } = createContext();

		await handleMoveCard(
			createRequest({ target_path: "Folder/Target.md" }) as never,
			result.response as never,
			context as never,
			{ id: "card-1" },
		);

		expect(moveCard).toHaveBeenCalledWith("card-1", "Folder/Target.md");
		expect(result.status).toBe(200);
		expect(result.body.data).toMatchObject({
			moved: true,
			cardId: "card-1",
			targetPath: "Folder/Target.md",
			previousSourceUid: "source-uid",
			sourceUid: "target-uid",
		});
	});

	it("rejects a missing target path", async () => {
		const result = createResponse();
		const { context, moveCard } = createContext();

		await handleMoveCard(
			createRequest({}) as never,
			result.response as never,
			context as never,
			{ id: "card-1" },
		);

		expect(result.status).toBe(400);
		expect(moveCard).not.toHaveBeenCalled();
	});

	it("returns 404 when the card does not exist", async () => {
		const result = createResponse();
		const { context, moveCard } = createContext({ cardExists: false });

		await handleMoveCard(
			createRequest({ target_path: "Folder/Target.md" }) as never,
			result.response as never,
			context as never,
			{ id: "missing" },
		);

		expect(result.status).toBe(404);
		expect(moveCard).not.toHaveBeenCalled();
	});

	it("returns 404 when the target note does not exist", async () => {
		const result = createResponse();
		const { context, moveCard } = createContext({ targetExists: false });

		await handleMoveCard(
			createRequest({ target_path: "Missing.md" }) as never,
			result.response as never,
			context as never,
			{ id: "card-1" },
		);

		expect(result.status).toBe(404);
		expect(moveCard).not.toHaveBeenCalled();
	});
});
