import type { NoteStatusInfo } from "@features/core/cache/note-status-cache.service";
import { DonutChart } from "@features/library/ui/editor/components/DonutChart";
import { LinkTextCount } from "@features/library/ui/editor/components/LinkTextCount";
import { h, render } from "preact";

export interface LinkStatusOptions {
	info: NoteStatusInfo;
	onPlay?: () => void;
	variant?: "link" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export function createLinkStatusElement(
	options: LinkStatusOptions,
): HTMLSpanElement {
	const container = document.createElement("div");
	render(
		h(DonutChart, {
			info: options.info,
			onPlay: options.onPlay,
			variant: options.variant,
		}),
		container,
	);
	return container.firstElementChild as HTMLSpanElement;
}

export function createLinkTextCountElement(
	options: LinkStatusOptions,
): HTMLSpanElement {
	const container = document.createElement("div");
	render(
		h(LinkTextCount, {
			info: options.info,
			onPlay: options.onPlay,
			variant: options.variant,
		}),
		container,
	);
	return container.firstElementChild as HTMLSpanElement;
}

export function infoEqual(a: NoteStatusInfo, b: NoteStatusInfo): boolean {
	return (
		a.new === b.new &&
		a.learning === b.learning &&
		a.dueToday === b.dueToday &&
		a.total === b.total
	);
}

export function aggregateInfos(infos: NoteStatusInfo[]): NoteStatusInfo {
	let newCount = 0;
	let learning = 0;
	let dueToday = 0;
	let total = 0;
	for (const info of infos) {
		newCount += info.new;
		learning += info.learning;
		dueToday += info.dueToday;
		total += info.total;
	}
	return { new: newCount, learning, dueToday, total };
}
