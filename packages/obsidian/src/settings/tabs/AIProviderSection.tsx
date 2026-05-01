import { requestUrl } from "obsidian";
import { useEffect, useState } from "preact/hooks";

import {
	BYOK_MODELS,
	CUSTOM_MODEL_ID,
	DEFAULT_CUSTOM_BASE_URL,
	DEFAULT_LMSTUDIO_BASE_URL,
	TRUERECALL_WEB_URL,
} from "@true-recall/core/constants";
import type { AIProviderType } from "@true-recall/core/types/settings.types";

import {
	Clickable,
	FormCard,
	FormField,
	InfoBlock,
	SelectInput,
	SliderInput,
	TextInput,
} from "@true-recall/obsidian/components";

import { useSettings } from "../hooks/useSettings";

const PROVIDER_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "pro", label: "True Recall Pro (Recommended)" },
	{ value: "openrouter", label: "OpenRouter (BYOK)" },
	{ value: "lmstudio", label: "LM Studio (Local)" },
	{ value: "custom", label: "Custom Provider (Self-hosted)" },
];

const MODEL_OPTIONS = [
	...BYOK_MODELS.map((m) => ({
		value: m.id,
		label: `${m.name} (${m.provider})${m.recommended ? " — Recommended" : ""}`,
	})),
	{ value: CUSTOM_MODEL_ID, label: "Custom..." },
];

function getModelDefault(modelId: string): number {
	return BYOK_MODELS.find((m) => m.id === modelId)?.defaultTemperature ?? 0.7;
}

type KeyStatus = "idle" | "checking" | "valid" | "invalid" | "error";

let cachedKey: string | undefined;
let cachedStatus: KeyStatus = "idle";

async function verifyProKey(key: string): Promise<KeyStatus> {
	try {
		const res = await requestUrl({
			url: "https://ai.truerecall.app/key/info",
			headers: { Authorization: `Bearer ${key}` },
		});
		return res.status === 200 ? "valid" : "invalid";
	} catch (error) {
		console.error("[True Recall] Pro key verification failed:", error);
		return "error";
	}
}

