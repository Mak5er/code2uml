import assert from "node:assert/strict";
import {
  graphToSvg,
  getNodeAnchorPoints,
  getNearestAnchorPort,
  calculateOrthogonalRoute,
} from "../src/utils/diagramGraph.js";

console.log("Testing diagramGraph engine...");

// 1. Test Node Anchors
const testNode = {
  id: "node_1",
  type: "process",
  cx: 200,
  cy: 150,
  w: 120,
  h: 60,
  text: "y = x + 1;",
};

const anchors = getNodeAnchorPoints(testNode);
assert.deepEqual(anchors.top, { name: "top", x: 200, y: 120, dir: "up" });
assert.deepEqual(anchors.bottom, { name: "bottom", x: 200, y: 180, dir: "down" });
assert.deepEqual(anchors.left, { name: "left", x: 140, y: 150, dir: "left" });
assert.deepEqual(anchors.right, { name: "right", x: 260, y: 150, dir: "right" });
console.log("✓ getNodeAnchorPoints passed");

// 2. Test Nearest Anchor Port with magnetic snap
const nearTop = getNearestAnchorPort(testNode, { x: 205, y: 122 });
assert.equal(nearTop.portName, "top");
assert.ok(nearTop.dist < 30, "Distance should be under 30px snap threshold");

const farAway = getNearestAnchorPort(testNode, { x: 500, y: 500 });
assert.ok(farAway.dist > 300);
console.log("✓ getNearestAnchorPort magnetic snap passed");

// 3. Test Orthogonal Manhattan Route
const routeDownToTop = calculateOrthogonalRoute(
  { x: 200, y: 180 },
  "down",
  { x: 200, y: 300 },
  "up"
);
assert.equal(routeDownToTop.length, 2);
assert.deepEqual(routeDownToTop[0], { x: 200, y: 180 });
assert.deepEqual(routeDownToTop[1], { x: 200, y: 300 });

const routeDisplaced = calculateOrthogonalRoute(
  { x: 200, y: 180 },
  "down",
  { x: 350, y: 300 },
  "up"
);
assert.equal(routeDisplaced.length, 4); // 90° Manhattan route with midpoint elbow
console.log("✓ calculateOrthogonalRoute Manhattan routing passed");

// 4. Test Graph Data Structure & Dual Theme SVG generation
const graph = {
  nodes: [
    { id: "node_0", type: "start", cx: 200, cy: 70, w: 100, h: 40, text: "початок" },
    { id: "node_1", type: "process", cx: 200, cy: 175, w: 140, h: 50, text: "s = 0;" },
  ],
  edges: [
    {
      id: "edge_0",
      sourceNodeId: "node_0",
      sourcePort: "bottom",
      targetNodeId: "node_1",
      targetPort: "top",
      points: [
        { x: 200, y: 90 },
        { x: 200, y: 150 },
      ],
      hasArrow: true,
      isOrthogonal: true,
    },
  ],
  labels: [],
};

// 5. Test Dark Theme High-Contrast SVG generation
const darkSvg = graphToSvg(graph, { isDark: true });
assert.ok(darkSvg.includes('#60a5fa'), "Dark SVG must include high-contrast blue line stroke #60a5fa");
assert.ok(darkSvg.includes('#0b1120') || darkSvg.includes('#1e293b'), "Dark SVG must have dark background and nodes");

// 6. Test Light Theme SVG generation
const lightSvg = graphToSvg(graph, { isDark: false });
assert.ok(lightSvg.includes('#1e293b') || lightSvg.includes('#334155'), "Light SVG must include dark slate line stroke");
assert.ok(lightSvg.includes('#ffffff'), "Light SVG must have white nodes");
console.log("✓ graphToSvg dual-theme passed");

console.log("All diagramGraph tests passed successfully! 🎉");
