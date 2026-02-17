import { setIcon } from "obsidian";
import type { NoteStatusInfo } from "../../services/cache/note-status-cache.service";

export interface LinkStatusOptions {
	info: NoteStatusInfo;
	onPlay?: () => void;
}

export function createLinkStatusElement(options: LinkStatusOptions): HTMLSpanElement {
	const { info, onPlay } = options;

	const wrapper = document.createElement("span");
	wrapper.className = "true-recall-link-status";
	wrapper.setAttribute(
		"aria-label",
		`Flashcards: ${info.new} new, ${info.learning} learning, ${info.dueToday} due today (${info.total} total)`,
	);

	// New (green)
	const newSpan = document.createElement("span");
	newSpan.className = "true-recall-link-status-new";
	newSpan.textContent = String(info.new);
	wrapper.appendChild(newSpan);

	const dot1 = document.createElement("span");
	dot1.className = "true-recall-link-status-dot";
	dot1.textContent = "\u00B7";
	wrapper.appendChild(dot1);

	// Learning (orange)
	const learningSpan = document.createElement("span");
	learningSpan.className = "true-recall-link-status-learning";
	learningSpan.textContent = String(info.learning);
	wrapper.appendChild(learningSpan);

	const dot2 = document.createElement("span");
	dot2.className = "true-recall-link-status-dot";
	dot2.textContent = "\u00B7";
	wrapper.appendChild(dot2);

	// Due today (blue)
	const dueSpan = document.createElement("span");
	dueSpan.className = "true-recall-link-status-due";
	dueSpan.textContent = String(info.dueToday);
	wrapper.appendChild(dueSpan);

	// Total (faint, in parens)
	const totalSpan = document.createElement("span");
	totalSpan.className = "true-recall-link-status-total";
	totalSpan.textContent = `(${info.total})`;
	wrapper.appendChild(totalSpan);

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
