import { effect } from "@preact/signals";

import {
	getDataLayer,
	type NoteStatusInfo,
	Q,
} from "@true-recall/obsidian/data";

export type { NoteStatusInfo } from "@true-recall/obsidian/data";

export interface NoteStatusCache {
	get(sourceUid: string): NoteStatusInfo | null;
	hasData(): boolean;
	getVersion(): number;
	bumpVersion(): void;
	dispose(): void;
}

export function createNoteStatusCache(): NoteStatusCache {
	const dl = getDataLayer();
	const noteStatusSig = dl.signal<Map<string, NoteStatusInfo>>(Q.NOTE_STATUS);
	let version = 1;
	const dispose = effect(() => {
		void noteStatusSig?.value;
		version++;
	});

	return {
		get: (uid) => noteStatusSig?.value.get(uid) ?? null,
		hasData: () => (noteStatusSig?.value.size ?? 0) > 0,
		getVersion: () => version,
		bumpVersion: () => {
			version++;
		},
		dispose,
	};
}
