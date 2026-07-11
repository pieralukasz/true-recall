import {
	DEFAULT_LMSTUDIO_BASE_URL,
	type TrueRecallSettings,
} from "@true-recall/core";

import {
	Clickable,
	FormField,
	InfoBlock,
	SelectInput,
	TextInput,
} from "@true-recall/obsidian/components";
import { useLMStudioModels } from "@true-recall/obsidian/settings/hooks/useLMStudioModels";

interface LMStudioScopedModelFieldProps {
	settings: TrueRecallSettings;
	save: (patch: Partial<TrueRecallSettings>) => Promise<void>;
	modelKey: "lmStudioGenerationModel" | "lmStudioCardPolishModel";
	name: string;
	description: string;
}

export function LMStudioScopedModelField({
	settings,
	save,
	modelKey,
	name,
	description,
}: LMStudioScopedModelFieldProps) {
	if (settings.providerType !== "lmstudio") return null;

	const lmState = useLMStudioModels(
		settings.lmStudioBaseUrl || DEFAULT_LMSTUDIO_BASE_URL,
		true,
	);
	const value = settings[modelKey];

	return (
		<FormField name={name} description={description}>
			{lmState.status === "loading" && (
				<InfoBlock>Discovering models…</InfoBlock>
			)}
			{lmState.status === "error" && (
				<>
					<InfoBlock class="ep:text-obs-error">
						Can't connect to LM Studio — is the server running?
					</InfoBlock>
					<TextInput
						value={value}
						onChange={(v) => void save({ [modelKey]: v })}
						placeholder="e.g. llama-3.2-3b-instruct"
						class="ep:w-75 ep:mt-2"
					/>
				</>
			)}
			{lmState.status === "ready" && lmState.models.length > 0 && (
				<>
					<SelectInput
						value={value}
						onChange={(v) => void save({ [modelKey]: v })}
						options={lmState.models.map((id) => ({ value: id, label: id }))}
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
						value={value}
						onChange={(v) => void save({ [modelKey]: v })}
						placeholder="e.g. llama-3.2-3b-instruct"
						class="ep:w-75 ep:mt-2"
					/>
				</>
			)}
		</FormField>
	);
}
