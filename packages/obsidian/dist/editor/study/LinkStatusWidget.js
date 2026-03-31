import { DonutChart } from "./components/DonutChart";
import { LinkTextCount } from "./components/LinkTextCount";
import { h, render } from "preact";
export function createLinkStatusElement(options) {
    const container = document.createElement("div");
    render(h(DonutChart, {
        info: options.info,
        onPlay: options.onPlay,
        variant: options.variant,
    }), container);
    const el = container.firstElementChild;
    if (options.sourceUid && options.getTooltipStats) {
        const statsFn = options.getTooltipStats;
        void import("./components/NoteStatsTooltip").then((mod) => {
            mod.attachTooltipListeners(el, statsFn);
        });
    }
    return el;
}
export function createLinkTextCountElement(options) {
    const container = document.createElement("div");
    render(h(LinkTextCount, {
        info: options.info,
        onPlay: options.onPlay,
        variant: options.variant,
    }), container);
    const el = container.firstElementChild;
    if (options.sourceUid && options.getTooltipStats) {
        const statsFn = options.getTooltipStats;
        void import("./components/NoteStatsTooltip").then((mod) => {
            mod.attachTooltipListeners(el, statsFn);
        });
    }
    return el;
}
export function infoEqual(a, b) {
    return (a.new === b.new &&
        a.learning === b.learning &&
        a.dueToday === b.dueToday &&
        a.total === b.total);
}
export function aggregateInfos(infos) {
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
