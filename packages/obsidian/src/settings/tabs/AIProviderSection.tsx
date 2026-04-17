import { requestUrl } from "obsidian";
import { useEffect, useState } from "preact/hooks";

import {
	BYOK_MODELS,
	CUSTOM_MODEL_ID,
	TRUERECALL_WEB_URL,
} from "@true-recall/core/constants";

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

export function AIProviderSection() {
	const { settings, save } = useSettings();

	const initialStatus =
		settings.proKey && settings.proKey === cachedKey ? cachedStatus : "idle";
	const [keyStatus, setKeyStatus] = useState<KeyStatus>(initialStatus);

	const currentModel = settings.aiModel || BYOK_MODELS[0]?.id || "";
	const modelDefault = getModelDefault(currentModel);
	const effectiveTemp = settings.aiTemperature ?? modelDefault;

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
		<FormCard title="AI Provider">
			<div class="ep:text-ui-smaller ep:text-obs-muted ep:leading-relaxed ep:pb-2 ep:mb-2 ep:border-b ep:border-obs-modifier-border">
				<p class="ep:font-medium ep:text-obs-normal">
					Zero setup, optimized results
				</p>
				<p class="ep:mt-1">
					Optimized prompts and model selection managed server-side. AI budget
					included with your subscription.
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
						void save({ proKey: v.trim().length > 0 ? v.trim() : undefined })
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
					Could not verify key — check your internet connection and try again.
				</InfoBlock>
			)}
			<details class="ep:mt-2">
				<summary class="ep:cursor-pointer ep:text-ui-small ep:text-obs-muted ep:select-none ep:py-1">
					Advanced
				</summary>
				<div class="ep:mt-1">
					<FormField
						name="OpenRouter API key"
						description="Your own API key — you pay OpenRouter directly per token. Also used as fallback when Pro budget is exhausted."
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
				</div>
			</details>
		</FormCard>
	);
}
