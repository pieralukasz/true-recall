import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { parseIODefinition } from "@true-recall/core/utils/io-definition";
import { resolveImageFile } from "./resolve-image";
import { useApp } from "@true-recall/obsidian/preact/ObsidianContext";
import { useCallback, useMemo, useState } from "preact/hooks";
function parseGroupOrd(region, fallbackOrd) {
    const parsed = Number.parseInt(region.groupKey, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
    }
    return fallbackOrd;
}
function getRegionClass(info, activeOrd, revealed, maskMode, revealSingleOnly = false) {
    const isActive = info.ord === activeOrd;
    if (revealed) {
        if (isActive)
            return "is-revealed-active";
        if (revealSingleOnly) {
            return maskMode === "all" ? "is-mask-passive" : "is-outline-passive";
        }
        return "is-revealed-passive";
    }
    if (maskMode === "all") {
        return isActive ? "is-mask-active" : "is-mask-passive";
    }
    return isActive ? "is-mask-active" : "is-outline-passive";
}
export function IOCardRenderer({ imagePath, regionsJson, templateOrd = 0, revealed, class: className, maskModeOverride, revealSingleOnly, onRegionClick, }) {
    const app = useApp();
    const definition = useMemo(() => parseIODefinition(regionsJson !== null && regionsJson !== void 0 ? regionsJson : ""), [regionsJson]);
    const imageFile = useMemo(() => (imagePath ? resolveImageFile(app, imagePath) : null), [app, imagePath]);
    const renderRegions = useMemo(() => {
        if (!definition)
            return [];
        return definition.regions.map((region, index) => ({
            region,
            ord: parseGroupOrd(region, index),
        }));
    }, [definition]);
    const [aspectRatio, setAspectRatio] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const handleImageLoad = useCallback((e) => {
        const img = e.currentTarget;
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            setAspectRatio(img.naturalWidth / img.naturalHeight);
        }
        setLoaded(true);
    }, []);
    const handleImageError = useCallback(() => {
        setLoaded(true);
    }, []);
    if (!imageFile || !definition) {
        return (_jsx("div", { class: `true-recall-io-fallback ${className !== null && className !== void 0 ? className : ""}`, children: "Image occlusion data unavailable" }));
    }
    const imageUrl = app.vault.getResourcePath(imageFile);
    return (_jsx("div", { class: `true-recall-io-render ${revealed ? "is-revealed" : ""} ${className !== null && className !== void 0 ? className : ""}`, children: _jsxs("div", { class: `true-recall-io-render-frame${loaded ? " is-loaded" : ""}`, style: aspectRatio ? { aspectRatio: `${aspectRatio}` } : undefined, children: [_jsx("img", { src: imageUrl, alt: `Occlusion ${templateOrd + 1}`, class: "true-recall-io-render-image", onLoad: handleImageLoad, onError: handleImageError }), _jsx("svg", { class: "true-recall-io-render-svg", viewBox: "0 0 1 1", preserveAspectRatio: "none", "aria-hidden": "true", children: renderRegions.map((info) => {
                        const shapeClass = `true-recall-io-shape ${getRegionClass(info, templateOrd, revealed, maskModeOverride !== null && maskModeOverride !== void 0 ? maskModeOverride : definition.maskMode, revealSingleOnly)}${onRegionClick ? " true-recall-io-shape-clickable" : ""}`;
                        if (info.region.shape === "ellipse") {
                            return (_jsx("ellipse", Object.assign({ class: shapeClass, cx: info.region.x + info.region.w / 2, cy: info.region.y + info.region.h / 2, rx: info.region.w / 2, ry: info.region.h / 2 }, (onRegionClick
                                ? {
                                    onClick: (e) => {
                                        e.stopPropagation();
                                        onRegionClick(info.ord);
                                    },
                                    role: "button",
                                    tabIndex: 0,
                                }
                                : {})), info.region.id));
                        }
                        return (_jsx("rect", Object.assign({ class: shapeClass, x: info.region.x, y: info.region.y, width: info.region.w, height: info.region.h, rx: 0.01, ry: 0.01 }, (onRegionClick
                            ? {
                                onClick: (e) => {
                                    e.stopPropagation();
                                    onRegionClick(info.ord);
                                },
                                role: "button",
                                tabIndex: 0,
                            }
                            : {})), info.region.id));
                    }) })] }) }));
}
