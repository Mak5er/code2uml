/**
 * Diagram Graph Extraction & SVG Generator with Draw.io features:
 * - Magnetic anchor points (Top, Bottom, Left, Right)
 * - Manhattan 90° Orthogonal line router
 * - High-contrast Light & Dark theme support
 */

import { SVG } from "./svgHelpers.js";

/**
 * Parse SVG polyline points string into [{x, y}, ...]
 */
function parsePointsString(pointsStr) {
  if (!pointsStr) return [];
  return pointsStr
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const parts = pair.split(",").map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { x: parts[0], y: parts[1] };
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Extract path bounding box
 */
function parsePathBounds(d) {
  if (!d) return { minX: 0, maxX: 100, minY: 0, maxY: 40 };
  const numbers = d.match(/-?\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length < 4) {
    return { minX: 0, maxX: 100, minY: 0, maxY: 40 };
  }
  const xs = [];
  const ys = [];
  for (let i = 0; i < numbers.length; i += 2) {
    if (i + 1 < numbers.length) {
      xs.push(parseFloat(numbers[i]));
      ys.push(parseFloat(numbers[i + 1]));
    }
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY };
}

/**
 * Return 4 magnetic anchor ports for any node
 */
export function getNodeAnchorPoints(node) {
  if (!node) return {};
  const hw = (node.w || 120) / 2;
  const hh = (node.h || 40) / 2;
  return {
    top: { name: "top", x: Math.round(node.cx), y: Math.round(node.cy - hh), dir: "up" },
    bottom: { name: "bottom", x: Math.round(node.cx), y: Math.round(node.cy + hh), dir: "down" },
    left: { name: "left", x: Math.round(node.cx - hw), y: Math.round(node.cy), dir: "left" },
    right: { name: "right", x: Math.round(node.cx + hw), y: Math.round(node.cy), dir: "right" },
  };
}

/**
 * Find closest magnetic anchor port on node to target point
 */
export function getNearestAnchorPort(node, pt) {
  const anchors = getNodeAnchorPoints(node);
  let bestPort = "bottom";
  let minDist = Infinity;
  Object.values(anchors).forEach((anchor) => {
    const dist = Math.hypot(anchor.x - pt.x, anchor.y - pt.y);
    if (dist < minDist) {
      minDist = dist;
      bestPort = anchor.name;
    }
  });
  return { portName: bestPort, anchor: anchors[bestPort], dist: minDist };
}

/**
 * Get directional stub offset for clean right-angle breakout
 */
function getStubPoint(pt, dir, len = 20) {
  switch (dir) {
    case "up":
      return { x: pt.x, y: pt.y - len };
    case "down":
      return { x: pt.x, y: pt.y + len };
    case "left":
      return { x: pt.x - len, y: pt.y };
    case "right":
      return { x: pt.x + len, y: pt.y };
    default:
      return { x: pt.x, y: pt.y };
  }
}

/**
 * Professional Manhattan (90° Orthogonal) router like Draw.io
 */
export function calculateOrthogonalRoute(p1, dir1, p2, dir2) {
  if (!p1 || !p2) return [p1, p2];

  // Straight line snap if nearly colinear
  if (
    Math.abs(p1.x - p2.x) < 4 &&
    ((dir1 === "down" && dir2 === "up") || (dir1 === "up" && dir2 === "down"))
  ) {
    return [p1, { x: p1.x, y: p2.y }];
  }
  if (
    Math.abs(p1.y - p2.y) < 4 &&
    ((dir1 === "right" && dir2 === "left") || (dir1 === "left" && dir2 === "right"))
  ) {
    return [p1, { x: p2.x, y: p1.y }];
  }

  // Natural Flow Down -> Up (most common flowchart flow)
  if (dir1 === "down" && dir2 === "up" && p2.y > p1.y + 12) {
    const midY = Math.round((p1.y + p2.y) / 2);
    return [p1, { x: p1.x, y: midY }, { x: p2.x, y: midY }, p2];
  }

  // Natural Flow Up -> Down (loopbacks)
  if (dir1 === "up" && dir2 === "down" && p2.y < p1.y - 12) {
    const midY = Math.round((p1.y + p2.y) / 2);
    return [p1, { x: p1.x, y: midY }, { x: p2.x, y: midY }, p2];
  }

  // Horizontal Flow Right -> Left
  if (dir1 === "right" && dir2 === "left" && p2.x > p1.x + 12) {
    const midX = Math.round((p1.x + p2.x) / 2);
    return [p1, { x: midX, y: p1.y }, { x: midX, y: p2.y }, p2];
  }

  // Horizontal Flow Left -> Right
  if (dir1 === "left" && dir2 === "right" && p2.x < p1.x - 12) {
    const midX = Math.round((p1.x + p2.x) / 2);
    return [p1, { x: midX, y: p1.y }, { x: midX, y: p2.y }, p2];
  }

  // Corner Transitions (e.g. Branch out Right then Down to Top of target)
  if (dir1 === "right") {
    if (dir2 === "up" && p2.y > p1.y) {
      return [p1, { x: p2.x, y: p1.y }, p2];
    }
    if (dir2 === "down" && p2.y < p1.y) {
      return [p1, { x: p2.x, y: p1.y }, p2];
    }
  }

  if (dir1 === "left") {
    if (dir2 === "up" && p2.y > p1.y) {
      return [p1, { x: p2.x, y: p1.y }, p2];
    }
    if (dir2 === "down" && p2.y < p1.y) {
      return [p1, { x: p2.x, y: p1.y }, p2];
    }
  }

  // Fallback Z-step via breakout stubs
  const sOffset = getStubPoint(p1, dir1, 20);
  const tOffset = getStubPoint(p2, dir2, 20);

  if (dir1 === "down" || dir1 === "up") {
    return [p1, sOffset, { x: tOffset.x, y: sOffset.y }, tOffset, p2];
  }
  return [p1, sOffset, { x: sOffset.x, y: tOffset.y }, tOffset, p2];
}

/**
 * Extract graph structure from any SVG string
 */
export function extractGraphFromSvg(svgString, diagramType = "flowchart") {
  if (!svgString || typeof svgString !== "string") {
    return { nodes: [], edges: [], labels: [], width: 800, height: 600, viewBox: "0 0 800 600" };
  }

  // Use DOMParser
  let doc;
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    doc = parser.parseFromString(svgString, "image/svg+xml");
  } else {
    return { nodes: [], edges: [], labels: [], width: 800, height: 600, viewBox: "0 0 800 600" };
  }

  const svgEl = doc.querySelector("svg");
  if (!svgEl) {
    return { nodes: [], edges: [], labels: [], width: 800, height: 600, viewBox: "0 0 800 600" };
  }

  const width = parseFloat(svgEl.getAttribute("width")) || 800;
  const height = parseFloat(svgEl.getAttribute("height")) || 600;
  const viewBox = svgEl.getAttribute("viewBox") || `0 0 ${width} ${height}`;

  const nodes = [];
  const edges = [];
  const labels = [];

  // 1. Extract Nodes
  const nodeEls = Array.from(doc.querySelectorAll(".diagram-node, g[data-node-id]"));
  nodeEls.forEach((gNode, idx) => {
    const rawId = gNode.getAttribute("data-node-id") || `node_${idx}`;
    const className = gNode.getAttribute("class") || "";

    // Determine type
    let type = "process";
    if (className.includes("predefined") || className.includes("uml-call")) {
      type = "predefined";
    } else if (className.includes("rhombus") || gNode.querySelector("polygon")) {
      type = "rhombus";
    } else if (className.includes("input") || className.includes("parallelogram")) {
      type = "input";
    } else if (className.includes("output") || className.includes("document")) {
      type = "output";
    } else if (className.includes("uml-initial")) {
      type = "uml-initial";
    } else if (className.includes("uml-final")) {
      type = "uml-final";
    } else if (className.includes("uml-diamond")) {
      type = "uml-diamond";
    } else if (className.includes("uml-action")) {
      type = "uml-action";
    } else if (className.includes("structure-chart-node")) {
      type = "structure-chart-node";
    } else if (className.includes("stadium") || rawId === "start_node" || rawId === "end_node") {
      type = rawId === "end_node" ? "end" : "start";
    }

    // Geometry
    let cx = 100, cy = 100, w = 120, h = 40;
    const rect = gNode.querySelector("rect");
    const circle = gNode.querySelector("circle");
    const polygon = gNode.querySelector("polygon");
    const path = gNode.querySelector("path");

    if (rect) {
      const rx = parseFloat(rect.getAttribute("x")) || 0;
      const ry = parseFloat(rect.getAttribute("y")) || 0;
      w = parseFloat(rect.getAttribute("width")) || 120;
      h = parseFloat(rect.getAttribute("height")) || 40;
      cx = rx + w / 2;
      cy = ry + h / 2;
    } else if (circle) {
      cx = parseFloat(circle.getAttribute("cx")) || 100;
      cy = parseFloat(circle.getAttribute("cy")) || 100;
      const r = parseFloat(circle.getAttribute("r")) || 12;
      w = r * 2;
      h = r * 2;
    } else if (polygon) {
      const pts = parsePointsString(polygon.getAttribute("points") || "");
      if (pts.length > 0) {
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        w = maxX - minX;
        h = maxY - minY;
        cx = minX + w / 2;
        cy = minY + h / 2;
      }
    } else if (path) {
      const b = parsePathBounds(path.getAttribute("d") || "");
      w = b.maxX - b.minX;
      h = b.maxY - b.minY;
      cx = b.minX + w / 2;
      cy = b.minY + h / 2;
    }

    // Extract text
    const textEls = Array.from(gNode.querySelectorAll("text"));
    const textLines = textEls
      .map((t) => t.textContent.trim())
      .filter((t) => t && t.length > 0);
    const text = textLines.join("\n");

    if (type === "start" && text === "кінець") {
      type = "end";
    }

    nodes.push({
      id: rawId,
      type,
      cx: Math.round(cx),
      cy: Math.round(cy),
      w: Math.round(w),
      h: Math.round(h),
      text,
      isPredefined: className.includes("predefined") || className.includes("uml-call"),
      isUml: className.includes("uml") || diagramType === "uml",
      className,
    });
  });

  // 2. Extract Lines and Polylines
  const lineEls = Array.from(doc.querySelectorAll("line, polyline"));
  let edgeCounter = 0;
  lineEls.forEach((el) => {
    if (el.closest(".diagram-node")) return;

    const markerEnd = el.getAttribute("marker-end") || "";
    const hasArrow = Boolean(markerEnd);
    let marker = "arrow-flow";
    if (markerEnd.includes("arrow-uml")) marker = "arrow-uml";

    let points = [];
    if (el.tagName.toLowerCase() === "line") {
      const x1 = parseFloat(el.getAttribute("x1")) || 0;
      const y1 = parseFloat(el.getAttribute("y1")) || 0;
      const x2 = parseFloat(el.getAttribute("x2")) || 0;
      const y2 = parseFloat(el.getAttribute("y2")) || 0;
      points = [{ x: Math.round(x1), y: Math.round(y1) }, { x: Math.round(x2), y: Math.round(y2) }];
    } else if (el.tagName.toLowerCase() === "polyline") {
      points = parsePointsString(el.getAttribute("points") || "").map((p) => ({
        x: Math.round(p.x),
        y: Math.round(p.y),
      }));
    }

    if (points.length >= 2) {
      // Find source & target node IDs and anchor ports
      const pStart = points[0];
      const pEnd = points[points.length - 1];

      let sourceNodeId = null;
      let sourcePort = "bottom";
      let targetNodeId = null;
      let targetPort = "top";

      nodes.forEach((n) => {
        const nearS = getNearestAnchorPort(n, pStart);
        if (nearS.dist < 20) {
          sourceNodeId = n.id;
          sourcePort = nearS.portName;
        }
        const nearT = getNearestAnchorPort(n, pEnd);
        if (nearT.dist < 20) {
          targetNodeId = n.id;
          targetPort = nearT.portName;
        }
      });

      edges.push({
        id: `edge_${edgeCounter++}`,
        sourceNodeId,
        sourcePort,
        targetNodeId,
        targetPort,
        points,
        hasArrow,
        marker,
        isOrthogonal: true,
        label: "",
        labelPos: null,
      });
    }
  });

  // 3. Extract standalone Labels
  const allTextEls = Array.from(doc.querySelectorAll("text"));
  let labelCounter = 0;
  allTextEls.forEach((txtEl) => {
    if (txtEl.closest(".diagram-node")) return;
    const txt = txtEl.textContent.trim();
    if (!txt) return;

    const lx = parseFloat(txtEl.getAttribute("x")) || 0;
    const ly = parseFloat(txtEl.getAttribute("y")) || 0;

    let attachedEdge = null;
    let minDist = 35;
    for (const edge of edges) {
      for (let i = 0; i < edge.points.length - 1; i++) {
        const p1 = edge.points[i];
        const p2 = edge.points[i + 1];
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const dist = Math.hypot(lx - midX, ly - midY);
        if (dist < minDist) {
          minDist = dist;
          attachedEdge = edge;
        }
      }
    }

    if (attachedEdge && !attachedEdge.label) {
      attachedEdge.label = txt;
      attachedEdge.labelPos = { x: Math.round(lx), y: Math.round(ly) };
    } else {
      labels.push({
        id: `lbl_${labelCounter++}`,
        text: txt,
        x: Math.round(lx),
        y: Math.round(ly),
      });
    }
  });

  return {
    nodes,
    edges,
    labels,
    width,
    height,
    viewBox,
    diagramType,
  };
}

