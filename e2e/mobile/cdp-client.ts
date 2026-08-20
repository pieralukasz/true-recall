/**
 * Minimal Chrome DevTools Protocol client for the Obsidian Android WebView.
 * Connects over an adb-forwarded socket and evaluates JS in the page.
 */

export interface CdpClient {
	evaluate<T = unknown>(expression: string): Promise<T>;
	close(): void;
}

export async function connectCdp(
	port: number,
	pageId: string,
	timeoutMs = 15_000,
): Promise<CdpClient> {
	const url = `ws://localhost:${port}/devtools/page/${pageId}`;
	const ws = new WebSocket(url);

	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`CDP connect timeout: ${url}`)),
			timeoutMs,
		);
		ws.onopen = () => {
			clearTimeout(timer);
			resolve();
		};
		ws.onerror = () => {
			clearTimeout(timer);
			reject(new Error(`CDP connect failed: ${url}`));
		};
	});

	let nextId = 1;
	const pending = new Map<
		number,
		{ resolve: (v: unknown) => void; reject: (e: Error) => void }
	>();

	ws.onmessage = (event) => {
		const msg = JSON.parse(String(event.data)) as {
			id?: number;
			result?: {
				result?: { value?: unknown };
				exceptionDetails?: { text?: string; exception?: { description?: string } };
			};
		};
		if (msg.id === undefined) return;
		const waiter = pending.get(msg.id);
		if (!waiter) return;
		pending.delete(msg.id);
		const details = msg.result?.exceptionDetails;
		if (details) {
			waiter.reject(
				new Error(
					`page exception: ${details.exception?.description ?? details.text ?? "unknown"}`,
				),
			);
			return;
		}
		waiter.resolve(msg.result?.result?.value);
	};

	return {
		evaluate<T>(expression: string): Promise<T> {
			const id = nextId++;
			const promise = new Promise<T>((resolve, reject) => {
				pending.set(id, {
					resolve: resolve as (v: unknown) => void,
					reject,
				});
				setTimeout(() => {
					if (pending.delete(id)) {
						reject(new Error("CDP evaluate timeout (60s)"));
					}
				}, 60_000);
			});
			ws.send(
				JSON.stringify({
					id,
					method: "Runtime.evaluate",
					params: { expression, returnByValue: true, awaitPromise: true },
				}),
			);
			return promise;
		},
		close() {
			ws.close();
		},
	};
}
