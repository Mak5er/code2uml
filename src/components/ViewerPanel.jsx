import React, { useRef, useState, useCallback, useEffect } from "react";
import CanvasControls from "./CanvasControls";
import DiagramCard from "./DiagramCard";

export default function ViewerPanel({
  activeTab,
  onTabChange,
  flowchartSvg,
  umlSvg,
  flowchartRef,
  umlRef,
  onDownloadFcSvg,
  onDownloadFcPng,
  onDownloadUmlSvg,
  onDownloadUmlPng,
  arrowRule = "gost",
  onToggleArrowRule,
}) {
  const workspaceRef = useRef(null);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const clampZoom = (z) => Math.min(Math.max(0.2, z), 2.5);

  // Zoom anchored around center
  const handleZoomAtCenter = useCallback(
    (targetZoom) => {
      const nextZoom = clampZoom(targetZoom);
      if (!workspaceRef.current) {
        setZoom(nextZoom);
        return;
      }
      const rect = workspaceRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      setPan((prevPan) => {
        const worldX = (centerX - prevPan.x) / zoom;
        const worldY = (centerY - prevPan.y) / zoom;
        return {
          x: centerX - worldX * nextZoom,
          y: centerY - worldY * nextZoom,
        };
      });
      setZoom(nextZoom);
    },
    [zoom],
  );

  const handleZoomIn = () => handleZoomAtCenter(zoom + 0.15);
  const handleZoomOut = () => handleZoomAtCenter(zoom - 0.15);
  const handleResetZoom = () => {
    setZoom(1.0);
    setPan({ x: 40, y: 40 });
  };

  // Pan with mouse drag
  const handleMouseDown = (e) => {
    if (e.target.closest("button") || e.target.closest("input")) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    };
    if (workspaceRef.current) {
      workspaceRef.current.style.cursor = "grabbing";
    }
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    if (workspaceRef.current) {
      workspaceRef.current.style.cursor = "grab";
    }
  };

  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  useEffect(() => {
    const ws = workspaceRef.current;
    if (!ws) return;

    const onWheel = (e) => {
      e.preventDefault();
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;

      if (e.ctrlKey || e.metaKey) {
        const zoomDelta = -e.deltaY * 0.005;
        const targetZoom = clampZoom(currentZoom + zoomDelta);
        const rect = ws.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - currentPan.x) / currentZoom;
        const worldY = (mouseY - currentPan.y) / currentZoom;

        setPan({
          x: mouseX - worldX * targetZoom,
          y: mouseY - worldY * targetZoom,
        });
        setZoom(targetZoom);
      } else {
        setPan((prev) => ({
          x: prev.x - e.deltaX * 0.9,
          y: prev.y - e.deltaY * 0.9,
        }));
      }
    };

    ws.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      ws.removeEventListener("wheel", onWheel);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <section className="panel-viewer">
      <div className="viewer-header">
        <div className="tabs-group">
          <button
            className={`tab-btn ${activeTab === "side-by-side" ? "active" : ""}`}
            onClick={() => onTabChange("side-by-side")}
          >
            📑 Обидві поруч
          </button>
          <button
            className={`tab-btn ${activeTab === "flowchart" ? "active" : ""}`}
            onClick={() => onTabChange("flowchart")}
          >
            📐 Блок-схема
          </button>
          <button
            className={`tab-btn ${activeTab === "uml" ? "active" : ""}`}
            onClick={() => onTabChange("uml")}
          >
            ⚡ UML Activity
          </button>
        </div>

        <CanvasControls
          zoom={zoom}
          onZoomChange={handleZoomAtCenter}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
        />
      </div>

      <div
        ref={workspaceRef}
        className="diagram-workspace"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      >
        <div
          className="diagram-viewport"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {(activeTab === "side-by-side" || activeTab === "flowchart") && (
            <DiagramCard
              id="cardFlowchart"
              title="Блок-схема алгоритму"
              badge={
                arrowRule === "gost" ? "За ГОСТ 19.701-90" : "Стрілочки всюди"
              }
              svgContent={flowchartSvg}
              emptyMessage="Введіть C++ код для генерації блок-схеми"
              onDownloadSvg={onDownloadFcSvg}
              onDownloadPng={onDownloadFcPng}
              innerRef={flowchartRef}
              extraActions={
                <div
                  className="card-arrow-switcher"
                  role="group"
                  aria-label="Стрілочки блок-схеми"
                >
                  <button
                    type="button"
                    className={`btn-card-toggle ${arrowRule === "all" ? "active" : ""}`}
                    onClick={() =>
                      onToggleArrowRule && onToggleArrowRule("all")
                    }
                    title="Стрілочки на всіх переходах"
                  >
                    Всюди
                  </button>
                  <button
                    type="button"
                    className={`btn-card-toggle ${arrowRule === "gost" ? "active" : ""}`}
                    onClick={() =>
                      onToggleArrowRule && onToggleArrowRule("gost")
                    }
                    title="За стандартом ГОСТ / ДСТУ 19.701-90"
                  >
                    По ГОСТу
                  </button>
                </div>
              }
            />
          )}

          {(activeTab === "side-by-side" || activeTab === "uml") && (
            <DiagramCard
              id="cardUml"
              title="UML-activity діаграма"
              badge="Діаграма діяльності"
              svgContent={umlSvg}
              emptyMessage="Введіть C++ код для генерації UML діаграми"
              onDownloadSvg={onDownloadUmlSvg}
              onDownloadPng={onDownloadUmlPng}
              innerRef={umlRef}
            />
          )}
        </div>
      </div>
    </section>
  );
}
