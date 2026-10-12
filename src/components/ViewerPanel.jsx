import React, { useRef, useState, useCallback, useEffect } from "react";
import CanvasControls from "./CanvasControls";
import DiagramCard from "./DiagramCard";

export default function ViewerPanel({
  activeTab,
  onTabChange,
  flowchartSvg,
  umlSvg,
  structureChartSvg,
  flowchartRef,
  umlRef,
  structureChartRef,
  onDownloadFcSvg,
  onDownloadFcPng,
  onDownloadUmlSvg,
  onDownloadUmlPng,
  onDownloadScSvg,
  onDownloadScPng,
  onEditDiagram,
  isCustomized = false,
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

  const isAll = activeTab === "all" || activeTab === "side-by-side";
  const isFcCustomized = typeof isCustomized === "object" ? Boolean(isCustomized.flowchart) : Boolean(isCustomized);
  const isUmlCustomized = typeof isCustomized === "object" ? Boolean(isCustomized.uml) : Boolean(isCustomized);
  const isScCustomized = typeof isCustomized === "object" ? Boolean(isCustomized["structure-chart"]) : false;

  return (
    <section className="panel-viewer">
      <div className="viewer-header">
        <div className="tabs-group">
          <button
            className={`tab-btn ${isAll ? "active" : ""}`}
            onClick={() => onTabChange("all")}
            title="Показати блок-схему та UML діаграму поруч"
          >
            Всі
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
          <button
            className={`tab-btn ${activeTab === "structure-chart" ? "active" : ""}`}
            onClick={() => onTabChange("structure-chart")}
            title="Структурна схема взаємозв'язку функцій та рекурсії (ДСТУ / Лаб. 5)"
          >
            🏗️ Структурна схема
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
          {(isAll || activeTab === "flowchart") && (
            <DiagramCard
              id="cardFlowchart"
              title="Блок-схема алгоритму"
              badge={isFcCustomized ? "Змінено вручну" : undefined}
              svgContent={flowchartSvg}
              emptyMessage="Введіть C++ код для генерації блок-схеми"
              onDownloadSvg={onDownloadFcSvg}
              onDownloadPng={onDownloadFcPng}
              innerRef={flowchartRef}
              onEdit={() => onEditDiagram && onEditDiagram("flowchart")}
            />
          )}

          {(isAll || activeTab === "uml") && (
            <DiagramCard
              id="cardUml"
              title="UML-activity діаграма"
              badge={isUmlCustomized ? "Змінено вручну" : undefined}
              svgContent={umlSvg}
              emptyMessage="Введіть C++ код для генерації UML діаграми"
              onDownloadSvg={onDownloadUmlSvg}
              onDownloadPng={onDownloadUmlPng}
              innerRef={umlRef}
              onEdit={() => onEditDiagram && onEditDiagram("uml")}
            />
          )}

          {activeTab === "structure-chart" && (
            <DiagramCard
              id="cardStructureChart"
              title="Структурна схема програми"
              badge={isScCustomized ? "Змінено вручну" : undefined}
              svgContent={structureChartSvg}
              emptyMessage="Введіть C++ код з 2+ функціями або рекурсією для генерації структурної схеми (Лаб. №5)"
              onDownloadSvg={onDownloadScSvg}
              onDownloadPng={onDownloadScPng}
              innerRef={structureChartRef}
              onEdit={structureChartSvg ? () => onEditDiagram && onEditDiagram("structure-chart") : undefined}
            />
          )}
        </div>
      </div>
    </section>
  );
}
