import {
	DEFAULT_PROMPTS,
	GENERATION_MODE_LABELS,
	type GenerationMode,
} from "@features/ai/prompts/default-prompts";
import { useSettings } from "@features/settings/hooks/useSettings";
import type { AIModelInfo, AIModelKey } from "@shared/constants";
import { AI_MODELS_EXTENDED } from "@shared/constants";
import type { SelectOptionGroup } from "@shared/ui/components";
import {
	InfoBlock,
	SelectInput,
	SettingRow,
	TextAreaInput,
	TextInput,
	ToggleInput,
} from "@shared/ui/components";
import { useCallback, useMemo, useState } from "preact/hooks";

function groupModelsByProvider(): SelectOptionGroup[] {
	const groups: Record<string, [string, AIModelInfo][]> = {
		Google: [],
		OpenAI: [],
		Anthropic: [],
		Meta: [],
	};

	for (const [key, info] of Object.entries(AI_MODELS_EXTENDED)) {
		const providerGroup = groups[info.provider];
		if (providerGroup) {
			providerGroup.push([key, info]);
		}
	}

	for (const provider of Object.keys(groups)) {
		const providerGroup = groups[provider];
		if (providerGroup) {
			providerGroup.sort((a, b) => {
				if (a[1].recommended && !b[1].recommended) return -1;
				if (!a[1].recommended && b[1].recommended) return 1;
				return 0;
			});
		}
	}

	return Object.entries(groups)
		.filter(([, models]) => models.length > 0)
		.map(([provider, models]) => ({
			label: provider,
			options: models.map(([key, info]) => ({
				value: key,
				label: info.recommended
					? `${info.name} ⭐ (${info.description})`
					: `${info.name} (${info.description})`,
			})),
		}));
}

const PROMPT_MODES: GenerationMode[] = ["basic", "cloze", "reversed", "auto"];

export function AITab() {
	const { settings, save } = useSettings();
	const modelOptions = useMemo(() => groupModelsByProvider(), []);
	const [expandedPrompt, setExpandedPrompt] = useState<GenerationMode | null>(
		null,
	);

	const hasApiKey = !!settings.openRouterApiKey;

	const getPromptValue = useCallback(
		(mode: GenerationMode): string => {
			return settings.aiFlashcardPrompts?.[mode] ?? "";
		},
		[settings.aiFlashcardPrompts],
	);

	const savePrompt = useCallback(
		(mode: GenerationMode, value: string) => {
			const current = settings.aiFlashcardPrompts ?? {};
			save({
				aiFlashcardPrompts: {
					...current,
					[mode]: value,
				},
			});
		},
		[settings.aiFlashcardPrompts, save],
	);

	const resetPrompt = useCallback(
		(mode: GenerationMode) => {
			const current = settings.aiFlashcardPrompts ?? {};
			const updated = { ...current };
			delete updated[mode];
			save({ aiFlashcardPrompts: updated });
		},
		[settings.aiFlashcardPrompts, save],
	);

	return (
		<>
			<SettingRow heading name="AI (OpenRouter)" />

			<InfoBlock>
				<p>
					OpenRouter provides access to multiple AI models through a single API.
				</p>
				<p>
					<a href="https://openrouter.ai/keys" target="_blank" rel="noopener">
						Get your API key at openrouter.ai/keys
					</a>
				</p>
			</InfoBlock>

			<SettingRow name="API key" description="Your OpenRouter API key.">
				<TextInput
					value={settings.openRouterApiKey}
					onChange={(v) => save({ openRouterApiKey: v })}
					type="password"
					placeholder="Enter API key"
					class="ep:w-[300px]"
				/>
			</SettingRow>

			<SettingRow name="AI model" description="Select the AI model">
				<SelectInput
					value={settings.aiModel}
					onChange={(v) => save({ aiModel: v as AIModelKey })}
					options={modelOptions}
				/>
			</SettingRow>

			<SettingRow heading name="Flashcard Generation" />

			<SettingRow
				name="Selection toolbar"
				description="Show a floating toolbar above selected text for AI-powered flashcard creation."
			>
				<ToggleInput
					value={settings.selectionToolbarEnabled}
					onChange={(v) => save({ selectionToolbarEnabled: v })}
				/>
			</SettingRow>

			{hasApiKey && (
				<>
					<InfoBlock>
						<p>
							Customize the prompts used for AI flashcard generation. Leave
							empty to use the built-in defaults. Click a mode to expand its
							prompt editor.
						</p>
					</InfoBlock>

					{PROMPT_MODES.map((mode) => {
						const isExpanded = expandedPrompt === mode;
						const customValue = getPromptValue(mode);
						const isCustom = customValue.trim().length > 0;

						return (
							<div key={mode} class="ep:mb-1">
								<SettingRow
									name={`${GENERATION_MODE_LABELS[mode]} prompt${isCustom ? " (custom)" : ""}`}
									description={
										isExpanded
											? "Edit the system prompt sent to the AI model."
											: isCustom
												? "Using custom prompt. Click to edit."
												: "Using default prompt. Click to customize."
									}
								>
									<div class="ep:flex ep:gap-1">
										{isCustom && (
											<button
												type="button"
												class="ep:text-ui-smaller ep:text-obs-muted ep:cursor-pointer ep:px-2 ep:py-1 ep:rounded-[var(--radius-s)] hover:ep:bg-obs-modifier-hover"
												onClick={() => resetPrompt(mode)}
											>
												Reset
											</button>
										)}
										<button
											type="button"
											class="ep:text-ui-smaller ep:text-obs-accent ep:cursor-pointer ep:px-2 ep:py-1 ep:rounded-[var(--radius-s)] hover:ep:bg-obs-modifier-hover"
											onClick={() =>
												setExpandedPrompt(isExpanded ? null : mode)
											}
										>
											{isExpanded ? "Collapse" : "Edit"}
										</button>
									</div>
								</SettingRow>

								{isExpanded && (
									<div class="ep:px-4 ep:pb-3">
										<TextAreaInput
											value={customValue || DEFAULT_PROMPTS[mode]}
											onChange={(v) => savePrompt(mode, v)}
											rows={12}
											class="ep:w-full ep:font-mono ep:text-ui-smaller"
										/>
									</div>
								)}
							</div>
						);
					})}
				</>
			)}
		</>
	);
}
