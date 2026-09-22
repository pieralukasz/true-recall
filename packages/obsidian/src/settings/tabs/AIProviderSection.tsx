import { requestUrl } from "obsidian";
import { useEffect, useState } from "preact/hooks";

import {
	BYOK_MODELS,
	CUSTOM_MODEL_ID,
	DEFAULT_CUSTOM_BASE_URL,
	DEFAULT_LMSTUDIO_BASE_URL,
	TRUERECALL_DASHBOARD_URL,
} from "@true-recall/core/constants";
import type { AIProviderType } from "@true-recall/core/types/settings.types";
import { withPluginUtm } from "@true-recall/core/utils";

import {
	Clickable,
	FormCard,
	FormField,
	InfoBlock,
	SelectInput,
	SliderInput,
	TextInput,
} from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";

import { beginAITrial } from "../../features/onboarding/ai-onboarding";
import { useLMStudioModels } from "../hooks/useLMStudioModels";
import { useSettings } from "../hooks/useSettings";

const PROVIDER_OPTIONS: Array<{ value: string; label: string }> = [
	{
		value: "pro",
		get label() {
			return t("True Recall Pro (Recommended)");
		},
	},
	{
		value: "openrouter",
		get label() {
			return t("OpenRouter (BYOK)");
		},
	},
	{
		value: "lmstudio",
		get label() {
			return t("LM Studio (Local)");
		},
	},
	{
		value: "custom",
		get label() {
			return t("Custom Provider (Self-hosted)");
		},
	},
];

const MODEL_OPTIONS = [
	...BYOK_MODELS.map((m) => ({
		value: m.id,
		label: `${m.name} (${m.provider})${m.recommended ? " — Recommended" : ""}`,
	})),
	{
		value: CUSTOM_MODEL_ID,
		get label() {
			return t("Custom...");
		},
	},
];

