import type { QuickNoteEditorMode } from "../types";

export interface QuickNoteState {
	noteTypeId: string;
	fields: Record<string, string>;
	userComment: string;
	pinnedFields: Set<string>;
	alwaysTypeIn: boolean;
	focusFirstRequest: number;
}

export type QuickNoteAction =
	| { type: "field"; name: string; value: string }
	| { type: "fields"; fields: Record<string, string> }
	| { type: "comment"; value: string }
	| { type: "noteType"; id: string; fieldNames: readonly string[] }
	| { type: "pin"; name: string }
	| { type: "typeIn"; enabled: boolean }
	| { type: "saved"; fieldNames: readonly string[] };

export function mapQuickNoteFields(
	previous: Record<string, string>,
	names: readonly string[],
): Record<string, string> {
	const fields = Object.fromEntries(
		names.map((name) => [name, previous[name] ?? ""]),
	);
	const primary = names[0];
	if (primary && !fields[primary]) {
		const carried = Object.values(previous).find(
			(value) => value.trim().length > 0,
		);
		if (carried) fields[primary] = carried;
	}
	return fields;
}

export function createQuickNoteState(
	mode: QuickNoteEditorMode,
	fieldNames: readonly string[],
): QuickNoteState {
	const fields =
		mode.mode === "edit"
			? { ...mode.note.fields }
			: mapQuickNoteFields(mode.initialFields ?? {}, fieldNames);
	return {
		noteTypeId:
			mode.mode === "edit"
				? mode.noteType.id
				: (mode.defaultNoteTypeId ?? "builtin-basic"),
		fields,
		userComment: mode.mode === "edit" ? (mode.note.userComment ?? "") : "",
		pinnedFields: new Set(),
		alwaysTypeIn: false,
		focusFirstRequest: 0,
	};
}

export function quickNoteReducer(
	state: QuickNoteState,
	action: QuickNoteAction,
): QuickNoteState {
	switch (action.type) {
		case "field":
			return state.fields[action.name] === action.value
				? state
				: {
						...state,
						fields: { ...state.fields, [action.name]: action.value },
					};
		case "fields":
			return { ...state, fields: action.fields };
		case "comment":
			return { ...state, userComment: action.value };
		case "typeIn":
			return { ...state, alwaysTypeIn: action.enabled };
		case "pin": {
			const pinnedFields = new Set(state.pinnedFields);
			if (pinnedFields.has(action.name)) pinnedFields.delete(action.name);
			else pinnedFields.add(action.name);
			return { ...state, pinnedFields };
		}
		case "noteType":
			return {
				...state,
				noteTypeId: action.id,
				fields: mapQuickNoteFields(state.fields, action.fieldNames),
				pinnedFields: new Set(
					[...state.pinnedFields].filter((name) =>
						action.fieldNames.includes(name),
					),
				),
			};
		case "saved":
			return {
				...state,
				fields: Object.fromEntries(
					action.fieldNames.map((name) => [
						name,
						state.pinnedFields.has(name) ? (state.fields[name] ?? "") : "",
					]),
				),
				userComment: "",
				focusFirstRequest:
					state.focusFirstRequest + (state.pinnedFields.size === 0 ? 1 : 0),
			};
	}
}
