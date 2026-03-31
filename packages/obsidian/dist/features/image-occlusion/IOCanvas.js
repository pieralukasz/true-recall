import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { clamp, normalizePointFromRect, } from "@true-recall/core/utils/canvas-geometry";
import { buildDraftRegion, buildMoveUpdate, buildResizeUpdate, commitDraftRegion, getRegionCorner, updateRegion, } from "./canvas-interactions";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { useCallback, useEffect, useMemo, useRef, useState, } from "preact/hooks";
function CanvasIconButton({ icon, label, onClick }) {
    const iconRef = useIcon(icon);
    return (_jsx(Clickable, { class: "true-recall-io-canvas-zoombar-btn", "aria-label": label, title: label, onClick: () => onClick(), children: _jsx("span", { ref: iconRef }) }));
}
function getPoint(event, mediaEl) {
    if (!mediaEl)
        return null;
    return normalizePointFromRect(event.clientX, event.clientY, mediaEl.getBoundingClientRect());
}
export function IOCanvas({ imageUrl, definition, tool, onToolChange, selectedRegionId, zoom, panX, panY, onDefinitionChange, onSelectRegion, onZoomChange, onPanChange, }) {
    const mediaRef = useRef(null);
    const mediaRefCallback = useCallback((el) => {
        mediaRef.current = el;
    }, []);
    const [spacePressed, setSpacePressed] = useState(false);
    const [draftRegion, setDraftRegion] = useState(null);
    // Drag state lives in a ref — changes don't need re-renders,
    // and handlers always read the latest value synchronously.
    const dragRef = useRef(null);
    // Keep latest props/state accessible to pointer handlers without re-creating them
    const definitionRef = useRef(definition);
    definitionRef.current = definition;
    const toolRef = useRef(tool);
    toolRef.current = tool;
    const spacePressedRef = useRef(spacePressed);
    spacePressedRef.current = spacePressed;
    const panXRef = useRef(panX);
    panXRef.current = panX;
    const panYRef = useRef(panY);
    panYRef.current = panY;
    const onDefinitionChangeRef = useRef(onDefinitionChange);
    onDefinitionChangeRef.current = onDefinitionChange;
    const onPanChangeRef = useRef(onPanChange);
    onPanChangeRef.current = onPanChange;
    const onSelectRegionRef = useRef(onSelectRegion);
    onSelectRegionRef.current = onSelectRegion;
    const onToolChangeRef = useRef(onToolChange);
    onToolChangeRef.current = onToolChange;
    const draftRegionRef = useRef(draftRegion);
    draftRegionRef.current = draftRegion;
    const selectedRegion = useMemo(() => {
        var _a;
        return (_a = definition.regions.find((region) => region.id === selectedRegionId)) !== null && _a !== void 0 ? _a : null;
    }, [definition.regions, selectedRegionId]);
    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.code === "Space")
                setSpacePressed(true);
        };
        const onKeyUp = (event) => {
            if (event.code === "Space")
                setSpacePressed(false);
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);
    const handlePointerDown = useCallback((event) => {
        var _a;
        if (event.button !== 0 && event.button !== 1)
            return;
        const target = event.target;
        const regionId = target.getAttribute("data-io-region");
        const handle = target.getAttribute("data-io-handle");
        const currentTool = toolRef.current;
        if (spacePressedRef.current || event.button === 1) {
            dragRef.current = {
                type: "pan",
                startClientX: event.clientX,
                startClientY: event.clientY,
                originX: panXRef.current,
                originY: panYRef.current,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
            return;
        }
        // Selection happens before getPoint guard so it works
        // even when image hasn't loaded (zero-size container).
        if (regionId) {
            onSelectRegionRef.current(regionId);
            // In draw mode, clicking a region/handle enters select mode,
            // but does not start move/resize in the same pointer interaction.
            if (currentTool !== "select") {
                (_a = onToolChangeRef.current) === null || _a === void 0 ? void 0 : _a.call(onToolChangeRef, "select");
                return;
            }
        }
        else if (!handle && currentTool === "select") {
            onSelectRegionRef.current(null);
        }
        const point = getPoint(event, mediaRef.current);
        if (!point)
            return;
        if (handle && regionId) {
            dragRef.current = { type: "resize", regionId, corner: handle };
            event.currentTarget.setPointerCapture(event.pointerId);
            return;
        }
        if (regionId) {
            if (currentTool === "select") {
                const region = definitionRef.current.regions.find((r) => r.id === regionId);
                if (!region)
                    return;
                dragRef.current = {
                    type: "move",
                    regionId,
                    offsetX: point.x - region.x,
                    offsetY: point.y - region.y,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
            }
            return;
        }
        if (currentTool === "rect" || currentTool === "ellipse") {
            dragRef.current = {
                type: "draw",
                startX: point.x,
                startY: point.y,
                shape: currentTool,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
        }
    }, []);
    const handlePointerMove = useCallback((event) => {
        const drag = dragRef.current;
        if (!drag)
            return;
        if (drag.type === "pan") {
            const dx = event.clientX - drag.startClientX;
            const dy = event.clientY - drag.startClientY;
            onPanChangeRef.current(drag.originX + dx, drag.originY + dy);
            return;
        }
        const point = getPoint(event, mediaRef.current);
        if (!point)
            return;
        if (drag.type === "draw") {
            setDraftRegion(buildDraftRegion(drag.startX, drag.startY, point.x, point.y, drag.shape));
            return;
        }
        const def = definitionRef.current;
        if (drag.type === "move") {
            onDefinitionChangeRef.current(updateRegion(def, drag.regionId, (region) => (Object.assign(Object.assign({}, region), buildMoveUpdate(region, point, {
                x: drag.offsetX,
                y: drag.offsetY,
            })))));
            return;
        }
        // resize
        onDefinitionChangeRef.current(updateRegion(def, drag.regionId, (region) => (Object.assign(Object.assign({}, region), buildResizeUpdate(region, drag.corner, point)))));
    }, []);
    const handlePointerUp = useCallback(() => {
        const drag = dragRef.current;
        if (!drag)
            return;
        if (drag.type === "draw") {
            const draft = draftRegionRef.current;
            if (draft) {
                const result = commitDraftRegion(definitionRef.current, draft);
                if (result) {
                    onDefinitionChangeRef.current(result.definition);
                    onSelectRegionRef.current(result.regionId);
                }
            }
        }
        dragRef.current = null;
        setDraftRegion(null);
    }, []);
    const handleLostPointerCapture = useCallback(() => {
        // Safety net: if capture is released unexpectedly, clean up drag state
        if (dragRef.current) {
            dragRef.current = null;
            setDraftRegion(null);
        }
    }, []);
    const handleWheel = (event) => {
        event.preventDefault();
        const multiplier = event.deltaY < 0 ? 1.12 : 0.88;
        onZoomChange(clamp(zoom * multiplier, 0.5, 4));
    };
    if (!imageUrl) {
        return (_jsx("div", { class: "true-recall-io-canvas-empty", children: "Select or paste an image to start drawing masks." }));
    }
    const allRegions = draftRegion
        ? [...definition.regions, draftRegion]
        : definition.regions;
    return (_jsx("div", { class: "true-recall-io-canvas-wrap", children: _jsxs("div", { class: `true-recall-io-canvas-stage tool-${tool} ${spacePressed ? "is-panning" : ""}`, onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: handlePointerUp, onLostPointerCapture: handleLostPointerCapture, onWheel: handleWheel, children: [_jsxs("div", { class: "true-recall-io-canvas-zoombar", onPointerDown: (event) => event.stopPropagation(), children: [_jsx(CanvasIconButton, { icon: "minus", label: "Zoom out", onClick: () => onZoomChange(clamp(zoom * 0.88, 0.5, 4)) }), _jsxs("span", { class: "true-recall-io-canvas-zoombar-percent", children: [Math.round(zoom * 100), "%"] }), _jsx(CanvasIconButton, { icon: "plus", label: "Zoom in", onClick: () => onZoomChange(clamp(zoom * 1.12, 0.5, 4)) }), _jsx(CanvasIconButton, { icon: "maximize", label: "Fit view", onClick: () => {
                                onZoomChange(1);
                                onPanChange(0, 0);
                            } })] }), _jsxs("div", { class: "true-recall-io-canvas-shortcuts", title: "Editor shortcuts", children: [_jsx("kbd", { children: "Space + drag" }), " pan"] }), _jsx("div", { class: "true-recall-io-canvas-transform", style: {
                        transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                    }, children: _jsxs("div", { ref: mediaRefCallback, class: "true-recall-io-canvas-media", children: [_jsx("img", { src: imageUrl, alt: "Occlusion source", draggable: false, class: "true-recall-io-canvas-image" }), _jsxs("svg", { class: "true-recall-io-canvas-svg", viewBox: "0 0 1 1", preserveAspectRatio: "none", "aria-hidden": "true", children: [allRegions.map((region) => {
                                        const isSelected = selectedRegionId === region.id;
                                        const commonProps = {
                                            "data-io-region": region.id,
                                            class: `true-recall-io-canvas-region ${isSelected ? "is-selected" : ""} ${region.id === "draft" ? "is-draft" : ""}`,
                                        };
                                        if (region.shape === "ellipse") {
                                            return (_jsx("ellipse", Object.assign({}, commonProps, { cx: region.x + region.w / 2, cy: region.y + region.h / 2, rx: region.w / 2, ry: region.h / 2 })));
                                        }
                                        return (_jsx("rect", Object.assign({}, commonProps, { x: region.x, y: region.y, width: region.w, height: region.h, rx: 0.01, ry: 0.01 })));
                                    }), selectedRegion &&
                                        ["nw", "ne", "sw", "se"].map((corner) => {
                                            const point = getRegionCorner(selectedRegion, corner);
                                            return (_jsx("circle", { "data-io-region": selectedRegion.id, "data-io-handle": corner, cx: point.x, cy: point.y, r: 0.008, class: "true-recall-io-canvas-handle" }, `${selectedRegion.id}-${corner}`));
                                        })] })] }) })] }) }));
}
