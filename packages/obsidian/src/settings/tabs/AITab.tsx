import { requestUrl } from "obsidian";
import { useEffect, useState } from "preact/hooks";

import { GENERATION_LANGUAGES } from "@true-recall/core/ai/prompts/default-prompts";
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
	TextAreaInput,
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

type KeyStatus = "idle" | "checking" | "valid" | "invalid";

// Cache so we only hit the network when the key actually changes
let cachedKey: string | undefined;
let cachedStatus: KeyStatus = "idle";

async function verifyProKey(key: string): Promise<boolean> {
	try {
		const res = await requestUrl({
			url: "https://ai.truerecall.app/key/info",
			headers: { Authorization: `Bearer ${key}` },
		});
		return res.status === 200;
	} catch {
		return false;
	}
}

export function AITab() {
	const { settings, save } = useSettings();

	const initialStatus =
		settings.proKey && settings.proKey === cachedKey ? cachedStatus : "idle";
	const [keyStatus, setKeyStatus] = useState<KeyStatus>(initialStatus);

	const hasProKey = !!settings.proKey;
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
		void verifyProKey(key).then((ok) => {
			const status = ok ? "valid" : "invalid";
			cachedKey = key;
			cachedStatus = status;
			setKeyStatus(status);
		});
	}, [settings.proKey]);

	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
			<FormCard title="True Recall Pro">
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
				<div class="ep:text-ui-smaller ep:text-obs-muted ep:leading-relaxed ep:pt-2 ep:mt-2 ep:border-t ep:border-obs-modifier-border">
					<p class="ep:font-medium ep:text-obs-normal">
						Zero setup, optimized results
					</p>
					<p class="ep:mt-1">
						Optimized prompts and model selection managed server-side. AI budget
						included with your subscription.
					</p>
				</div>
			</FormCard>

			<FormCard title="OpenRouter API Key">
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
			</FormCard>

			<FormCard title="AI Prompts">
				<FormField
					name="Generation prompt"
					description={
						hasProKey
							? "Extra instructions for flashcard generation. Pro already uses an optimized prompt — leave empty unless you want to override specific behavior."
							: "Extra instructions for flashcard generation. Added to the system prompt alongside JSON format rules."
					}
				>
					<TextAreaInput
						value={settings.aiGenerationPrompt ?? ""}
						onChange={(v) =>
							void save({
								aiGenerationPrompt: v.trim().length > 0 ? v : undefined,
							})
						}
						placeholder={
							hasProKey
								? "Leave empty for best results"
								: "e.g. Focus on key definitions and formulas"
						}
						rows={4}
						class="ep:w-full ep:font-mono ep:text-ui-smaller"
					/>
				</FormField>
				<FormField
					name="Type-in grading prompt"
					description="Optional custom system prompt for AI answer grading during review type-in mode. Leave empty to use built-in prompt."
				>
					<TextAreaInput
						value={settings.aiTypeInGradingPrompt ?? ""}
						onChange={(v) =>
							void save({
								aiTypeInGradingPrompt: v.trim().length > 0 ? v : undefined,
							})
						}
						rows={6}
						class="ep:w-full ep:font-mono ep:text-ui-smaller"
					/>
				</FormField>
				<FormField
					name="Image occlusion detection prompt"
					description="Custom prompt for AI region detection in image occlusion. Leave empty to use built-in prompt."
				>
					<TextAreaInput
						value={settings.aiIODetectionPrompt ?? ""}
						onChange={(v) =>
							void save({
								aiIODetectionPrompt: v.trim().length > 0 ? v : undefined,
							})
						}
						rows={4}
						class="ep:w-full ep:font-mono ep:text-ui-smaller"
					/>
				</FormField>
			</FormCard>

			<FormCard title="Flashcard Generation">
				<FormField
					name="Generation language"
					description="Language for AI-generated flashcards. Auto-detect matches the source text language."
				>
					<SelectInput
						value={settings.generationLanguage ?? "auto"}
						onChange={(v) => void save({ generationLanguage: v })}
						options={[...GENERATION_LANGUAGES]}
					/>
				</FormField>
			</FormCard>
		</div>
	);
}
