import { setIcon } from "obsidian";
import type { NoteStatusInfo } from "../../services/cache/note-status-cache.service";

export interface LinkStatusOptions {
	info: NoteStatusInfo;
	onPlay?: () => void;
}

function createPill(label: string, count: number, variant: string): HTMLSpanElement {
	const pill = document.createElement("span");
	pill.className = `true-recall-pill true-recall-pill-${variant}`;
	pill.textContent = `${count} ${label}`;
	return pill;
}

export function createLinkStatusElement(options: LinkStatusOptions): HTMLSpanElement {
	const { info, onPlay } = options;

	const wrapper = document.createElement("span");
	wrapper.className = "true-recall-link-status";
	wrapper.setAttribute(
		"aria-label",
		`Flashcards: ${info.new} new, ${info.learning} learning, ${info.dueToday} due today (${info.total} total)`,
	);

	wrapper.appendChild(createPill("new", info.new, "new"));
	wrapper.appendChild(createPill("due", info.dueToday, "due"));

	const totalPill = document.createElement("span");
	totalPill.className = "true-recall-pill true-recall-pill-total";
	totalPill.textContent = String(info.total);
	wrapper.appendChild(totalPill);

	if (onPlay) {
		const playBtn = document.createElement("span");
		playBtn.className = "true-recall-link-status-play";
		playBtn.setAttribute("aria-label", "Review flashcards");
		setIcon(playBtn, "zap");
		playBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			onPlay();
		});
		wrapper.appendChild(playBtn);
	}

	return wrapper;
}

export function infoEqual(a: NoteStatusInfo, b: NoteStatusInfo): boolean {
	return a.new === b.new && a.learning === b.learning && a.dueToday === b.dueToday && a.total === b.total;
}