/**
 * Re-render interactive graph back to SVG string with Theme support
 */
export function graphToSvg(graph, options = {}) {
  const { nodes = [], edges = [], labels = [] } = graph;
  if (!nodes.length && !edges.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><text x="300" y="200" text-anchor="middle">Порожня діаграма</text></svg>`;
  }

  const isDark = Boolean(options.isDark);
  const strokeColor = isDark ? "#60a5fa" : "#1e293b";
  const nodeStrokeColor = isDark ? "#94a3b8" : "#1e293b";
  const nodeFillColor = isDark ? "#1e293b" : "#ffffff";
  const textColor = isDark ? "#f8fafc" : "#0f172a";

  // Calculate dynamic bounding box of all elements
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((n) => {
    minX = Math.min(minX, n.cx - n.w / 2 - 20);
    maxX = Math.max(maxX, n.cx + n.w / 2 + 20);
    minY = Math.min(minY, n.cy - n.h / 2 - 20);
    maxY = Math.max(maxY, n.cy + n.h / 2 + 20);
  });

  edges.forEach((e) => {
    e.points.forEach((p) => {
      minX = Math.min(minX, p.x - 20);
      maxX = Math.max(maxX, p.x + 20);
      minY = Math.min(minY, p.y - 20);
      maxY = Math.max(maxY, p.y + 20);
    });
    if (e.labelPos) {
      minX = Math.min(minX, e.labelPos.x - 20);
      maxX = Math.max(maxX, e.labelPos.x + 20);
      minY = Math.min(minY, e.labelPos.y - 20);
      maxY = Math.max(maxY, e.labelPos.y + 20);
    }
  });

  labels.forEach((l) => {
    minX = Math.min(minX, l.x - 20);
    maxX = Math.max(maxX, l.x + 20);
    minY = Math.min(minY, l.y - 20);
    maxY = Math.max(maxY, l.y + 20);
  });

  if (!isFinite(minX)) {
    minX = 0;
    maxX = 800;
    minY = 0;
    maxY = 600;
  }

  const padding = 30;
  const vbX = Math.floor(minX - padding);
  const vbY = Math.floor(minY - padding);
  const totalW = Math.ceil(maxX - minX + padding * 2);
  const totalH = Math.ceil(maxY - minY + padding * 2);

  // Render Edges
  const edgeSvgs = edges.map((e) => {
    const pts = e.points;
    if (pts.length < 2) return "";
    const marker = e.hasArrow ? ` marker-end="url(#${isDark ? "arrow-flow-dark" : "arrow-flow"})"` : "";

    let lineMarkup = "";
    if (pts.length === 2) {
      lineMarkup = `<line x1="${pts[0].x}" y1="${pts[0].y}" x2="${pts[1].x}" y2="${pts[1].y}" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round"${marker}/>`;
    } else {
      const ptsStr = pts.map((p) => `${p.x},${p.y}`).join(" ");
      lineMarkup = `<polyline points="${ptsStr}" fill="none" stroke="${strokeColor}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"${marker}/>`;
    }

    let labelMarkup = "";
    if (e.label) {
      const lx = e.labelPos ? e.labelPos.x : (pts[0].x + pts[1].x) / 2 + 10;
      const ly = e.labelPos ? e.labelPos.y : (pts[0].y + pts[1].y) / 2 - 6;
      labelMarkup = `<text x="${lx}" y="${ly}" class="diagram-label" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="bold" fill="${textColor}">${SVG.escapeXml(e.label)}</text>`;
    }

    return `${lineMarkup}\n${labelMarkup}`;
  });

  // Render Standalone Labels
  const labelSvgs = labels.map((l) => {
    return `<text x="${l.x}" y="${l.y}" class="diagram-label" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="bold" fill="${textColor}">${SVG.escapeXml(l.text)}</text>`;
  });

  // Render Nodes
  const nodeSvgs = nodes.map((n) => {
    const opts = {
      nodeId: n.id,
      isPredefined: Boolean(n.isPredefined),
      isCallAction: Boolean(n.isPredefined),
      isUml: Boolean(n.isUml),
      stroke: nodeStrokeColor,
      fill: nodeFillColor,
      textColor: textColor,
    };

    switch (n.type) {
      case "start":
        return SVG.stadium(n.cx, n.cy, n.w, n.h, n.text || "початок", opts);
      case "end":
        return SVG.stadium(n.cx, n.cy, n.w, n.h, n.text || "кінець", opts);
      case "predefined":
        if (n.isUml) {
          return SVG.umlAction(n.cx, n.cy, n.w, n.h, n.text, { ...opts, isCallAction: true });
        }
        return SVG.predefinedProcess(n.cx, n.cy, n.w, n.h, n.text, opts);
      case "rhombus":
        return SVG.rhombus(n.cx, n.cy, n.w, n.h, n.text, opts);
      case "input":
        return SVG.parallelogram(n.cx, n.cy, n.w, n.h, n.text, opts);
      case "output":
        return SVG.document(n.cx, n.cy, n.w, n.h, n.text, opts);
      case "uml-initial":
        return SVG.umlInitialNode(n.cx, n.cy, 11, n.text || null);
      case "uml-final":
        return SVG.umlFinalNode(n.cx, n.cy, 13);
      case "uml-diamond":
        return SVG.umlDiamond(n.cx, n.cy, Math.max(n.w, 20));
      case "uml-action":
        return SVG.umlAction(n.cx, n.cy, n.w, n.h, n.text, opts);
      case "structure-chart-node": {
        const rx = n.cx - n.w / 2;
        const ry = n.cy - n.h / 2;
        return `
        <g class="diagram-node structure-chart-node" data-node-id="${n.id}">
          <rect x="${rx}" y="${ry}" width="${n.w}" height="${n.h}" rx="5" ry="5"
            fill="${nodeFillColor}" stroke="${nodeStrokeColor}" stroke-width="1.8" filter="url(#soft-shadow)"/>
          <text x="${n.cx}" y="${n.cy}" text-anchor="middle" dominant-baseline="central"
            fill="${textColor}" font-family="system-ui, -apple-system, sans-serif" font-size="13.5" font-weight="600">
            ${SVG.escapeXml(n.text)}
          </text>
        </g>
        `;
      }
      case "process":
      default:
        return SVG.rectangle(n.cx, n.cy, n.w, n.h, n.text, opts);
    }
  });

  const customDefs = `
    <!-- Crisp Dark Marker -->
    <marker id="arrow-flow-dark" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 1 2 L 10 6 L 1 10 z" fill="#60a5fa" />
    </marker>
  `;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${totalW} ${totalH}" width="${totalW}" height="${totalH}">
    ${SVG.createDefs()}
    <defs>${customDefs}</defs>
    <g id="interactive-diagram-edges">
      ${edgeSvgs.join("\n")}
      ${labelSvgs.join("\n")}
    </g>
    <g id="interactive-diagram-nodes">
      ${nodeSvgs.join("\n")}
    </g>
</svg>
  `.trim();
}
