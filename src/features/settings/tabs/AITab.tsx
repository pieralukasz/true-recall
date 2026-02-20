import { useSettings } from "@features/settings/hooks/useSettings";
import type { AIModelInfo, AIModelKey } from "@shared/constants";
import { AI_MODELS_EXTENDED } from "@shared/constants";
import type { SelectOptionGroup } from "@shared/ui/components";
import {
	InfoBlock,
	SelectInput,
	SettingRow,
	TextInput,
} from "@shared/ui/components";
import { useMemo } from "preact/hooks";

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

export function AITab() {
	const { settings, save } = useSettings();
	const modelOptions = useMemo(() => groupModelsByProvider(), []);

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
		</>
	);
}
