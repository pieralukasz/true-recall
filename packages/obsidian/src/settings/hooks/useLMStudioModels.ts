import { requestUrl } from "obsidian";
import { useEffect, useState } from "preact/hooks";

/** Minimal shape of LM Studio's local `/v1/models` API response. */
interface LMStudioModelsResponse {
	data?: Array<{ id: string }>;
}

export function useLMStudioModels(baseUrl: string, enabled: boolean) {
	const [models, setModels] = useState<string[]>([]);
	const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
		"idle",
	);
	const [refreshKey, setRefreshKey] = useState(0);

	useEffect(() => {
		if (!enabled) {
			setModels([]);
			setStatus("idle");
			return;
		}

		let cancelled = false;
		setStatus("loading");

		requestUrl({ url: `${baseUrl}/models` })
			.then((res) => {
				if (cancelled) return;
				const data = res.json as LMStudioModelsResponse;
				const ids = (data.data ?? []).map((m) => m.id);
				setModels(ids);
				setStatus("ready");
			})
			.catch(() => {
				if (cancelled) return;
				setModels([]);
				setStatus("error");
			});

		return () => {
			cancelled = true;
		};
	}, [baseUrl, enabled, refreshKey]);

	return { models, status, refetch: () => setRefreshKey((k) => k + 1) };
}
