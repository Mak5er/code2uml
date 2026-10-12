import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Undo2,
  Redo2,
  Trash2,
  Copy,
  Check,
  X,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Sun,
  Moon,
  ArrowRight,
  Split,
  Square,
  FileText,
  CornerDownRight,
} from "lucide-react";
import {
  extractGraphFromSvg,
  graphToSvg,
  getNodeAnchorPoints,
  getNearestAnchorPort,
  calculateOrthogonalRoute,
} from "../utils/diagramGraph.js";

const SHAPES_PALETTE = [
  {
    type: "process",
    title: "Процес (Дія)",
    desc: "Стандартна операція / присвоєння",
    icon: "▭",
    defaultText: "x = a + b",
    w: 120,
    h: 42,
  },
  {
    type: "predefined",
    title: "Зумовлений процес",
    desc: "Виклик функції за ДСТУ 19.701-90",
    icon: "⚏",
    defaultText: "f(n)",
    w: 130,
    h: 42,
    isPredefined: true,
  },
  {
    type: "rhombus",
    title: "Умова (Ромб)",
    desc: "Розгалуження / перевірка",
    icon: "◇",
    defaultText: "x > 0",
    w: 110,
    h: 52,
  },
  {
    type: "input",
    title: "Ввід даних",
    desc: "Паралелограм введення (cin)",
    icon: "▱",
    defaultText: "x",
    w: 115,
    h: 42,
  },
  {
    type: "output",
    title: "Вивід даних",
    desc: "Документ / виведення (cout)",
    icon: "📄",
    defaultText: "y",
    w: 115,
    h: 42,
  },
  {
    type: "start",
    title: "Початок",
    desc: "Початковий вузол (овал)",
    icon: "⬭",
    defaultText: "початок",
    w: 110,
    h: 40,
  },
  {
    type: "end",
    title: "Кінець",
    desc: "Кінцевий вузол (овал)",
    icon: "⬭",
    defaultText: "кінець",
    w: 110,
    h: 40,
  },
  {
    type: "uml-action",
    title: "UML дія",
    desc: "Дія діяльності (скруглена)",
    icon: "▢",
    defaultText: "action()",
    w: 120,
    h: 38,
  },
  {
    type: "structure-chart-node",
    title: "Модуль програми",
    desc: "Блок структурної схеми",
    icon: "▤",
    defaultText: "module()",
    w: 130,
    h: 46,
  },
];

