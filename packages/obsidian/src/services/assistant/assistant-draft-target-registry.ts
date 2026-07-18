export interface AssistantDraftTarget {
	getFields(): Record<string, string>;
	applyFields(fields: Record<string, string>): void;
}

const targets = new Map<string, AssistantDraftTarget>();

export function registerAssistantDraftTarget(
	sessionId: string,
	target: AssistantDraftTarget,
): () => void {
	targets.set(sessionId, target);
	return () => {
		if (targets.get(sessionId) === target) targets.delete(sessionId);
	};
}

export function getAssistantDraftTarget(
	sessionId: string,
): AssistantDraftTarget | null {
	return targets.get(sessionId) ?? null;
}
