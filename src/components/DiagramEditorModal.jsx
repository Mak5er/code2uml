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
  ArrowDownFromLine,
  ArrowUpFromLine,
  Hand,
  BoxSelect,
} from "lucide-react";
import {
  extractGraphFromSvg,
  graphToSvg,
  getNodeAnchorPoints,
  getNearestAnchorPort,
  calculateOrthogonalRoute,
  isPhysicalMouseWheel,
} from "../utils/diagramGraph.js";

export function ShapePaletteIcon({ type }) {
  const commonProps = {
    width: "24",
    height: "16",
    viewBox: "0 0 24 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
  };

  switch (type) {
    case "process":
      return (
        <svg {...commonProps}>
          <rect x="2" y="2" width="20" height="12" rx="1.5" />
        </svg>
      );
    case "predefined":
      return (
        <svg {...commonProps}>
          <rect x="2" y="2" width="20" height="12" rx="1.5" />
          <line x1="6.5" y1="2" x2="6.5" y2="14" strokeWidth="1.5" />
          <line x1="17.5" y1="2" x2="17.5" y2="14" strokeWidth="1.5" />
        </svg>
      );
    case "rhombus":
      return (
        <svg {...commonProps}>
          <polygon points="12,1.5 22,8 12,14.5 2,8" strokeLinejoin="round" />
        </svg>
      );
    case "input":
      return (
        <svg {...commonProps}>
          <polygon points="5.5,2 22,2 18.5,14 2,14" strokeLinejoin="round" />
        </svg>
      );
    case "output":
      return (
        <svg {...commonProps}>
          <path d="M 2 2 L 22 2 L 22 10.5 C 17 13.5, 7 8.5, 2 11.5 Z" strokeLinejoin="round" />
        </svg>
      );
    case "start":
    case "end":
      return (
        <svg {...commonProps}>
          <rect x="2" y="2.5" width="20" height="11" rx="5.5" />
        </svg>
      );
    case "connector":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="6" strokeWidth="1.8" />
          <text
            x="12"
            y="8"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="7"
            fontWeight="bold"
            fill="currentColor"
            stroke="none"
          >
            1
          </text>
        </svg>
      );
    case "uml-initial":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="5.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "uml-final":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <circle cx="12" cy="8" r="3.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "uml-action":
      return (
        <svg {...commonProps}>
          <rect x="2" y="2" width="20" height="12" rx="5" />
        </svg>
      );
    case "uml-call":
      return (
        <svg {...commonProps}>
          <rect x="2" y="2" width="20" height="12" rx="5" />
          <line x1="6.5" y1="2" x2="6.5" y2="14" strokeWidth="1.4" />
          <line x1="17.5" y1="2" x2="17.5" y2="14" strokeWidth="1.4" />
        </svg>
      );
    case "uml-diamond":
      return (
        <svg {...commonProps}>
          <polygon points="12,2 20,8 12,14 4,8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case "uml-fork-join":
      return (
        <svg {...commonProps}>
          <rect x="2" y="6" width="20" height="4" rx="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "structure-chart-node":
      return (
        <svg {...commonProps}>
          <rect x="2" y="2" width="20" height="12" rx="2" />
          <line x1="2" y1="5.5" x2="22" y2="5.5" strokeWidth="1.4" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <rect x="2" y="2" width="20" height="12" rx="1.5" />
        </svg>
      );
  }
}

const FLOWCHART_SHAPES = [
  {
    type: "start",
    title: "Початок",
    desc: "Початковий вузол (овал за ДСТУ)",
    defaultText: "початок",
    w: 110,
    h: 40,
  },
  {
    type: "process",
    title: "Процес (Дія)",
    desc: "Операція / присвоєння (прямокутник)",
    defaultText: "x = a + b",
    w: 120,
    h: 42,
  },
  {
    type: "predefined",
    title: "Зумовлений процес",
    desc: "Виклик підпрограми / функції",
    defaultText: "f(n)",
    w: 130,
    h: 42,
    isPredefined: true,
  },
  {
    type: "rhombus",
    title: "Умова (Ромб)",
    desc: "Розгалуження if / switch",
    defaultText: "x > 0",
    w: 110,
    h: 52,
  },
  {
    type: "input",
    title: "Ввід даних",
    desc: "Паралелограм введення (cin)",
    defaultText: "x",
    w: 115,
    h: 42,
  },
  {
    type: "output",
    title: "Вивід даних",
    desc: "Документ / виведення (cout)",
    defaultText: "y",
    w: 115,
    h: 42,
  },
  {
    type: "connector",
    title: "З'єднувач ліній",
    desc: "Міжсторінковий перехід (коло)",
    defaultText: "1",
    w: 28,
    h: 28,
  },
  {
    type: "end",
    title: "Кінець",
    desc: "Кінцевий вузол (овал за ДСТУ)",
    defaultText: "кінець",
    w: 110,
    h: 40,
  },
];

const UML_SHAPES = [
  {
    type: "uml-initial",
    title: "Початковий вузол",
    desc: "Initial Node (заповнене коло)",
    defaultText: "",
    w: 24,
    h: 24,
    isUml: true,
  },
  {
    type: "uml-action",
    title: "Дія (Action)",
    desc: "Стан дії (скруглений прямокутник)",
    defaultText: "action()",
    w: 120,
    h: 38,
    isUml: true,
  },
  {
    type: "uml-call",
    title: "Виклик поведінки",
    desc: "Call Behavior Action (з подвійними лініями)",
    defaultText: "doOperation()",
    w: 130,
    h: 40,
    isUml: true,
  },
  {
    type: "uml-diamond",
    title: "Розгалуження / Злиття",
    desc: "Decision / Merge (ромб UML)",
    defaultText: "",
    w: 26,
    h: 26,
    isUml: true,
  },
  {
    type: "uml-fork-join",
    title: "Синхронізація",
    desc: "Fork / Join Bar (смуга паралелізму)",
    defaultText: "",
    w: 70,
    h: 8,
    isUml: true,
  },
  {
    type: "uml-final",
    title: "Кінцевий вузол",
    desc: "Activity Final Node (буллзай)",
    defaultText: "",
    w: 26,
    h: 26,
    isUml: true,
  },
];

const STRUCTURE_SHAPES = [
  {
    type: "structure-chart-node",
    title: "Модуль програми",
    desc: "Блок структурної схеми (Лаб 5)",
    defaultText: "module()",
    w: 130,
    h: 46,
  },
];

const ALL_SHAPES = [
  ...FLOWCHART_SHAPES,
  ...UML_SHAPES,
  ...STRUCTURE_SHAPES,
];

// Re-route an edge using ports or waypoints
function rerouteEdge(edge, allNodes) {
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
}

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
  const [canvasTool, setCanvasTool] = useState("pan"); // 'pan' (hand drag) | 'marquee' (box selection)

  // Selection (supports multi-selection for strips and groups of blocks)
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const selectedNodeId = selectedNodeIds[0] || null;
  const setSelectedNodeId = useCallback((id) => {
    setSelectedNodeIds(id ? [id] : []);
  }, []);

  // Palette category tab: 'flowchart' | 'uml' | 'structure'
  const [userTab, setUserTab] = useState(null);
  const [prevDiagramType, setPrevDiagramType] = useState(diagramType);
  if (prevDiagramType !== diagramType) {
    setPrevDiagramType(diagramType);
    setUserTab(null);
  }

  const paletteCategory =
    userTab ||
    (diagramType === "uml"
      ? "uml"
      : diagramType === "structure-chart"
        ? "structure"
        : "flowchart");
  const setPaletteCategory = setUserTab;

  const currentShapes =
    paletteCategory === "uml"
      ? UML_SHAPES
      : paletteCategory === "structure"
        ? STRUCTURE_SHAPES
        : FLOWCHART_SHAPES;

  // Marquee selection box in canvas coordinates: { x, y, w, h }
  const [marqueeBox, setMarqueeBox] = useState(null);
  const marqueeStartCanvasRef = useRef({ x: 0, y: 0 });

  // Spacebar pan mode & Touchpad canvas ref
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const canvasAreaRef = useRef(null);

  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  // Hover states
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // Connection Dragging (Anchor port to anchor port)
  const [connectingState, setConnectingState] = useState(null);

  // Dragging state
  const isDraggingRef = useRef(false);
  const dragTypeRef = useRef(null); // 'node' | 'edge-point' | 'edge-segment' | 'pan' | 'marquee'
  const dragTargetRef = useRef(null);
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
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setGraph(next);
      setSelectedNodeIds([]);
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

  // Natural Mac Touchpad pan & pinch-to-zoom handling
  useEffect(() => {
    if (!isOpen) return;
    const canvasArea = canvasAreaRef.current;
    if (!canvasArea) return;

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
          targetZoom = Math.min(Math.max(0.2, currentZoom + step), 3.0);
        } else {
          const zoomDelta = -e.deltaY * 0.005;
          targetZoom = Math.min(Math.max(0.2, currentZoom + zoomDelta), 3.0);
        }

        const rect = canvasArea.getBoundingClientRect();
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
        // Two-finger touchpad pan (smooth 2D translation)
        setPan((prev) => ({
          x: Math.round(prev.x - e.deltaX * 0.95),
          y: Math.round(prev.y - e.deltaY * 0.95),
        }));
      }
    };

    canvasArea.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvasArea.removeEventListener("wheel", onWheel);
    };
  }, [isOpen]);

  // Spacebar pan mode listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable
      ) {
        return;
      }
      if (e.code === "Space" && !e.repeat) {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isOpen]);

  // Duplicate Selected Node(s)
  const handleDuplicateSelected = useCallback(() => {
    if (!selectedNodeIds.length) return;
    const newNodes = [];
    selectedNodeIds.forEach((id) => {
      const srcNode = graph.nodes.find((n) => n.id === id);
      if (srcNode) {
        newNodes.push({
          ...srcNode,
          id: `node_${nextIdRef.current++}`,
          cx: srcNode.cx + 40,
          cy: srcNode.cy + 40,
        });
      }
    });
    if (!newNodes.length) return;
    const nextGraph = {
      ...graph,
      nodes: [...graph.nodes, ...newNodes],
    };
    pushHistory(nextGraph);
    setSelectedNodeIds(newNodes.map((n) => n.id));
  }, [graph, selectedNodeIds, pushHistory]);

  // Delete Selected Entity
  const handleDeleteSelected = useCallback(() => {
    if (selectedNodeIds.length > 0) {
      const idSet = new Set(selectedNodeIds);
      const nextNodes = graph.nodes.filter((n) => !idSet.has(n.id));
      const nextEdges = graph.edges.filter(
        (e) => !idSet.has(e.sourceNodeId) && !idSet.has(e.targetNodeId)
      );
      const nextGraph = { ...graph, nodes: nextNodes, edges: nextEdges };
      pushHistory(nextGraph);
      setSelectedNodeIds([]);
    } else if (selectedEdgeId) {
      const nextEdges = graph.edges.filter((e) => e.id !== selectedEdgeId);
      const nextGraph = { ...graph, edges: nextEdges };
      pushHistory(nextGraph);
      setSelectedEdgeId(null);
    }
  }, [graph, selectedNodeIds, selectedEdgeId, pushHistory]);

  // Shift Section / Insert Space (move selected and all nodes below)
  const handleShiftBelow = useCallback((deltaY = 60) => {
    if (!graph.nodes.length) return;

    let cutoffY = -Infinity;
    if (selectedNodeIds.length > 0) {
      const selected = graph.nodes.filter((n) => selectedNodeIds.includes(n.id));
      cutoffY = Math.max(...selected.map((n) => n.cy + n.h / 2));
    }

    const nextNodes = graph.nodes.map((n) => {
      if (selectedNodeIds.length === 0 || n.cy > cutoffY - 10) {
        return { ...n, cy: snapCoord(n.cy + deltaY) };
      }
      return n;
    });

    const nextEdges = graph.edges.map((e) => rerouteEdge(e, nextNodes));
    const nextGraph = { ...graph, nodes: nextNodes, edges: nextEdges };
    pushHistory(nextGraph);
  }, [graph, selectedNodeIds, snapCoord, pushHistory]);

  // Keyboard Shortcuts: Delete, Ctrl+Z, Ctrl+Y, Ctrl+D, Alt+Down, Alt+Up
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
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
      } else if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        handleShiftBelow(60);
      } else if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        handleShiftBelow(-60);
      } else if (e.key === "Escape") {
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        setConnectingState(null);
        setEditingNodeId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleUndo, handleRedo, handleDeleteSelected, handleDuplicateSelected, handleShiftBelow]);

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

    let newSelectedIds = selectedNodeIds;
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      if (selectedNodeIds.includes(nodeId)) {
        newSelectedIds = selectedNodeIds.filter((id) => id !== nodeId);
      } else {
        newSelectedIds = [...selectedNodeIds, nodeId];
      }
    } else {
      if (!selectedNodeIds.includes(nodeId)) {
        newSelectedIds = [nodeId];
      }
    }
    setSelectedNodeIds(newSelectedIds);
    setSelectedEdgeId(null);

    isDraggingRef.current = true;
    dragTypeRef.current = "node";
    dragTargetRef.current = nodeId;
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY };

    const activeIds = newSelectedIds.length > 0 ? newSelectedIds : [nodeId];
    const initialMap = {};
    graph.nodes.forEach((n) => {
      if (activeIds.includes(n.id)) {
        initialMap[n.id] = { cx: n.cx, cy: n.cy };
      }
    });
    dragStartPositionsRef.current = initialMap;
  };

  // --- Handlers: Edge Waypoint Dragging ---
  const handleEdgePointMouseDown = (e, edgeId, pointIndex) => {
    e.stopPropagation();
    setSelectedEdgeId(edgeId);
    setSelectedNodeIds([]);
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

  // --- Handlers: Orthogonal Edge Segment Dragging ---
  const handleEdgeSegmentMouseDown = (e, edgeId, segIndex, isHorizontal) => {
    e.stopPropagation();
    setSelectedEdgeId(edgeId);
    setSelectedNodeIds([]);

    const edge = graph.edges.find((ed) => ed.id === edgeId);
    if (!edge) return;

    let pts = edge.points.map((p) => ({ ...p }));
    let activeSegIdx = segIndex;

    // If straight line (2 points), split into 4 orthogonal points so middle segment can be dragged
    if (pts.length === 2) {
      if (isHorizontal) {
        const midY = pts[0].y;
        pts = [
          { x: pts[0].x, y: pts[0].y },
          { x: pts[0].x, y: midY },
          { x: pts[1].x, y: midY },
          { x: pts[1].x, y: pts[1].y },
        ];
        activeSegIdx = 1;
      } else {
        const midX = pts[0].x;
        pts = [
          { x: pts[0].x, y: pts[0].y },
          { x: midX, y: pts[0].y },
          { x: midX, y: pts[1].y },
          { x: pts[1].x, y: pts[1].y },
        ];
        activeSegIdx = 1;
      }
    } else if (segIndex === 0) {
      // First segment: insert a bend point so node anchor remains intact
      pts.splice(1, 0, { x: pts[0].x, y: pts[0].y });
      activeSegIdx = 1;
    } else if (segIndex === pts.length - 2) {
      // Last segment: insert a bend point so node target anchor remains intact
      pts.splice(pts.length - 1, 0, { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
    }

    isDraggingRef.current = true;
    dragTypeRef.current = "edge-segment";
    dragTargetRef.current = { edgeId, segIndex: activeSegIdx, isHorizontal };
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
    dragStartPositionsRef.current = { points: pts };
  };

  // --- Handlers: Canvas MouseDown (Pan / Marquee Selection) ---
  const handleCanvasMouseDown = (e) => {
    if (
      e.target.closest(".drawio-shapes-sidebar") ||
      e.target.closest(".drawio-properties-sidebar") ||
      e.target.closest(".drawio-top-bar")
    ) {
      return;
    }
    if (editingNodeId) {
      handleFinishTextEdit();
    }

    const isMarqueeMode = canvasTool === "marquee" || e.shiftKey;

    if (!isMarqueeMode) {
      // Pan canvas (затиснувши перетягувати полотно як у Canva/Draw.io)
      isDraggingRef.current = true;
      dragTypeRef.current = "pan";
      dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
      dragStartPositionsRef.current = { panX: pan.x, panY: pan.y };
      return;
    }

    // Marquee selection box on Shift+drag or when Marquee tool is active
    if (!e.shiftKey) {
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
    }
    const canvasPt = screenToCanvas(e.clientX, e.clientY);
    marqueeStartCanvasRef.current = canvasPt;
    setMarqueeBox({ x: canvasPt.x, y: canvasPt.y, w: 0, h: 0 });

    isDraggingRef.current = true;
    dragTypeRef.current = "marquee";
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  // --- Handlers: Mouse Move ---
  const handleMouseMove = (e) => {
    // 1. If currently dragging an anchor connection
    if (connectingState) {
      const cPos = screenToCanvas(e.clientX, e.clientY);
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

    // 2. Dragging Node(s) - translates whole selection strip/group together
    if (dragTypeRef.current === "node") {
      const initialMap = dragStartPositionsRef.current;
      if (!initialMap) return;

      const idSet = new Set(Object.keys(initialMap));
      setGraph((prev) => {
        const nextNodes = prev.nodes.map((n) => {
          if (idSet.has(n.id)) {
            const init = initialMap[n.id];
            return {
              ...n,
              cx: snapCoord(init.cx + dxCanvas),
              cy: snapCoord(init.cy + dyCanvas),
            };
          }
          return n;
        });

        // Automatically re-route all attached orthogonal edges!
        const nextEdges = prev.edges.map((edge) => {
          if (idSet.has(edge.sourceNodeId) || idSet.has(edge.targetNodeId)) {
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
    // 4. Dragging an Orthogonal Edge Segment
    else if (dragTypeRef.current === "edge-segment") {
      const { edgeId, segIndex, isHorizontal } = dragTargetRef.current;
      const initial = dragStartPositionsRef.current;
      if (!initial || !initial.points) return;

      const pA = initial.points[segIndex];
      const pB = initial.points[segIndex + 1];
      if (!pA || !pB) return;

      setGraph((prev) => {
        const nextEdges = prev.edges.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const pts = initial.points.map((p) => ({ ...p }));
          if (isHorizontal) {
            const newY = snapCoord(pA.y + dyCanvas);
            pts[segIndex].y = newY;
            pts[segIndex + 1].y = newY;
          } else {
            const newX = snapCoord(pA.x + dxCanvas);
            pts[segIndex].x = newX;
            pts[segIndex + 1].x = newX;
          }
          return { ...edge, points: pts };
        });
        return { ...prev, edges: nextEdges };
      });
    }
    // 5. Marquee Box Selection Drag
    else if (dragTypeRef.current === "marquee") {
      const curCanvasPt = screenToCanvas(e.clientX, e.clientY);
      const start = marqueeStartCanvasRef.current;
      const boxX = Math.min(start.x, curCanvasPt.x);
      const boxY = Math.min(start.y, curCanvasPt.y);
      const boxW = Math.abs(curCanvasPt.x - start.x);
      const boxH = Math.abs(curCanvasPt.y - start.y);
      setMarqueeBox({ x: boxX, y: boxY, w: boxW, h: boxH });

      // Find intersecting nodes
      const intersectingNodeIds = graph.nodes
        .filter((node) => {
          const nodeLeft = node.cx - node.w / 2;
          const nodeRight = node.cx + node.w / 2;
          const nodeTop = node.cy - node.h / 2;
          const nodeBottom = node.cy + node.h / 2;
          return (
            nodeRight >= boxX &&
            nodeLeft <= boxX + boxW &&
            nodeBottom >= boxY &&
            nodeTop <= boxY + boxH
          );
        })
        .map((n) => n.id);

      setSelectedNodeIds((prev) => {
        if (e.shiftKey) {
          return Array.from(new Set([...prev, ...intersectingNodeIds]));
        }
        return intersectingNodeIds;
      });
    }
    // 6. Pan canvas
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
          setSelectedNodeIds([]);
        }
      }
      setConnectingState(null);
    }

    if (dragTypeRef.current === "pan" && dragStartMouseRef.current && e?.clientX !== undefined) {
      const dist = Math.hypot(
        e.clientX - dragStartMouseRef.current.x,
        e.clientY - dragStartMouseRef.current.y
      );
      if (dist < 5) {
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
      }
    }

    if (dragTypeRef.current === "marquee") {
      setMarqueeBox(null);
    }

    if (isDraggingRef.current) {
      if (
        dragTypeRef.current === "node" ||
        dragTypeRef.current === "edge-point" ||
        dragTypeRef.current === "edge-segment"
      ) {
        pushHistory(graph);
      }
      isDraggingRef.current = false;
      dragTypeRef.current = null;
      dragTargetRef.current = null;
    }
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
      if (
        n.type === "uml-initial" ||
        n.type === "uml-final" ||
        n.type === "uml-diamond" ||
        n.type === "uml-fork-join" ||
        n.type === "connector"
      ) {
        return { ...n, text: editingText };
      }
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
      if (
        n.type === "uml-initial" ||
        n.type === "uml-final" ||
        n.type === "uml-diamond" ||
        n.type === "uml-fork-join" ||
        n.type === "connector"
      ) {
        return { ...n, text: newText };
      }
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
    const shapeDef = ALL_SHAPES.find((s) => s.type === newType);
    const nextNodes = graph.nodes.map((n) => {
      if (n.id !== selectedNodeId) return n;
      const isPredefined = newType === "predefined" || newType === "uml-call";
      const isUml = Boolean(shapeDef?.isUml || newType.startsWith("uml-") || diagramType === "uml");
      let w = n.w;
      let h = n.h;
      if (shapeDef) {
        const isSmallDef = shapeDef.w <= 70;
        const isSmallCurr = n.w <= 70;
        if (isSmallDef || isSmallCurr) {
          w = shapeDef.w;
          h = shapeDef.h;
        }
      }
      return { ...n, type: newType, isPredefined, isUml, w, h };
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

    const isUmlNode = Boolean(
      shapeDef.isUml || shapeDef.type.startsWith("uml-") || diagramType === "uml"
    );

    const newNode = {
      id: `node_${nextIdRef.current++}`,
      type: shapeDef.type,
      cx: snapCoord(center.x),
      cy: snapCoord(center.y),
      w: shapeDef.w,
      h: shapeDef.h,
      text: shapeDef.defaultText,
      isPredefined: Boolean(shapeDef.isPredefined || shapeDef.type === "uml-call"),
      isUml: isUmlNode,
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
              className={`drawio-tool-btn ${canvasTool === "pan" ? "active" : ""}`}
              onClick={() => setCanvasTool("pan")}
              title="Режим «Рука»: затисніть ліву кнопку миші на полотні для перетягування"
            >
              <Hand size={15} />
            </button>
            <button
              className={`drawio-tool-btn ${canvasTool === "marquee" ? "active" : ""}`}
              onClick={() => setCanvasTool("marquee")}
              title="Режим «Рамка»: обвести групу блоків прямокутником (або затисніть Shift+Drag)"
            >
              <BoxSelect size={15} />
            </button>
            <div className="drawio-sep" />
            <button
              className="drawio-tool-btn"
              onClick={() => handleShiftBelow(60)}
              title="Розсунути місце вниз: посунути всі нижні блоки на +60px (Alt+↓)"
            >
              <ArrowDownFromLine size={15} />
            </button>
            <button
              className="drawio-tool-btn"
              onClick={() => handleShiftBelow(-60)}
              title="Зсунути блоки вгору: прибрати порожнє місце на -60px (Alt+↑)"
            >
              <ArrowUpFromLine size={15} />
            </button>
            <div className="drawio-sep" />
            <button
              className="drawio-tool-btn"
              onClick={handleDuplicateSelected}
              disabled={selectedNodeIds.length === 0}
              title="Дублювати виділені блоки (Ctrl+D)"
            >
              <Copy size={15} />
            </button>
            <button
              className="drawio-tool-btn text-danger"
              onClick={handleDeleteSelected}
              disabled={selectedNodeIds.length === 0 && !selectedEdgeId}
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
              <span>Палітра елементів</span>
            </div>

            <div className="palette-category-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={paletteCategory === "flowchart"}
                className={`palette-tab ${paletteCategory === "flowchart" ? "active" : ""}`}
                onClick={() => setPaletteCategory("flowchart")}
              >
                Блок-схема
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={paletteCategory === "uml"}
                className={`palette-tab ${paletteCategory === "uml" ? "active" : ""}`}
                onClick={() => setPaletteCategory("uml")}
              >
                UML
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={paletteCategory === "structure"}
                className={`palette-tab ${paletteCategory === "structure" ? "active" : ""}`}
                onClick={() => setPaletteCategory("structure")}
              >
                Модулі
              </button>
            </div>

            <div className="shapes-list">
              {currentShapes.map((shape) => (
                <button
                  key={shape.type}
                  className="shape-item-btn"
                  onClick={() => handleAddShape(shape)}
                  title={`Додати ${shape.title}: ${shape.desc}`}
                >
                  <span className="shape-icon-preview">
                    <ShapePaletteIcon type={shape.type} />
                  </span>
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
            ref={canvasAreaRef}
            className={`drawio-canvas-area ${isSpacePressed || canvasTool === "pan" ? "space-panning" : "marquee-mode"}`}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
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

                        {/* Interactive Segment Drag Handles (Draw.io style for strips & lines) */}
                        {isSelected &&
                          pts.slice(0, -1).map((pA, segIdx) => {
                            const pB = pts[segIdx + 1];
                            const isHoriz = Math.abs(pA.y - pB.y) < 3;
                            const isVert = Math.abs(pA.x - pB.x) < 3;
                            if (!isHoriz && !isVert) return null;
                            const midX = (pA.x + pB.x) / 2;
                            const midY = (pA.y + pB.y) / 2;
                            const len = Math.hypot(pB.x - pA.x, pB.y - pA.y);
                            if (len < 16) return null;

                            return (
                              <rect
                                key={`seg_${segIdx}`}
                                x={midX - 4}
                                y={midY - 4}
                                width="8"
                                height="8"
                                rx="2"
                                fill="#ffffff"
                                stroke="#2563eb"
                                strokeWidth="1.8"
                                className={`drawio-segment-handle ${isHoriz ? "horizontal" : ""}`}
                                onMouseDown={(e) =>
                                  handleEdgeSegmentMouseDown(e, edge.id, segIdx, isHoriz)
                                }
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
                    const isSelected = selectedNodeIds.includes(node.id);
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
                        ) : node.type === "connector" ? (
                          <circle
                            cx={node.cx}
                            cy={node.cy}
                            r={node.w / 2}
                            fill={colors.nodeFill}
                            stroke={isSelected ? "#2563eb" : colors.nodeStroke}
                            strokeWidth={isSelected ? "2.5" : "1.8"}
                          />
                        ) : node.type === "uml-initial" ? (
                          <circle
                            cx={node.cx}
                            cy={node.cy}
                            r={node.w / 2}
                            fill={colors.nodeStroke}
                            stroke={isSelected ? "#2563eb" : colors.nodeStroke}
                            strokeWidth={isSelected ? "2.5" : "0"}
                          />
                        ) : node.type === "uml-final" ? (
                          <g>
                            <circle
                              cx={node.cx}
                              cy={node.cy}
                              r={node.w / 2}
                              fill={colors.nodeFill}
                              stroke={isSelected ? "#2563eb" : colors.nodeStroke}
                              strokeWidth={isSelected ? "2.5" : "1.8"}
                            />
                            <circle
                              cx={node.cx}
                              cy={node.cy}
                              r={(node.w / 2) * 0.58}
                              fill={colors.nodeStroke}
                            />
                          </g>
                        ) : node.type === "uml-diamond" ? (
                          <polygon
                            points={`${node.cx},${y} ${node.cx + node.w / 2},${node.cy} ${node.cx},${node.cy + node.h / 2} ${node.cx - node.w / 2},${node.cy}`}
                            fill={colors.nodeFill}
                            stroke={isSelected ? "#2563eb" : colors.nodeStroke}
                            strokeWidth={isSelected ? "2.5" : "1.8"}
                          />
                        ) : node.type === "uml-fork-join" ? (
                          <rect
                            x={x}
                            y={y}
                            width={node.w}
                            height={node.h}
                            rx="2"
                            ry="2"
                            fill={colors.nodeStroke}
                            stroke={isSelected ? "#2563eb" : colors.nodeStroke}
                            strokeWidth={isSelected ? "2.5" : "1"}
                          />
                        ) : node.type === "uml-action" || node.type === "uml-call" ? (
                          <g>
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
                            {node.type === "uml-call" && (
                              <g>
                                <line
                                  x1={x + 14}
                                  y1={y}
                                  x2={x + 14}
                                  y2={y + node.h}
                                  stroke={colors.nodeStroke}
                                  strokeWidth="1.5"
                                />
                                <line
                                  x1={x + node.w - 14}
                                  y1={y}
                                  x2={x + node.w - 14}
                                  y2={y + node.h}
                                  stroke={colors.nodeStroke}
                                  strokeWidth="1.5"
                                />
                              </g>
                            )}
                          </g>
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
                        {node.text && node.text.trim().length > 0 && (
                          node.type === "uml-initial" ||
                          node.type === "uml-final" ||
                          node.type === "uml-fork-join" ? (
                            <text
                              x={node.cx}
                              y={node.cy + node.h / 2 + 13}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontFamily="system-ui, -apple-system, sans-serif"
                              fontSize="12"
                              fontWeight="600"
                              fill={colors.nodeText}
                              pointerEvents="none"
                            >
                              {node.text}
                            </text>
                          ) : (
                            node.text
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
                              })
                          )
                        )}

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

                {/* 3. MARQUEE SELECTION BOX */}
                {marqueeBox && marqueeBox.w > 2 && marqueeBox.h > 2 && (
                  <rect
                    x={marqueeBox.x}
                    y={marqueeBox.y}
                    width={marqueeBox.w}
                    height={marqueeBox.h}
                    className="drawio-marquee-box"
                    pointerEvents="none"
                  />
                )}
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

            {selectedNodeIds.length > 1 ? (
              <div className="properties-body">
                <div className="prop-section">
                  <label className="prop-label">
                    <Square size={13} /> Виділена група блоків: {selectedNodeIds.length}
                  </label>
                  <span className="prop-subtext">
                    Перетягуйте мишкою будь-який виділений блок — вся група (смуга) переміщуватиметься разом зі збереженням зв'язків.
                  </span>
                </div>

                <div className="prop-section-actions">
                  <button
                    className="btn btn-secondary btn-sm w-full mb-2"
                    onClick={() => handleShiftBelow(60)}
                    title="Розсунути місце вниз: посунути всі нижні блоки на +60px"
                  >
                    <ArrowDownFromLine size={13} /> Розсунути місце вниз (+60px)
                  </button>
                  <button
                    className="btn btn-secondary btn-sm w-full mb-2"
                    onClick={() => handleShiftBelow(-60)}
                    title="Зсунути блоки вгору: прибрати порожнє місце на -60px"
                  >
                    <ArrowUpFromLine size={13} /> Зсунути блоки вгору (-60px)
                  </button>
                  <button
                    className="btn btn-secondary btn-sm w-full mb-2"
                    onClick={handleDuplicateSelected}
                  >
                    <Copy size={13} /> Дублювати всі {selectedNodeIds.length} блоки (Ctrl+D)
                  </button>
                  <button
                    className="btn btn-danger btn-sm w-full"
                    onClick={handleDeleteSelected}
                  >
                    <Trash2 size={13} /> Видалити виділені блоки (Delete)
                  </button>
                </div>
              </div>
            ) : selectedNode ? (
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
                    <optgroup label="Блок-схема (ДСТУ 19.701-90)">
                      {FLOWCHART_SHAPES.map((bt) => (
                        <option key={bt.type} value={bt.type}>
                          {bt.title}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="UML Activity Diagram">
                      {UML_SHAPES.map((bt) => (
                        <option key={bt.type} value={bt.type}>
                          {bt.title}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Структурна схема (Лаб 5)">
                      {STRUCTURE_SHAPES.map((bt) => (
                        <option key={bt.type} value={bt.type}>
                          {bt.title}
                        </option>
                      ))}
                    </optgroup>
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
                  <label className="prop-custom-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedEdge.hasArrow)}
                      onChange={handleToggleArrowhead}
                      className="sr-only"
                    />
                    <span className={`custom-check-box ${selectedEdge.hasArrow ? "checked" : ""}`}>
                      {selectedEdge.hasArrow && <Check size={12} strokeWidth={2.8} />}
                    </span>
                    <span className="prop-checkbox-label">
                      <ArrowRight size={14} /> Наконечник стрілки на кінці
                    </span>
                  </label>
                </div>

                <div className="prop-section">
                  <label className="prop-custom-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedEdge.isOrthogonal)}
                      onChange={handleToggleOrthogonal}
                      className="sr-only"
                    />
                    <span className={`custom-check-box ${selectedEdge.isOrthogonal ? "checked" : ""}`}>
                      {selectedEdge.isOrthogonal && <Check size={12} strokeWidth={2.8} />}
                    </span>
                    <span className="prop-checkbox-label">
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
                  <h4>⚡ Зручні дії та жести:</h4>
                  <ul>
                    <li><kbd>Двома пальцями</kbd> — Плавне панорамування</li>
                    <li><kbd>Pinch / Ctrl+Колесо</kbd> — Плавний зум</li>
                    <li><kbd>Space + Drag</kbd> — Панорамування полотна</li>
                    <li><kbd>Drag тла</kbd> — Рамка виділення смуги/групи</li>
                    <li><kbd>Alt+↓ / Alt+↑</kbd> — Розсунути / зсунути блоки</li>
                    <li><kbd>Ctrl+D</kbd> — Дублювати виділені блоки</li>
                    <li><kbd>Delete</kbd> — Видалити виділене</li>
                    <li><kbd>2x-Click</kbd> — Швидке редагування тексту</li>
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