const GRADING_MODEL_OPTIONS = [
	{
		value: "",
		get label() {
			return t("Same as main model");
		},
	},
	...BYOK_MODELS.map((m) => ({
		value: m.id,
		label: `${m.name} (${m.provider})`,
	})),
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

export function AIProviderSection() {
	const { settings, save, plugin } = useSettings();

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
		<FormCard title={t("AI provider")}>
			<FormField
				name={t("Provider")}
				description={t("Choose where AI requests are routed")}
			>
				<SelectInput
					value={settings.providerType}
					onChange={(v) => void save({ providerType: v as AIProviderType })}
					options={PROVIDER_OPTIONS}
				/>
			</FormField>

			{settings.providerType === "pro" && (
				<>
					<FormField
						name={
							settings.proKey
								? t("Your first learning session")
								: t("Try AI for free")
						}
						description={t(
							"Connect your account and try generation, image cards and answer feedback. No payment card needed.",
						)}
					>
						<Clickable
							class="mod-cta"
							onClick={() => void beginAITrial(plugin)}
						>
							{settings.proKey
								? t("Open learning guide")
								: t("Try AI for free")}
						</Clickable>
					</FormField>
					<InfoBlock title={t("Zero setup, optimized results")}>
						{t(
							"Optimized prompts and model selection managed server-side. AI budget included with your subscription.",
						)}
					</InfoBlock>

					<FormField
						name={t("Pro Key")}
						description={
							<span>
								{t("Get your key at")}{" "}
								<a
									href={withPluginUtm(
										TRUERECALL_DASHBOARD_URL,
										"settings-ai-provider",
									)}
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
							placeholder={t("Paste key from dashboard")}
							class="tr-control"
						/>
					</FormField>
					{keyStatus === "checking" && (
						<InfoBlock>{t("Verifying key…")}</InfoBlock>
					)}
					{keyStatus === "valid" && (
						<InfoBlock>
							{t("Active — AI routed via True Recall servers.")}
						</InfoBlock>
					)}
					{keyStatus === "invalid" && (
						<InfoBlock class="ep:text-obs-error">
							{t("Invalid key — check your key on the")}{" "}
							<a
								href={withPluginUtm(
									TRUERECALL_DASHBOARD_URL,
									"settings-ai-provider",
								)}
								class="ep:text-obs-accent"
							>
								{t("dashboard")}
							</a>
							.
						</InfoBlock>
					)}
					{keyStatus === "error" && (
						<InfoBlock>
							{t(
								"Could not verify key — check your internet connection and try again.",
							)}
						</InfoBlock>
					)}
				</>
			)}

			{settings.providerType === "openrouter" && (
				<>
					<InfoBlock title={t("Bring your own API key")}>
						{t(
							"You pay OpenRouter directly per token. Full control over model selection.",
						)}
					</InfoBlock>

					<FormField
						name={t("OpenRouter API key")}
						description={t("Your own API key.")}
					>
						<TextInput
							value={settings.openRouterApiKey}
							onChange={(v) => void save({ openRouterApiKey: v })}
							type="password"
							placeholder={t("Enter API key")}
							class="tr-control"
						/>
					</FormField>

					<FormField
						name={t("Model")}
						description={t("Reasoning model used for flashcard generation.")}
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
							name={t("Custom Model ID")}
							description={t("Enter any OpenRouter-compatible model ID.")}
						>
							<TextInput
								value={settings.customAiModel ?? ""}
								onChange={(v) => void save({ customAiModel: v })}
								placeholder="e.g. openai/gpt-4o-mini"
								class="tr-control"
							/>
						</FormField>
					)}

					<FormField
						name={t("Grading model")}
						description={t(
							"Model used to grade typed answers during review. Pick a stronger model here without changing the generation model.",
						)}
					>
						<SelectInput
							value={settings.gradingModel}
							onChange={(v) => void save({ gradingModel: v })}
							options={GRADING_MODEL_OPTIONS}
						/>
					</FormField>

					<FormField
						name={t("Temperature")}
						description={
							<span>
								{t("Controls randomness.")}{" "}
								{settings.aiTemperature != null ? (
									<Clickable
										class="ep:text-obs-accent ep:text-ui-smaller"
										onClick={() => void save({ aiTemperature: undefined })}
									>
										{t("Reset to model default (")}
										{modelDefault})
									</Clickable>
								) : (
									<span class="ep:text-obs-muted">
										{t("Using model default (")}
										{modelDefault})
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
					<InfoBlock title={t("Run models locally with LM Studio")}>
						{t(
							"Models are auto-discovered from your running LM Studio server.",
						)}{" "}
						<a href="https://lmstudio.ai" class="ep:text-obs-accent">
							{t("Download LM Studio")}
						</a>
					</InfoBlock>

					<FormField
						name={t("Base URL")}
						description={t("LM Studio server endpoint")}
					>
						<TextInput
							value={settings.lmStudioBaseUrl || DEFAULT_LMSTUDIO_BASE_URL}
							onChange={(v) => void save({ lmStudioBaseUrl: v })}
							placeholder="http://localhost:1234/v1"
							class="tr-control"
						/>
					</FormField>

					<FormField
						name={t("Default Model")}
						description={t(
							"Fallback model used when a plugin-specific LM Studio model is not set",
						)}
					>
						{lmState.status === "loading" && (
							<InfoBlock>{t("Discovering models…")}</InfoBlock>
						)}
						{lmState.status === "error" && (
							<>
								<InfoBlock class="ep:text-obs-error">
									{t("Can't connect to LM Studio — is the server running?")}
								</InfoBlock>
								<TextInput
									value={settings.lmStudioModel}
									onChange={(v) => void save({ lmStudioModel: v })}
									placeholder="e.g. llama-3.2-3b-instruct"
									class="tr-control ep:mt-2"
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
									{t("Refresh models")}
								</Clickable>
							</>
						)}
						{lmState.status === "ready" && lmState.models.length === 0 && (
							<>
								<InfoBlock>
									{t("No models found — load a model in LM Studio first.")}
								</InfoBlock>
								<TextInput
									value={settings.lmStudioModel}
									onChange={(v) => void save({ lmStudioModel: v })}
									placeholder="e.g. llama-3.2-3b-instruct"
									class="tr-control ep:mt-2"
								/>
							</>
						)}
					</FormField>

					<FormField
						name={t("Grading model")}
						description={t(
							"Optional LM Studio model override for grading typed answers during review",
						)}
					>
						{lmState.status === "ready" && lmState.models.length > 0 ? (
							<SelectInput
								value={settings.lmStudioGradingModel}
								onChange={(v) => void save({ lmStudioGradingModel: v })}
								options={[
									{
										value: "",
										get label() {
											return t("Same as default model");
										},
									},
									...lmState.models.map((id) => ({ value: id, label: id })),
								]}
							/>
						) : (
							<TextInput
								value={settings.lmStudioGradingModel}
								onChange={(v) => void save({ lmStudioGradingModel: v })}
								placeholder={t("Leave empty to use the default model")}
								class="tr-control"
							/>
						)}
					</FormField>

					<FormField
						name={t("API Key")}
						description={t(
							"Optional — only needed if you enabled authentication in LM Studio",
						)}
					>
						<TextInput
							value={settings.lmStudioApiKey ?? ""}
							onChange={(v) =>
								void save({
									lmStudioApiKey: v.trim().length > 0 ? v.trim() : undefined,
								})
							}
							type="password"
							placeholder={t("Leave empty if not required")}
							class="tr-control"
						/>
					</FormField>

					<FormField
						name={t("Temperature")}
						description={t("Controls randomness (0–2)")}
					>
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
					<InfoBlock title={t("Self-hosted / local models")}>
						{t(
							"Connect to Ollama, LM Studio, vLLM, or any OpenAI-compatible endpoint.",
						)}
					</InfoBlock>

					<FormField
						name={t("Base URL")}
						description={t("OpenAI-compatible API endpoint")}
					>
						<TextInput
							value={settings.customBaseUrl || DEFAULT_CUSTOM_BASE_URL}
							onChange={(v) => void save({ customBaseUrl: v })}
							placeholder="http://localhost:11434/v1"
							class="tr-control"
						/>
					</FormField>

					<FormField
						name={t("Model Name")}
						description={t("The model identifier (e.g. llama3, mistral)")}
					>
						<TextInput
							value={settings.customModel}
							onChange={(v) => void save({ customModel: v })}
							placeholder="e.g. llama3"
							class="tr-control"
						/>
					</FormField>

					<FormField
						name={t("API Key")}
						description={t(
							"Optional — many local setups don't need authentication",
						)}
					>
						<TextInput
							value={settings.customApiKey ?? ""}
							onChange={(v) =>
								void save({
									customApiKey: v.trim().length > 0 ? v.trim() : undefined,
								})
							}
							type="password"
							placeholder={t("Leave empty if not required")}
							class="tr-control"
						/>
					</FormField>

					<FormField
						name={t("Temperature")}
						description={t("Controls randomness (0–2)")}
					>
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