function useLMStudioModels(baseUrl: string, enabled: boolean) {
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
				const data = res.json;
				const ids = (data.data ?? []).map((m: { id: string }) => m.id);
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

export function AIProviderSection() {
	const { settings, save } = useSettings();

	const initialStatus =
		settings.proKey && settings.proKey === cachedKey ? cachedStatus : "idle";
	const [keyStatus, setKeyStatus] = useState<KeyStatus>(initialStatus);

	const currentModel = settings.aiModel || BYOK_MODELS[0]?.id || "";
	const modelDefault = getModelDefault(currentModel);
	const effectiveTemp = settings.aiTemperature ?? modelDefault;

	const lmState = useLMStudioModels(
		settings.lmStudioBaseUrl || DEFAULT_LMSTUDIO_BASE_URL,
		settings.providerType === "lmstudio",
	);

	useEffect(() => {
		if (!settings.proKey) {
			cachedKey = undefined;
			cachedStatus = "idle";
			setKeyStatus("idle");
			return;
		}
		if (settings.proKey === cachedKey && cachedStatus !== "idle") {
			setKeyStatus(cachedStatus);
			return;
		}
		setKeyStatus("checking");
		const key = settings.proKey;
		let stale = false;
		verifyProKey(key)
			.then((status) => {
				if (stale) return;
				cachedKey = key;
				cachedStatus = status;
				setKeyStatus(status);
			})
			.catch(() => {
				if (stale) return;
				setKeyStatus("error");
			});
		return () => {
			stale = true;
		};
	}, [settings.proKey]);

	return (
		<FormCard>
			<FormField
				name="AI Provider"
				description="Choose where AI requests are routed"
			>
				<SelectInput
					value={settings.providerType}
					onChange={(v) => void save({ providerType: v as AIProviderType })}
					options={PROVIDER_OPTIONS}
				/>
			</FormField>

			{settings.providerType === "pro" && (
				<>
					<div class="ep:text-ui-smaller ep:text-obs-muted ep:leading-relaxed ep:pb-2 ep:mb-2 ep:border-b ep:border-obs-modifier-border">
						<p class="ep:font-medium ep:text-obs-normal">
							Zero setup, optimized results
						</p>
						<p class="ep:mt-1">
							Optimized prompts and model selection managed server-side. AI
							budget included with your subscription.
						</p>
					</div>

					<FormField
						name="Pro Key"
						description={
							<span>
								Get your key at{" "}
								<a
									href={`${TRUERECALL_WEB_URL}/dashboard`}
									class="ep:text-obs-accent"
								>
									truerecall.app/dashboard
								</a>
							</span>
						}
					>
						<TextInput
							value={settings.proKey ?? ""}
							onChange={(v) =>
								void save({
									proKey: v.trim().length > 0 ? v.trim() : undefined,
								})
							}
							type="password"
							placeholder="Paste key from dashboard"
							class="ep:w-[300px]"
						/>
					</FormField>
					{keyStatus === "checking" && <InfoBlock>Verifying key…</InfoBlock>}
					{keyStatus === "valid" && (
						<InfoBlock>Active — AI routed via True Recall servers.</InfoBlock>
					)}
					{keyStatus === "invalid" && (
						<InfoBlock class="ep:text-obs-error">
							Invalid key — check your key on the{" "}
							<a
								href={`${TRUERECALL_WEB_URL}/dashboard`}
								class="ep:text-obs-accent"
							>
								dashboard
							</a>
							.
						</InfoBlock>
					)}
					{keyStatus === "error" && (
						<InfoBlock>
							Could not verify key — check your internet connection and try
							again.
						</InfoBlock>
					)}
				</>
			)}

			{settings.providerType === "openrouter" && (
				<>
					<div class="ep:text-ui-smaller ep:text-obs-muted ep:leading-relaxed ep:pb-2 ep:mb-2 ep:border-b ep:border-obs-modifier-border">
						<p class="ep:font-medium ep:text-obs-normal">
							Bring your own API key
						</p>
						<p class="ep:mt-1">
							You pay OpenRouter directly per token. Full control over model
							selection.
						</p>
					</div>

					<FormField
						name="OpenRouter API key"
						description="Your own API key — you pay OpenRouter directly per token."
					>
						<TextInput
							value={settings.openRouterApiKey}
							onChange={(v) => void save({ openRouterApiKey: v })}
							type="password"
							placeholder="Enter API key"
							class="ep:w-[300px]"
						/>
					</FormField>

					<FormField
						name="Model"
						description="Reasoning model used for flashcard generation."
					>
						<SelectInput
							value={currentModel}
							onChange={(v) =>
								void save({ aiModel: v, aiTemperature: undefined })
							}
							options={MODEL_OPTIONS}
						/>
					</FormField>
					{currentModel === CUSTOM_MODEL_ID && (
						<FormField
							name="Custom Model ID"
							description="Enter any OpenRouter-compatible model ID."
						>
							<TextInput
								value={settings.customAiModel ?? ""}
								onChange={(v) => void save({ customAiModel: v })}
								placeholder="e.g. openai/gpt-4o-mini"
								class="ep:w-[300px]"
							/>
						</FormField>
					)}

					<FormField
						name="Temperature"
						description={
							<span>
								Controls randomness.{" "}
								{settings.aiTemperature != null ? (
									<Clickable
										class="ep:text-obs-accent ep:text-ui-smaller"
										onClick={() => void save({ aiTemperature: undefined })}
									>
										Reset to model default ({modelDefault})
									</Clickable>
								) : (
									<span class="ep:text-obs-muted">
										Using model default ({modelDefault})
									</span>
								)}
							</span>
						}
					>
						<SliderInput
							value={effectiveTemp}
							onChange={(v) => void save({ aiTemperature: v })}
							min={0}
							max={2}
							step={0.1}
							formatTooltip={(v) => v.toFixed(1)}
						/>
					</FormField>
				</>
			)}

			{settings.providerType === "lmstudio" && (
				<>
					<div class="ep:text-ui-smaller ep:text-obs-muted ep:leading-relaxed ep:pb-2 ep:mb-2 ep:border-b ep:border-obs-modifier-border">
						<p class="ep:font-medium ep:text-obs-normal">
							Run models locally with LM Studio
						</p>
						<p class="ep:mt-1">
							Models are auto-discovered from your running LM Studio server.{" "}
							<a href="https://lmstudio.ai" class="ep:text-obs-accent">
								Download LM Studio
							</a>
						</p>
					</div>

					<FormField name="Base URL" description="LM Studio server endpoint">
						<TextInput
							value={settings.lmStudioBaseUrl || DEFAULT_LMSTUDIO_BASE_URL}
							onChange={(v) => void save({ lmStudioBaseUrl: v })}
							placeholder="http://localhost:1234/v1"
							class="ep:w-[300px]"
						/>
					</FormField>

					<FormField
						name="Model"
						description="Select from models loaded in LM Studio"
					>
						{lmState.status === "loading" && (
							<InfoBlock>Discovering models…</InfoBlock>
						)}
						{lmState.status === "error" && (
							<>
								<InfoBlock class="ep:text-obs-error">
									Can't connect to LM Studio — is the server running?
								</InfoBlock>
								<TextInput
									value={settings.lmStudioModel}
									onChange={(v) => void save({ lmStudioModel: v })}
									placeholder="e.g. llama-3.2-3b-instruct"
									class="ep:w-[300px] ep:mt-2"
								/>
							</>
						)}
						{lmState.status === "ready" && lmState.models.length > 0 && (
							<>
								<SelectInput
									value={settings.lmStudioModel}
									onChange={(v) => void save({ lmStudioModel: v })}
									options={lmState.models.map((id) => ({
										value: id,
										label: id,
									}))}
								/>
								<Clickable
									class="ep:text-obs-accent ep:text-ui-smaller ep:mt-1"
									onClick={lmState.refetch}
								>
									Refresh models
								</Clickable>
							</>
						)}
						{lmState.status === "ready" && lmState.models.length === 0 && (
							<>
								<InfoBlock>
									No models found — load a model in LM Studio first.
								</InfoBlock>
								<TextInput
									value={settings.lmStudioModel}
									onChange={(v) => void save({ lmStudioModel: v })}
									placeholder="e.g. llama-3.2-3b-instruct"
									class="ep:w-[300px] ep:mt-2"
								/>
							</>
						)}
					</FormField>

					<FormField
						name="API Key"
						description="Optional — only needed if you enabled authentication in LM Studio"
					>
						<TextInput
							value={settings.lmStudioApiKey ?? ""}
							onChange={(v) =>
								void save({
									lmStudioApiKey: v.trim().length > 0 ? v.trim() : undefined,
								})
							}
							type="password"
							placeholder="Leave empty if not required"
							class="ep:w-[300px]"
						/>
					</FormField>

					<FormField name="Temperature" description="Controls randomness (0–2)">
						<SliderInput
							value={settings.lmStudioTemperature ?? 0.7}
							onChange={(v) => void save({ lmStudioTemperature: v })}
							min={0}
							max={2}
							step={0.1}
							formatTooltip={(v) => v.toFixed(1)}
						/>
					</FormField>
				</>
			)}

			{settings.providerType === "custom" && (
				<>
					<div class="ep:text-ui-smaller ep:text-obs-muted ep:leading-relaxed ep:pb-2 ep:mb-2 ep:border-b ep:border-obs-modifier-border">
						<p class="ep:font-medium ep:text-obs-normal">
							Self-hosted / local models
						</p>
						<p class="ep:mt-1">
							Connect to Ollama, LM Studio, vLLM, or any OpenAI-compatible
							endpoint.
						</p>
					</div>

					<FormField
						name="Base URL"
						description="OpenAI-compatible API endpoint"
					>
						<TextInput
							value={settings.customBaseUrl || DEFAULT_CUSTOM_BASE_URL}
							onChange={(v) => void save({ customBaseUrl: v })}
							placeholder="http://localhost:11434/v1"
							class="ep:w-[300px]"
						/>
					</FormField>

					<FormField
						name="Model Name"
						description="The model identifier (e.g. llama3, mistral)"
					>
						<TextInput
							value={settings.customModel}
							onChange={(v) => void save({ customModel: v })}
							placeholder="e.g. llama3"
							class="ep:w-[300px]"
						/>
					</FormField>

					<FormField
						name="API Key"
						description="Optional — many local setups don't need authentication"
					>
						<TextInput
							value={settings.customApiKey ?? ""}
							onChange={(v) =>
								void save({
									customApiKey: v.trim().length > 0 ? v.trim() : undefined,
								})
							}
							type="password"
							placeholder="Leave empty if not required"
							class="ep:w-[300px]"
						/>
					</FormField>

					<FormField name="Temperature" description="Controls randomness (0–2)">
						<SliderInput
							value={settings.customTemperature ?? 0.7}
							onChange={(v) => void save({ customTemperature: v })}
							min={0}
							max={2}
							step={0.1}
							formatTooltip={(v) => v.toFixed(1)}
						/>
					</FormField>
				</>
			)}
		</FormCard>
	);
}
