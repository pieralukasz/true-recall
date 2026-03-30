import { effect } from "@preact/signals";
import {
	type NoteStatusInfo,
	noteStatusMap,
} from "@shared/services/reactive-card-store";
import { lastMutation } from "@shared/services/signals";

export type { NoteStatusInfo } from "@shared/services/reactive-card-store";

export interface NoteStatusCache {
	get(sourceUid: string): NoteStatusInfo | null;
	hasData(): boolean;
	getVersion(): number;
	bumpVersion(): void;
	dispose(): void;
}

export function createNoteStatusCache(): NoteStatusCache {
	let version = 1;
	const dispose = effect(() => {
		if (!lastMutation.value) return;
		version++;
	});

	return {
		get: (uid) => noteStatusMap.value.get(uid) ?? null,
		hasData: () => noteStatusMap.value.size > 0,
		getVersion: () => version,
		bumpVersion: () => {
			version++;
		},
		dispose,
	};
}
