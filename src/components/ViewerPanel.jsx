import React, { useRef, useState, useCallback, useEffect } from "react";
import { Columns, Rows } from "lucide-react";
import CanvasControls from "./CanvasControls";
import DiagramCard from "./DiagramCard";
import { isPhysicalMouseWheel } from "../utils/diagramGraph.js";
import { trackEvent } from "../utils/analytics.js";

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
  onToast,
}) {
  const workspaceRef = useRef(null);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const [diagramsLayout, setDiagramsLayout] = useState(() => {
    try {
      return localStorage.getItem("diagramsLayout") || "horizontal";
    } catch {
      return "horizontal";
    }
  });

  const handleToggleLayout = (layout) => {
    setDiagramsLayout(layout);
    trackEvent("viewer_change_layout", { layout });
    try {
      localStorage.setItem("diagramsLayout", layout);
    } catch {}
  };

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

  const handleZoomIn = () => {
    trackEvent("viewer_zoom", { action: "zoom_in" });
    handleZoomAtCenter(zoom + 0.15);
  };
  const handleZoomOut = () => {
    trackEvent("viewer_zoom", { action: "zoom_out" });
    handleZoomAtCenter(zoom - 0.15);
  };
  const handleResetZoom = () => {
    trackEvent("viewer_zoom", { action: "zoom_reset" });
    setZoom(1.0);
    setPan({ x: 40, y: 40 });
  };

  // Zoom to Fit (auto-framing all cards in the workspace)
  const handleFitToScreen = useCallback(() => {
    trackEvent("viewer_zoom", { action: "fit_to_screen" });
    const ws = workspaceRef.current;
    if (!ws) return;
    const wsRect = ws.getBoundingClientRect();
    const cards = ws.querySelectorAll(".diagram-card");
    if (!cards || cards.length === 0) {
      setZoom(1.0);
      setPan({ x: 40, y: 40 });
      return;
    }

    let minLeft = Infinity;
    let minTop = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const unscaledLeft = (rect.left - wsRect.left - pan.x) / zoom;
      const unscaledTop = (rect.top - wsRect.top - pan.y) / zoom;
      const unscaledRight = unscaledLeft + rect.width / zoom;
      const unscaledBottom = unscaledTop + rect.height / zoom;

      minLeft = Math.min(minLeft, unscaledLeft);
      minTop = Math.min(minTop, unscaledTop);
      maxRight = Math.max(maxRight, unscaledRight);
      maxBottom = Math.max(maxBottom, unscaledBottom);
    });

    const contentWidth = maxRight - minLeft;
    const contentHeight = maxBottom - minTop;

    if (contentWidth <= 0 || contentHeight <= 0) return;

    const margin = 40;
    const availWidth = Math.max(200, wsRect.width - margin * 2);
    const availHeight = Math.max(200, wsRect.height - margin * 2);

    const fitZoom = clampZoom(Math.min(availWidth / contentWidth, availHeight / contentHeight, 1.25));

    const targetPanX = (wsRect.width - contentWidth * fitZoom) / 2 - minLeft * fitZoom;
    const targetPanY = Math.max(20, (wsRect.height - contentHeight * fitZoom) / 2 - minTop * fitZoom);

    setZoom(fitZoom);
    setPan({ x: Math.round(targetPanX), y: Math.round(targetPanY) });
  }, [pan, zoom]);

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
      const isMouseWheel = isPhysicalMouseWheel(e);

      if (e.ctrlKey || e.metaKey || isMouseWheel) {
        // Zoom anchored at cursor (mouse wheel scroll OR trackpad pinch/Ctrl+wheel)
        let targetZoom;
        if (isMouseWheel) {
          const step = -Math.sign(e.deltaY) * 0.12;
          targetZoom = clampZoom(currentZoom + step);
        } else {
          const zoomDelta = -e.deltaY * 0.005;
          targetZoom = clampZoom(currentZoom + zoomDelta);
        }

        const rect = ws.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - currentPan.x) / currentZoom;
        const worldY = (mouseY - currentPan.y) / currentZoom;

        setPan({
          x: Math.round(mouseX - worldX * targetZoom),
          y: Math.round(mouseY - worldY * targetZoom),
        });
        setZoom(targetZoom);
      } else {
        // Trackpad two-finger smooth 2D pan
        setPan((prev) => ({
          x: Math.round(prev.x - e.deltaX * 0.95),
          y: Math.round(prev.y - e.deltaY * 0.95),
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
          {isAll && (
            <div className="layout-toggle-group">
              <button
                type="button"
                className={`layout-btn ${diagramsLayout === "horizontal" ? "active" : ""}`}
                onClick={() => handleToggleLayout("horizontal")}
                title="Розташування: Поруч у 2 колонки"
              >
                <Columns size={13} />
                <span>Поруч</span>
              </button>
              <button
                type="button"
                className={`layout-btn ${diagramsLayout === "vertical" ? "active" : ""}`}
                onClick={() => handleToggleLayout("vertical")}
                title="Розташування: Один під одним вертикально"
              >
                <Rows size={13} />
                <span>Один під одним</span>
              </button>
            </div>
          )}
        </div>

        <CanvasControls
          zoom={zoom}
          onZoomChange={handleZoomAtCenter}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          onFitToScreen={handleFitToScreen}
        />
      </div>

      <div
        ref={workspaceRef}
        className="diagram-workspace"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      >
        <div
          className={`diagram-viewport layout-${diagramsLayout}`}
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
              onToast={onToast}
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
              onToast={onToast}
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
              onToast={onToast}
            />
          )}
        </div>
      </div>
    </section>
  );
}