export default function DiagramEditorModal({
  isOpen,
  onClose,
  diagramType = "flowchart",
  diagramTitle = "Діаграма",
  svgContent = "",
  onSave,
  onResetToCode,
  isCustomized = false,
  isDark = false,
}) {
  const nextIdRef = useRef(100);

  // Theme in editor (inherits app theme, toggleable)
  const [editorThemeDark, setEditorThemeDark] = useState(isDark);

  // Graph model
  const [graph, setGraph] = useState(() => {
    if (!svgContent) {
      return { nodes: [], edges: [], labels: [], width: 900, height: 700 };
    }
    return extractGraphFromSvg(svgContent, diagramType);
  });

  // Undo/Redo stacks
  const [history, setHistory] = useState(() => [
    svgContent
      ? extractGraphFromSvg(svgContent, diagramType)
      : { nodes: [], edges: [], labels: [], width: 900, height: 700 },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Canvas Viewport (pan & zoom)
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 120, y: 70 });
  const [snapToGrid, setSnapToGrid] = useState(true);

  // Selection
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);

  // Hover states
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // Connection Dragging (Anchor port to anchor port)
  const [connectingState, setConnectingState] = useState(null);
  // { sourceNodeId, sourcePort, startPt: {x,y}, currentPt: {x,y}, targetNodeId, targetPort }

  // Dragging state
  const isDraggingRef = useRef(false);
  const dragTypeRef = useRef(null); // 'node' | 'edge-point' | 'pan'
  const dragTargetRef = useRef(null); // nodeId or { edgeId, pointIndex }
  const dragStartMouseRef = useRef({ x: 0, y: 0 });
  const dragStartPositionsRef = useRef(null);

  // Inline text editing
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editingText, setEditingText] = useState("");

  const canvasRef = useRef(null);

  // Push new state to undo history
  const pushHistory = useCallback((newGraph) => {
    setHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      return [...sliced, newGraph];
    });
    setHistoryIndex((prev) => prev + 1);
    setGraph(newGraph);
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setGraph(prev);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setGraph(next);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  }, [history, historyIndex]);

  // Selected entities
  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = graph.edges.find((e) => e.id === selectedEdgeId);

  // Screen to Canvas coordinate transform
  const screenToCanvas = useCallback((clientX, clientY) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // Grid snap helper
  const snapCoord = useCallback((val, step = 10) => {
    if (!snapToGrid) return val;
    return Math.round(val / step) * step;
  }, [snapToGrid]);

  // Duplicate Selected Node
  const handleDuplicateSelected = useCallback(() => {
    if (!selectedNodeId) return;
    const srcNode = graph.nodes.find((n) => n.id === selectedNodeId);
    if (!srcNode) return;

    const dupNode = {
      ...srcNode,
      id: `node_${nextIdRef.current++}`,
      cx: srcNode.cx + 40,
      cy: srcNode.cy + 40,
    };

    const nextGraph = {
      ...graph,
      nodes: [...graph.nodes, dupNode],
    };
    pushHistory(nextGraph);
    setSelectedNodeId(dupNode.id);
  }, [graph, selectedNodeId, pushHistory]);

  // Delete Selected Entity
  const handleDeleteSelected = useCallback(() => {
    if (selectedNodeId) {
      const nextNodes = graph.nodes.filter((n) => n.id !== selectedNodeId);
      const nextEdges = graph.edges.filter(
        (e) => e.sourceNodeId !== selectedNodeId && e.targetNodeId !== selectedNodeId
      );
      const nextGraph = { ...graph, nodes: nextNodes, edges: nextEdges };
      pushHistory(nextGraph);
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      const nextEdges = graph.edges.filter((e) => e.id !== selectedEdgeId);
      const nextGraph = { ...graph, edges: nextEdges };
      pushHistory(nextGraph);
      setSelectedEdgeId(null);
    }
  }, [graph, selectedNodeId, selectedEdgeId, pushHistory]);

  // Keyboard Shortcuts: Delete, Ctrl+Z, Ctrl+Y, Ctrl+D
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      // Ignore if typing inside input or textarea
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        handleDuplicateSelected();
      } else if (e.key === "Escape") {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setConnectingState(null);
        setEditingNodeId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleUndo, handleRedo, handleDeleteSelected, handleDuplicateSelected]);

  if (!isOpen) return null;

  // Colors based on editor theme
  const colors = {
    canvasBg: editorThemeDark ? "#090d16" : "#f8fafc",
    gridDot: editorThemeDark ? "#334155" : "#cbd5e1",
    nodeFill: editorThemeDark ? "#1e293b" : "#ffffff",
    nodeStroke: editorThemeDark ? "#64748b" : "#1e293b",
    nodeText: editorThemeDark ? "#f8fafc" : "#0f172a",
    edgeStroke: editorThemeDark ? "#38bdf8" : "#1e293b",
    edgeSelected: "#2563eb",
    anchorFill: editorThemeDark ? "#38bdf8" : "#2563eb",
    anchorBorder: editorThemeDark ? "#090d16" : "#ffffff",
  };

  // Re-route an edge using ports or waypoints
  const rerouteEdge = (edge, allNodes) => {
    if (edge.sourceNodeId && edge.targetNodeId) {
      const srcNode = allNodes.find((n) => n.id === edge.sourceNodeId);
      const tgtNode = allNodes.find((n) => n.id === edge.targetNodeId);
      if (srcNode && tgtNode) {
        const srcAnchors = getNodeAnchorPoints(srcNode);
        const tgtAnchors = getNodeAnchorPoints(tgtNode);
        const p1 = srcAnchors[edge.sourcePort || "bottom"] || { x: srcNode.cx, y: srcNode.cy, dir: "down" };
        const p2 = tgtAnchors[edge.targetPort || "top"] || { x: tgtNode.cx, y: tgtNode.cy, dir: "up" };
        return {
          ...edge,
          points: calculateOrthogonalRoute(p1, p1.dir, p2, p2.dir),
        };
      }
    }
    return edge;
  };

  // --- Handlers: Magnetic Connection Drawing (Draw.io style) ---
  const handleAnchorMouseDown = (e, node, portName) => {
    e.stopPropagation();
    const anchors = getNodeAnchorPoints(node);
    const startPt = anchors[portName];
    setConnectingState({
      sourceNodeId: node.id,
      sourcePort: portName,
      startPt,
      currentPt: { ...startPt },
      targetNodeId: null,
      targetPort: null,
    });
  };

  // --- Handlers: Node Dragging ---
  const handleNodeMouseDown = (e, nodeId) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    isDraggingRef.current = true;
    dragTypeRef.current = "node";
    dragTargetRef.current = nodeId;
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY };

    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    dragStartPositionsRef.current = {
      nodeCx: node.cx,
      nodeCy: node.cy,
    };
  };

  // --- Handlers: Edge Waypoint Dragging ---
  const handleEdgePointMouseDown = (e, edgeId, pointIndex) => {
    e.stopPropagation();
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    isDraggingRef.current = true;
    dragTypeRef.current = "edge-point";
    dragTargetRef.current = { edgeId, pointIndex };
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY };

    const edge = graph.edges.find((ed) => ed.id === edgeId);
    if (!edge || !edge.points[pointIndex]) return;

    dragStartPositionsRef.current = {
      pointX: edge.points[pointIndex].x,
      pointY: edge.points[pointIndex].y,
    };
  };

  // --- Handlers: Canvas MouseDown (Pan / Deselect) ---
  const handleCanvasMouseDown = (e) => {
    if (e.target.closest(".studio-left-sidebar") || e.target.closest(".studio-right-sidebar")) {
      return;
    }
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    if (editingNodeId) {
      handleFinishTextEdit();
    }

    isDraggingRef.current = true;
    dragTypeRef.current = "pan";
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
    dragStartPositionsRef.current = { panX: pan.x, panY: pan.y };
  };

  // --- Handlers: Mouse Move ---
  const handleMouseMove = (e) => {
    // 1. If currently dragging an anchor connection
    if (connectingState) {
      const cPos = screenToCanvas(e.clientX, e.clientY);
      // Check if hovering near another node
      let snapTarget = null;
      let snapPort = null;
      let minDist = 30;

      graph.nodes.forEach((n) => {
        if (n.id === connectingState.sourceNodeId) return;
        const near = getNearestAnchorPort(n, cPos);
        if (near.dist < minDist) {
          minDist = near.dist;
          snapTarget = n.id;
          snapPort = near.portName;
        }
      });

      setConnectingState((prev) => ({
        ...prev,
        currentPt: cPos,
        targetNodeId: snapTarget,
        targetPort: snapPort,
      }));
      return;
    }

    if (!isDraggingRef.current) return;

    const dxScreen = e.clientX - dragStartMouseRef.current.x;
    const dyScreen = e.clientY - dragStartMouseRef.current.y;
    const dxCanvas = dxScreen / zoom;
    const dyCanvas = dyScreen / zoom;

    // 2. Dragging a Node
    if (dragTypeRef.current === "node") {
      const nodeId = dragTargetRef.current;
      const initial = dragStartPositionsRef.current;
      if (!initial) return;

      const rawCx = initial.nodeCx + dxCanvas;
      const rawCy = initial.nodeCy + dyCanvas;
      const newCx = snapCoord(rawCx);
      const newCy = snapCoord(rawCy);

      setGraph((prev) => {
        const nextNodes = prev.nodes.map((n) =>
          n.id === nodeId ? { ...n, cx: newCx, cy: newCy } : n
        );
        // Automatically re-route all attached orthogonal edges!
        const nextEdges = prev.edges.map((edge) => {
          if (edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId) {
            return rerouteEdge(edge, nextNodes);
          }
          return edge;
        });
        return { ...prev, nodes: nextNodes, edges: nextEdges };
      });
    }
    // 3. Dragging an Edge Waypoint
    else if (dragTypeRef.current === "edge-point") {
      const { edgeId, pointIndex } = dragTargetRef.current;
      const initial = dragStartPositionsRef.current;
      if (!initial) return;

      const newX = snapCoord(initial.pointX + dxCanvas);
      const newY = snapCoord(initial.pointY + dyCanvas);

      setGraph((prev) => {
        const nextEdges = prev.edges.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const pts = edge.points.map((p, idx) =>
            idx === pointIndex ? { x: newX, y: newY } : p
          );
          return { ...edge, points: pts };
        });
        return { ...prev, edges: nextEdges };
      });
    }
    // 4. Pan canvas
    else if (dragTypeRef.current === "pan") {
      const initial = dragStartPositionsRef.current;
      if (!initial) return;
      setPan({
        x: initial.panX + dxScreen,
        y: initial.panY + dyScreen,
      });
    }
  };

  // --- Handlers: Mouse Up ---
  const handleMouseUp = () => {
    // Finish anchor connection if active
    if (connectingState) {
      if (connectingState.targetNodeId && connectingState.targetPort) {
        const srcNode = graph.nodes.find((n) => n.id === connectingState.sourceNodeId);
        const tgtNode = graph.nodes.find((n) => n.id === connectingState.targetNodeId);
        if (srcNode && tgtNode) {
          const srcAnchors = getNodeAnchorPoints(srcNode);
          const tgtAnchors = getNodeAnchorPoints(tgtNode);
          const p1 = srcAnchors[connectingState.sourcePort];
          const p2 = tgtAnchors[connectingState.targetPort];

          const newEdge = {
            id: `edge_${nextIdRef.current++}`,
            sourceNodeId: srcNode.id,
            sourcePort: connectingState.sourcePort,
            targetNodeId: tgtNode.id,
            targetPort: connectingState.targetPort,
            points: calculateOrthogonalRoute(p1, p1.dir, p2, p2.dir),
            hasArrow: true,
            marker: diagramType === "uml" ? "arrow-uml" : "arrow-flow",
            isOrthogonal: true,
            label: "",
            labelPos: null,
          };

          const nextGraph = {
            ...graph,
            edges: [...graph.edges, newEdge],
          };
          pushHistory(nextGraph);
          setSelectedEdgeId(newEdge.id);
          setSelectedNodeId(null);
        }
      }
      setConnectingState(null);
    }

    if (isDraggingRef.current) {
      if (dragTypeRef.current === "node" || dragTypeRef.current === "edge-point") {
        pushHistory(graph);
      }
      isDraggingRef.current = false;
      dragTypeRef.current = null;
      dragTargetRef.current = null;
    }
  };

  // Wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = Math.min(Math.max(0.2, zoom * zoomFactor), 3.0);
    setZoom(nextZoom);
  };

  // Double click to edit text inline
  const handleNodeDoubleClick = (e, node) => {
    e.stopPropagation();
    setEditingNodeId(node.id);
    setEditingText(node.text);
  };

  const handleFinishTextEdit = () => {
    if (!editingNodeId) return;
    const nextNodes = graph.nodes.map((n) => {
      if (n.id !== editingNodeId) return n;
      const lines = editingText.split("\n");
      const maxLen = Math.max(...lines.map((l) => l.length), 1);
      const autoW = Math.max(n.w, maxLen * 8.5 + 32);
      const autoH = Math.max(n.h, lines.length * 18 + 16);
      return { ...n, text: editingText, w: autoW, h: autoH };
    });
    // Re-route attached edges
    const nextEdges = graph.edges.map((e) => rerouteEdge(e, nextNodes));
    const nextGraph = { ...graph, nodes: nextNodes, edges: nextEdges };
    pushHistory(nextGraph);
    setEditingNodeId(null);
  };

  // Properties: Update Node Text
  const handleUpdateNodeText = (newText) => {
    if (!selectedNodeId) return;
    const nextNodes = graph.nodes.map((n) => {
      if (n.id !== selectedNodeId) return n;
      const lines = newText.split("\n");
      const maxLen = Math.max(...lines.map((l) => l.length), 1);
      const autoW = Math.max(100, maxLen * 8.5 + 30);
      const autoH = Math.max(38, lines.length * 18 + 14);
      return { ...n, text: newText, w: autoW, h: autoH };
    });
    const nextEdges = graph.edges.map((e) => rerouteEdge(e, nextNodes));
    pushHistory({ ...graph, nodes: nextNodes, edges: nextEdges });
  };

  // Properties: Update Node Type
  const handleUpdateNodeType = (newType) => {
    if (!selectedNodeId) return;
    const nextNodes = graph.nodes.map((n) => {
      if (n.id !== selectedNodeId) return n;
      const isPredefined = newType === "predefined";
      return { ...n, type: newType, isPredefined };
    });
    pushHistory({ ...graph, nodes: nextNodes });
  };

  // Properties: Update Edge Label
  const handleUpdateEdgeLabel = (newLabel) => {
    if (!selectedEdgeId) return;
    const nextEdges = graph.edges.map((e) => {
      if (e.id !== selectedEdgeId) return e;
      const p1 = e.points[0];
      const p2 = e.points[1] || p1;
      const labelPos = e.labelPos || { x: (p1.x + p2.x) / 2 + 10, y: (p1.y + p2.y) / 2 - 8 };
      return { ...e, label: newLabel, labelPos };
    });
    pushHistory({ ...graph, edges: nextEdges });
  };

  // Properties: Toggle Arrowhead
  const handleToggleArrowhead = () => {
    if (!selectedEdgeId) return;
    const nextEdges = graph.edges.map((e) =>
      e.id === selectedEdgeId ? { ...e, hasArrow: !e.hasArrow } : e
    );
    pushHistory({ ...graph, edges: nextEdges });
  };

  // Properties: Toggle Orthogonal vs Straight
  const handleToggleOrthogonal = () => {
    if (!selectedEdgeId) return;
    const nextEdges = graph.edges.map((e) => {
      if (e.id !== selectedEdgeId) return e;
      if (e.isOrthogonal) {
        // Straighten
        const pStart = e.points[0];
        const pEnd = e.points[e.points.length - 1];
        return { ...e, isOrthogonal: false, points: [pStart, pEnd] };
      } else {
        // Recompute orthogonal
        return { ...e, isOrthogonal: true, ...rerouteEdge(e, graph.nodes) };
      }
    });
    pushHistory({ ...graph, edges: nextEdges });
  };

  // Properties: Add Bend Waypoint
  const handleAddEdgeBend = () => {
    if (!selectedEdgeId) return;
    const nextEdges = graph.edges.map((e) => {
      if (e.id !== selectedEdgeId) return e;
      const pts = [...e.points];
      if (pts.length >= 2) {
        const midX = Math.round((pts[0].x + pts[1].x) / 2);
        const midY = Math.round((pts[0].y + pts[1].y) / 2);
        pts.splice(1, 0, { x: midX, y: midY });
      }
      return { ...e, points: pts };
    });
    pushHistory({ ...graph, edges: nextEdges });
  };

  // Add block from palette
  const handleAddShape = (shapeDef) => {
    const center = screenToCanvas(
      window.innerWidth / 2,
      window.innerHeight / 2
    );

    const newNode = {
      id: `node_${nextIdRef.current++}`,
      type: shapeDef.type,
      cx: snapCoord(center.x),
      cy: snapCoord(center.y),
      w: shapeDef.w,
      h: shapeDef.h,
      text: shapeDef.defaultText,
      isPredefined: Boolean(shapeDef.isPredefined),
      isUml: diagramType === "uml",
    };

    const nextGraph = {
      ...graph,
      nodes: [...graph.nodes, newNode],
    };
    pushHistory(nextGraph);
    setSelectedNodeId(newNode.id);
    setSelectedEdgeId(null);
  };

  // Save changes (ALWAYS export standard clean paper-white SVG for reports/cards/print)
  const handleSaveAndClose = () => {
    const regeneratedSvg = graphToSvg(graph, { isDark: false });
    onSave(regeneratedSvg, diagramType);
    onClose();
  };

  // Reset to original C++
  const handleReset = () => {
    if (confirm("Скинути всі ручні зміни діаграми та повернутися до коду C++?")) {
      onResetToCode();
      onClose();
    }
  };

  return (
    <div className={`drawio-modal-overlay ${editorThemeDark ? "dark" : ""}`}>
      <div className="drawio-studio-window">
        {/* --- Top App Header Bar --- */}
        <header className="drawio-top-bar">
          <div className="drawio-brand-area">
            <span className="drawio-logo-badge">📐 Studio</span>
            <span className="drawio-diagram-title">{diagramTitle}</span>
            {isCustomized && (
              <span className="drawio-custom-badge">Змінено вручну</span>
            )}
          </div>

          <div className="drawio-top-center-tools">
            <button
              className="drawio-tool-btn"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Скасувати (Ctrl+Z)"
            >
              <Undo2 size={15} />
            </button>
            <button
              className="drawio-tool-btn"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Повернути (Ctrl+Y)"
            >
              <Redo2 size={15} />
            </button>
            <div className="drawio-sep" />
            <button
              className="drawio-tool-btn"
              onClick={handleDuplicateSelected}
              disabled={!selectedNodeId}
              title="Дублювати виділений блок (Ctrl+D)"
            >
              <Copy size={15} />
            </button>
            <button
              className="drawio-tool-btn text-danger"
              onClick={handleDeleteSelected}
              disabled={!selectedNodeId && !selectedEdgeId}
              title="Видалити виділене (Delete)"
            >
              <Trash2 size={15} />
            </button>
            <div className="drawio-sep" />
            <button
              className={`drawio-tool-btn ${snapToGrid ? "active" : ""}`}
              onClick={() => setSnapToGrid(!snapToGrid)}
              title="Прив'язка до сітки 10px (Snap to Grid)"
            >
              <Grid size={15} />
            </button>
            <button
              className="drawio-tool-btn"
              onClick={() => setEditorThemeDark(!editorThemeDark)}
              title={editorThemeDark ? "Перемкнути на світлу тему полотна" : "Перемкнути на темну тему полотна"}
            >
              {editorThemeDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>

          <div className="drawio-top-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleReset}
              title="Скинути до автогенерації з C++ коду"
            >
              <RotateCcw size={14} /> Скинути до C++
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSaveAndClose}
              title="Застосувати зміни на діаграмі"
            >
              <Check size={14} /> Застосувати зміни
            </button>
            <button
              className="drawio-close-btn"
              onClick={onClose}
              title="Закрити без збереження"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* --- Main 3-Column Studio Body --- */}
        <div className="drawio-studio-body">
          {/* --- Left Column: Shapes Library --- */}
          <aside className="drawio-shapes-sidebar">
            <div className="shapes-header">
              <span>Палітра фігур</span>
            </div>
            <div className="shapes-list">
              {SHAPES_PALETTE.map((shape) => (
                <button
                  key={shape.type}
                  className="shape-item-btn"
                  onClick={() => handleAddShape(shape)}
                  title={`Додати ${shape.title}: ${shape.desc}`}
                >
                  <span className="shape-icon-preview">{shape.icon}</span>
                  <div className="shape-meta">
                    <span className="shape-name">{shape.title}</span>
                    <span className="shape-desc">{shape.desc}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="drawio-tips-box">
              <span className="tips-title">💡 Магнітні порти:</span>
              <p>Наведіть на будь-який блок — з'являться 4 сині кружечки. Затисніть кружечок і тягніть стрілку до іншого блоку!</p>
            </div>
          </aside>

          {/* --- Center Column: Interactive Canvas --- */}
          <main
            className="drawio-canvas-area"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
          >
            <svg
              ref={canvasRef}
              className="drawio-svg-canvas"
              width="100%"
              height="100%"
            >
              <defs>
                {/* Dot Grid Pattern */}
                <pattern
                  id="drawio-grid-pattern"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="10" cy="10" r="1.2" fill={colors.gridDot} opacity="0.75" />
                </pattern>

                {/* Arrow Markers */}
                <marker
                  id="arrow-flow"
                  viewBox="0 0 12 12"
                  refX="10"
                  refY="6"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 1 2 L 10 6 L 1 10 z" fill={colors.edgeStroke} />
                </marker>
                <marker
                  id="arrow-flow-selected"
                  viewBox="0 0 12 12"
                  refX="10"
                  refY="6"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 1 2 L 10 6 L 1 10 z" fill="#2563eb" />
                </marker>
                <marker
                  id="arrow-flow-connecting"
                  viewBox="0 0 12 12"
                  refX="10"
                  refY="6"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 1 2 L 10 6 L 1 10 z" fill="#10b981" />
                </marker>
                <marker
                  id="arrow-uml"
                  viewBox="0 0 12 12"
                  refX="10"
                  refY="6"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 1 2 L 10 6 L 1 10 z" fill={colors.edgeStroke} />
                </marker>
              </defs>

              {/* Background with Grid */}
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill={colors.canvasBg}
              />
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="url(#drawio-grid-pattern)"
              />

              {/* Viewport with Pan and Zoom */}
              <g
                transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
                className="drawio-viewport-layer"
              >
                {/* 1. EDGES LAYER */}
                <g className="drawio-edges-layer">
                  {graph.edges.map((edge) => {
                    const isSelected = selectedEdgeId === edge.id;
                    const pts = edge.points;
                    if (pts.length < 2) return null;

                    let linePath = "";
                    if (pts.length === 2) {
                      linePath = `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
                    } else {
                      linePath = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
                    }

                    const markerUrl = edge.hasArrow
                      ? isSelected
                        ? "url(#arrow-flow-selected)"
                        : edge.marker === "arrow-uml"
                          ? "url(#arrow-uml)"
                          : "url(#arrow-flow)"
                      : undefined;

                    return (
                      <g
                        key={edge.id}
                        className={`drawio-edge-group ${isSelected ? "selected" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEdgeId(edge.id);
                          setSelectedNodeId(null);
                        }}
                      >
                        {/* Fat invisible line for easy clicking */}
                        <path
                          d={linePath}
                          stroke="transparent"
                          strokeWidth="16"
                          fill="none"
                          cursor="pointer"
                        />
                        {/* Visual Path */}
                        <path
                          d={linePath}
                          stroke={isSelected ? "#2563eb" : colors.edgeStroke}
                          strokeWidth={isSelected ? "2.6" : "2"}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          fill="none"
                          markerEnd={markerUrl}
                        />

                        {/* Edge Label */}
                        {edge.label && (
                          <text
                            x={edge.labelPos ? edge.labelPos.x : (pts[0].x + pts[1].x) / 2 + 8}
                            y={edge.labelPos ? edge.labelPos.y : (pts[0].y + pts[1].y) / 2 - 6}
                            fontFamily="system-ui, sans-serif"
                            fontSize="13"
                            fontWeight="bold"
                            fill={editorThemeDark ? "#38bdf8" : "#0f172a"}
                            cursor="pointer"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              const newLbl = prompt("Підпис стрілки:", edge.label);
                              if (newLbl !== null) handleUpdateEdgeLabel(newLbl);
                            }}
                          >
                            {edge.label}
                          </text>
                        )}

                        {/* Interactive Waypoint Handles */}
                        {isSelected &&
                          pts.map((pt, ptIdx) => {
                            const isEndpoint = ptIdx === 0 || ptIdx === pts.length - 1;
                            return (
                              <circle
                                key={ptIdx}
                                cx={pt.x}
                                cy={pt.y}
                                r={isEndpoint ? 6 : 5}
                                fill={isEndpoint ? "#2563eb" : "#38bdf8"}
                                stroke={colors.anchorBorder}
                                strokeWidth="2"
                                cursor="grab"
                                className="drawio-waypoint-handle"
                                onMouseDown={(e) => handleEdgePointMouseDown(e, edge.id, ptIdx)}
                              />
                            );
                          })}
                      </g>
                    );
                  })}

                  {/* Temporary connecting line when dragging from anchor port */}
                  {connectingState && (
                    <line
                      x1={connectingState.startPt.x}
                      y1={connectingState.startPt.y}
                      x2={connectingState.currentPt.x}
                      y2={connectingState.currentPt.y}
                      stroke="#10b981"
                      strokeWidth="2.4"
                      strokeDasharray="5 3"
                      markerEnd="url(#arrow-flow-connecting)"
                    />
                  )}
                </g>

                {/* 2. NODES LAYER */}
                <g className="drawio-nodes-layer">
                  {graph.nodes.map((node) => {
                    const isSelected = selectedNodeId === node.id;
                    const isHovered = hoveredNodeId === node.id;
                    const isSnapTarget = connectingState?.targetNodeId === node.id;
                    const x = node.cx - node.w / 2;
                    const y = node.cy - node.h / 2;
                    const anchors = getNodeAnchorPoints(node);

                    return (
                      <g
                        key={node.id}
                        className={`drawio-node-group ${isSelected ? "selected" : ""} ${isSnapTarget ? "snap-target" : ""}`}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                        onDoubleClick={(e) => handleNodeDoubleClick(e, node)}
                        cursor="grab"
                      >
                        {/* Render Node Shape */}
                        {node.type === "start" || node.type === "end" ? (
                          <rect
                            x={x}
                            y={y}
                            width={node.w}
                            height={node.h}
                            rx={node.h / 2}
                            ry={node.h / 2}
                            fill={colors.nodeFill}
                            stroke={isSelected ? "#2563eb" : colors.nodeStroke}
                            strokeWidth={isSelected ? "2.5" : "1.8"}
                          />
                        ) : node.type === "rhombus" ? (
                          <polygon
                            points={`${node.cx},${y} ${node.cx + node.w / 2},${node.cy} ${node.cx},${node.cy + node.h / 2} ${node.cx - node.w / 2},${node.cy}`}
                            fill={colors.nodeFill}
                            stroke={isSelected ? "#2563eb" : colors.nodeStroke}
                            strokeWidth={isSelected ? "2.5" : "1.8"}
                          />
                        ) : node.type === "input" ? (
                          <polygon
                            points={`${x + 14},${y} ${x + node.w},${y} ${x + node.w - 14},${y + node.h} ${x},${y + node.h}`}
                            fill={colors.nodeFill}
                            stroke={isSelected ? "#2563eb" : colors.nodeStroke}
                            strokeWidth={isSelected ? "2.5" : "1.8"}
                          />
                        ) : node.type === "output" ? (
                          <path
                            d={`M ${x},${y} L ${x + node.w},${y} L ${x + node.w},${y + node.h - 6} C ${x + node.w * 0.72},${y + node.h + 5} ${x + node.w * 0.28},${y + node.h - 12} ${x},${y + node.h - 6} Z`}
                            fill={colors.nodeFill}
                            stroke={isSelected ? "#2563eb" : colors.nodeStroke}
                            strokeWidth={isSelected ? "2.5" : "1.8"}
                          />
                        ) : node.type === "uml-action" ? (
                          <rect
                            x={x}
                            y={y}
                            width={node.w}
                            height={node.h}
                            rx="15"
                            ry="15"
                            fill={colors.nodeFill}
                            stroke={isSelected ? "#2563eb" : colors.nodeStroke}
                            strokeWidth={isSelected ? "2.5" : "1.8"}
                          />
                        ) : (
                          <g>
                            <rect
                              x={x}
                              y={y}
                              width={node.w}
                              height={node.h}
                              rx={node.type === "structure-chart-node" ? "5" : "0"}
                              ry={node.type === "structure-chart-node" ? "5" : "0"}
                              fill={colors.nodeFill}
                              stroke={isSelected ? "#2563eb" : colors.nodeStroke}
                              strokeWidth={isSelected ? "2.5" : "1.8"}
                            />
                            {node.isPredefined && (
                              <g>
                                <line
                                  x1={x + 10}
                                  y1={y}
                                  x2={x + 10}
                                  y2={y + node.h}
                                  stroke={colors.nodeStroke}
                                  strokeWidth="1.5"
                                />
                                <line
                                  x1={x + node.w - 10}
                                  y1={y}
                                  x2={x + node.w - 10}
                                  y2={y + node.h}
                                  stroke={colors.nodeStroke}
                                  strokeWidth="1.5"
                                />
                              </g>
                            )}
                          </g>
                        )}

                        {/* Node Text lines */}
                        {node.text
                          .split("\n")
                          .map((line, lineIdx, arr) => {
                            const lineH = 17;
                            const startY = node.cy - ((arr.length - 1) * lineH) / 2;
                            return (
                              <text
                                key={lineIdx}
                                x={node.cx}
                                y={startY + lineIdx * lineH}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontFamily="system-ui, -apple-system, sans-serif"
                                fontSize="13.5"
                                fontWeight="500"
                                fill={colors.nodeText}
                                pointerEvents="none"
                              >
                                {line}
                              </text>
                            );
                          })}

                        {/* Selection Bounding Outline */}
                        {isSelected && (
                          <g pointerEvents="none">
                            <rect
                              x={x - 4}
                              y={y - 4}
                              width={node.w + 8}
                              height={node.h + 8}
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth="1.5"
                              strokeDasharray="4 3"
                            />
                            <circle cx={x - 4} cy={y - 4} r="3.5" fill="#2563eb" />
                            <circle cx={x + node.w + 4} cy={y - 4} r="3.5" fill="#2563eb" />
                            <circle cx={x - 4} cy={y + node.h + 4} r="3.5" fill="#2563eb" />
                            <circle cx={x + node.w + 4} cy={y + node.h + 4} r="3.5" fill="#2563eb" />
                          </g>
                        )}

                        {/* 4 Magnetic Anchor Ports (Draw.io style) */}
                        {(isHovered || isSelected || connectingState) && (
                          <g className="drawio-anchor-ports-group">
                            {Object.entries(anchors).map(([portKey, pt]) => {
                              const isTargetActive =
                                isSnapTarget && connectingState?.targetPort === portKey;
                              return (
                                <circle
                                  key={portKey}
                                  cx={pt.x}
                                  cy={pt.y}
                                  r={isTargetActive ? 6.5 : 4.5}
                                  fill={isTargetActive ? "#10b981" : colors.anchorFill}
                                  stroke={colors.anchorBorder}
                                  strokeWidth="1.8"
                                  cursor="crosshair"
                                  className={`drawio-anchor-port ${isTargetActive ? "target-active" : ""}`}
                                  onMouseDown={(e) => handleAnchorMouseDown(e, node, portKey)}
                                />
                              );
                            })}
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
              </g>
            </svg>

            {/* Direct Inline Text Editing Overlay */}
            {editingNodeId && selectedNode && (
              <div
                className="drawio-inline-text-editor"
                style={{
                  left: pan.x + (selectedNode.cx - selectedNode.w / 2) * zoom,
                  top: pan.y + (selectedNode.cy - selectedNode.h / 2) * zoom,
                  width: Math.max(140, selectedNode.w * zoom),
                }}
              >
                <textarea
                  autoFocus
                  className="drawio-inline-textarea"
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleFinishTextEdit();
                    }
                  }}
                  rows={Math.max(2, editingText.split("\n").length)}
                />
                <button
                  className="drawio-inline-save-btn"
                  onClick={handleFinishTextEdit}
                  title="Зберегти текст (Enter)"
                >
                  <Check size={14} />
                </button>
              </div>
            )}

            {/* Bottom-left Zoom Controls */}
            <div className="drawio-floating-zoom">
              <button
                className="zoom-pill-btn"
                onClick={() => setZoom((z) => Math.max(0.2, z - 0.15))}
                title="Зменшити"
              >
                <ZoomOut size={13} />
              </button>
              <span className="zoom-pill-text">{Math.round(zoom * 100)}%</span>
              <button
                className="zoom-pill-btn"
                onClick={() => setZoom((z) => Math.min(3.0, z + 0.15))}
                title="Збільшити"
              >
                <ZoomIn size={13} />
              </button>
              <button
                className="zoom-pill-btn"
                onClick={() => {
                  setZoom(1.0);
                  setPan({ x: 120, y: 70 });
                }}
                title="Скинути до 100%"
              >
                <Maximize2 size={13} />
              </button>
            </div>
          </main>

          {/* --- Right Column: Format & Properties Panel --- */}
          <aside className="drawio-properties-sidebar">
            <div className="properties-header">
              <span>Панель властивостей</span>
            </div>

            {selectedNode ? (
              <div className="properties-body">
                <div className="prop-section">
                  <label className="prop-label">
                    <FileText size={13} /> Текст блоку
                  </label>
                  <textarea
                    className="prop-textarea"
                    value={selectedNode.text}
                    onChange={(e) => handleUpdateNodeText(e.target.value)}
                    rows={3}
                  />
                  <span className="prop-subtext">
                    Двічі клікніть прямо на блок на полотні для швидкого редагування
                  </span>
                </div>

                <div className="prop-section">
                  <label className="prop-label">
                    <Square size={13} /> Тип фігури
                  </label>
                  <select
                    className="prop-select"
                    value={selectedNode.type}
                    onChange={(e) => handleUpdateNodeType(e.target.value)}
                  >
                    {SHAPES_PALETTE.map((bt) => (
                      <option key={bt.type} value={bt.type}>
                        {bt.icon} {bt.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="prop-section">
                  <label className="prop-label">📐 Геометрія (X, Y, Ш, В)</label>
                  <div className="geom-grid">
                    <div className="geom-cell">
                      <span>X</span> <strong>{Math.round(selectedNode.cx)}</strong>
                    </div>
                    <div className="geom-cell">
                      <span>Y</span> <strong>{Math.round(selectedNode.cy)}</strong>
                    </div>
                    <div className="geom-cell">
                      <span>Ш</span> <strong>{Math.round(selectedNode.w)}</strong>
                    </div>
                    <div className="geom-cell">
                      <span>В</span> <strong>{Math.round(selectedNode.h)}</strong>
                    </div>
                  </div>
                </div>

                <div className="prop-section-actions">
                  <button
                    className="btn btn-secondary btn-sm w-full mb-2"
                    onClick={handleDuplicateSelected}
                  >
                    <Copy size={13} /> Дублювати блок (Ctrl+D)
                  </button>
                  <button
                    className="btn btn-danger btn-sm w-full"
                    onClick={handleDeleteSelected}
                  >
                    <Trash2 size={13} /> Видалити блок (Delete)
                  </button>
                </div>
              </div>
            ) : selectedEdge ? (
              <div className="properties-body">
                <div className="prop-section">
                  <label className="prop-label">🏷️ Підпис стрілки / умови</label>
                  <input
                    type="text"
                    className="prop-input"
                    value={selectedEdge.label || ""}
                    placeholder="+, -, [x > 0], рекурсія..."
                    onChange={(e) => handleUpdateEdgeLabel(e.target.value)}
                  />
                </div>

                <div className="prop-section">
                  <label className="prop-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedEdge.hasArrow)}
                      onChange={handleToggleArrowhead}
                    />
                    <span>
                      <ArrowRight size={14} /> Наконечник стрілки на кінці
                    </span>
                  </label>
                </div>

                <div className="prop-section">
                  <label className="prop-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedEdge.isOrthogonal)}
                      onChange={handleToggleOrthogonal}
                    />
                    <span>
                      <Split size={14} /> Ортогональна ламана (90°)
                    </span>
                  </label>
                </div>

                <div className="prop-section-actions">
                  <button
                    className="btn btn-secondary btn-sm w-full mb-2"
                    onClick={handleAddEdgeBend}
                    title="Додати додаткове коліно для обходу перешкод"
                  >
                    <CornerDownRight size={13} /> Додати точку згину
                  </button>
                  <button
                    className="btn btn-danger btn-sm w-full"
                    onClick={handleDeleteSelected}
                  >
                    <Trash2 size={13} /> Видалити стрілку (Delete)
                  </button>
                </div>
              </div>
            ) : (
              <div className="properties-empty-state">
                <p className="empty-text">
                  Виділіть будь-який блок або стрілку для редагування параметрів.
                </p>

                <div className="drawio-guide-card">
                  <h4>⚡ Швидкі клавіші:</h4>
                  <ul>
                    <li><kbd>Ctrl+Z</kbd> — Скасувати дію</li>
                    <li><kbd>Ctrl+Y</kbd> — Повернути дію</li>
                    <li><kbd>Ctrl+D</kbd> — Дублювати блок</li>
                    <li><kbd>Delete</kbd> — Видалити виділене</li>
                    <li><kbd>2x-Click</kbd> — Редагувати текст</li>
                    <li><kbd>Колесо</kbd> — Масштабування</li>
                    <li><kbd>Drag тла</kbd> — Панорамування</li>
                  </ul>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
