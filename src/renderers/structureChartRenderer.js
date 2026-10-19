import { SVG, BoundingBox } from '../utils/svgHelpers.js';

/**
 * Structure Chart (Структурна схема програми) Renderer
 * Generates academic call-graph diagrams showing relationships between main() and functions,
 * including recursive loops according to academic curriculum standards (Hryhorovych, p. 93).
 */
export class StructureChartRenderer {
    constructor(astOrData, options = {}) {
        this.functions = astOrData.functions || (astOrData.allFunctions ? astOrData.allFunctions.map(f => ({
            name: f.name,
            signature: f.signature,
            isMain: f.isMain
        })) : []);
        this.callGraph = astOrData.callGraph || [];
        this.options = Object.assign({
            theme: 'light'
        }, options);
        this.elements = [];
        this.bounds = new BoundingBox();
    }

    /**
     * Calculate node dimensions dynamically so that signatures never overflow their rectangles.
     */
    calcNodeDimensions(label) {
        if (label.length > 36) {
            const parenIdx = label.indexOf('(');
            if (parenIdx > 0 && parenIdx < label.length - 1) {
                const line1 = label.slice(0, parenIdx + 1);
                const line2 = label.slice(parenIdx + 1);
                const maxLen = Math.max(line1.length, line2.length);
                return {
                    w: Math.max(160, Math.ceil(maxLen * 8.5 + 44)),
                    h: 56,
                    lines: [line1, line2]
                };
            }
        }
        return {
            w: Math.max(160, Math.ceil(label.length * 8.5 + 40)),
            h: 48,
            lines: [label]
        };
    }

    render() {
        this.elements = [];
        this.bounds = new BoundingBox();

        if (!this.functions || this.functions.length === 0) {
            return {
                svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200"><text x="200" y="100" text-anchor="middle" fill="#94a3b8">Немає виявлених функцій</text></svg>',
                width: 400,
                height: 200
            };
        }

        // Separate main and subroutines
        const mainFunc = this.functions.find(f => f.isMain || f.name === 'main');
        const rawSubroutines = this.functions.filter(f => !f.isMain && f.name !== 'main');

        // Order subroutines by topological call depth from main()
        // Primary callers on the left, helper/callees on the right
        const depthMap = new Map();
        depthMap.set('main', 0);
        const queue = ['main'];
        while (queue.length > 0) {
            const curr = queue.shift();
            const currDepth = depthMap.get(curr);
            for (const edge of this.callGraph) {
                if (edge.from === curr && edge.from !== edge.to) {
                    if (!depthMap.has(edge.to) || depthMap.get(edge.to) > currDepth + 1) {
                        depthMap.set(edge.to, currDepth + 1);
                        queue.push(edge.to);
                    }
                }
            }
        }

        const subroutines = [...rawSubroutines].sort((a, b) => {
            const da = depthMap.get(a.name) ?? 999;
            const db = depthMap.get(b.name) ?? 999;
            if (da !== db) return da - db;
            return 0;
        });

        const positions = new Map();

        if (subroutines.length === 0) {
            // Only main function
            const mainLabel = 'main()';
            const dim = this.calcNodeDimensions(mainLabel);
            const cx = 200;
            const cy = 100;
            positions.set('main', {
                x: cx - dim.w / 2,
                y: cy - dim.h / 2,
                cx,
                cy,
                w: dim.w,
                h: dim.h,
                lines: dim.lines,
                isRecursive: false
            });
        } else {
            // Two-tier hierarchical layout matching academic textbook standards:
            // Subroutines on top layer, main() at the bottom
            const hasRecursion = subroutines.some(sub => this.callGraph.some(e => e.from === sub.name && e.to === sub.name));
            const topY = hasRecursion ? 80 : 60;

            const subDims = subroutines.map(sub => {
                const label = sub.signature || `${sub.name}()`;
                const dim = this.calcNodeDimensions(label);
                const isRecursive = this.callGraph.some(e => e.from === sub.name && e.to === sub.name);
                return { sub, label, dim, isRecursive };
            });

            const maxTopH = Math.max(...subDims.map(d => d.dim.h), 48);

            let currentX = 60;
            const gapX = 60;
            subDims.forEach(item => {
                const w = item.dim.w;
                const h = maxTopH;
                const x = currentX;
                const y = topY;
                const cx = x + w / 2;
                const cy = y + h / 2;
                positions.set(item.sub.name, {
                    x,
                    y,
                    w,
                    h,
                    cx,
                    cy,
                    lines: item.dim.lines,
                    isRecursive: item.isRecursive
                });
                currentX += w + gapX;
            });

            // Position main() underneath
            const mainDirectCalls = this.callGraph.filter(e => (e.from === 'main' || e.from === mainFunc?.name) && e.to !== 'main').map(e => e.to);
            const mainTargetPositions = mainDirectCalls.map(name => positions.get(name)).filter(Boolean);

            const mainLabel = 'main()';
            const mainDim = this.calcNodeDimensions(mainLabel);
            const mainW = Math.max(150, mainDim.w);
            const mainH = maxTopH;
            const bottomY = topY + maxTopH + 90;

            let mainX;
            if (mainTargetPositions.length === 1) {
                // If main calls exactly 1 subroutine, align main directly underneath it for a straight line
                mainX = Math.round(mainTargetPositions[0].cx - mainW / 2);
            } else if (mainTargetPositions.length > 1) {
                // Center underneath the span of called subroutines
                const minTargetX = Math.min(...mainTargetPositions.map(p => p.x));
                const maxTargetX = Math.max(...mainTargetPositions.map(p => p.x + p.w));
                mainX = Math.round((minTargetX + maxTargetX) / 2 - mainW / 2);
            } else {
                // Center underneath entire row
                const lastSubPos = positions.get(subroutines[subroutines.length - 1].name);
                const totalSpan = (lastSubPos.x + lastSubPos.w) - 60;
                mainX = Math.round(60 + totalSpan / 2 - mainW / 2);
            }

            if (mainFunc) {
                positions.set('main', {
                    x: mainX,
                    y: bottomY,
                    w: mainW,
                    h: mainH,
                    cx: mainX + mainW / 2,
                    cy: bottomY + mainH / 2,
                    lines: mainDim.lines,
                    isRecursive: false
                });
            }
        }

        // Tally incoming non-recursive callers per function to prevent arrowhead overlap
        const incomingMap = new Map();
        this.callGraph.forEach(e => {
            if (e.from !== e.to) {
                if (!incomingMap.has(e.to)) incomingMap.set(e.to, []);
                if (!incomingMap.get(e.to).includes(e.from)) {
                    incomingMap.get(e.to).push(e.from);
                }
            }
        });

        // Draw connections / arrows
        const drawnEdges = new Set();
        this.callGraph.forEach(edge => {
            const edgeKey = `${edge.from}->${edge.to}`;
            if (drawnEdges.has(edgeKey)) return;
            drawnEdges.add(edgeKey);

            const fromPos = positions.get(edge.from);
            const toPos = positions.get(edge.to);

            if (edge.isRecursive && fromPos) {
                // Clean symmetrical self-loop crown on top of the node
                const loopRadius = 24;
                const exitX = fromPos.cx - loopRadius;
                const enterX = fromPos.cx + loopRadius;
                const baseY = fromPos.y;
                const peakY = fromPos.y - 28;

                const points = [
                    [exitX, baseY],
                    [exitX, peakY],
                    [enterX, peakY],
                    [enterX, baseY]
                ];

                this.elements.push(SVG.polyline(points, true, 'arrow-flow'));
                this.elements.push(SVG.label(fromPos.cx, peakY - 12, 'рекурсія', {
                    anchor: 'middle',
                    size: 11,
                    color: '#2563eb',
                    weight: '600'
                }));
                points.forEach(p => this.bounds.addPoint(p[0], p[1]));
                this.bounds.addPoint(fromPos.cx, peakY - 20);
            } else if (fromPos && toPos && edge.from !== edge.to) {
                // Determine target entry X (offset slightly if multiple callers to avoid arrowhead overlap)
                const callers = incomingMap.get(edge.to) || [];
                const callerIdx = callers.indexOf(edge.from);
                const offset = callers.length > 1 ? (callerIdx - (callers.length - 1) / 2) * 24 : 0;
                const targetEntryX = Math.round(toPos.cx + offset);

                if (fromPos.y > toPos.y) {
                    // Call from main() upwards to subroutine
                    const startX = fromPos.cx;
                    const startY = fromPos.y;
                    const endX = targetEntryX;
                    const endY = toPos.y + toPos.h;

                    if (Math.abs(startX - endX) < 4) {
                        // Perfectly straight vertical line!
                        this.elements.push(SVG.line(startX, startY, endX, endY, true, 'arrow-flow'));
                        this.bounds.addPoint(startX, startY);
                        this.bounds.addPoint(endX, endY);
                    } else {
                        const midY = (startY + endY) / 2;
                        const pts = [
                            [startX, startY],
                            [startX, midY],
                            [endX, midY],
                            [endX, endY]
                        ];
                        this.elements.push(SVG.polyline(pts, true, 'arrow-flow'));
                        pts.forEach(p => this.bounds.addPoint(p[0], p[1]));
                    }
                } else if (fromPos.y === toPos.y) {
                    // Call between subroutines on the top tier
                    const hasIntermediate = subroutines.some(s => {
                        const p = positions.get(s.name);
                        return p && p.x > Math.min(fromPos.x, toPos.x) && p.x < Math.max(fromPos.x, toPos.x);
                    });

                    if (fromPos.x < toPos.x && !hasIntermediate) {
                        // Left-to-right adjacent call: direct clean horizontal arrow!
                        const startX = fromPos.x + fromPos.w;
                        const startY = fromPos.cy;
                        const endX = toPos.x;
                        const endY = toPos.cy;

                        this.elements.push(SVG.line(startX, startY, endX, endY, true, 'arrow-flow'));
                        this.bounds.addPoint(startX, startY);
                        this.bounds.addPoint(endX, endY);
                    } else {
                        // Routed through lower corridor to avoid cutting through intermediate nodes
                        const startX = fromPos.cx;
                        const startY = fromPos.y + fromPos.h;
                        const endX = targetEntryX;
                        const endY = toPos.y + toPos.h;
                        const corridorY = toPos.y + toPos.h + 35;

                        const pts = [
                            [startX, startY],
                            [startX, corridorY],
                            [endX, corridorY],
                            [endX, endY]
                        ];
                        this.elements.push(SVG.polyline(pts, true, 'arrow-flow'));
                        pts.forEach(p => this.bounds.addPoint(p[0], p[1]));
                    }
                } else {
                    // Downward call
                    const startX = fromPos.cx;
                    const startY = fromPos.y + fromPos.h;
                    const endX = targetEntryX;
                    const endY = toPos.y;

                    if (Math.abs(startX - endX) < 4) {
                        this.elements.push(SVG.line(startX, startY, endX, endY, true, 'arrow-flow'));
                        this.bounds.addPoint(startX, startY);
                        this.bounds.addPoint(endX, endY);
                    } else {
                        const midY = (startY + endY) / 2;
                        const pts = [
                            [startX, startY],
                            [startX, midY],
                            [endX, midY],
                            [endX, endY]
                        ];
                        this.elements.push(SVG.polyline(pts, true, 'arrow-flow'));
                        pts.forEach(p => this.bounds.addPoint(p[0], p[1]));
                    }
                }
            }
        });

        // Draw function rectangles
        positions.forEach(pos => {
            this.bounds.addRect(pos.x, pos.y, pos.w, pos.h);
            const textSvg = pos.lines.length === 1
                ? `<text x="${pos.cx}" y="${pos.cy}" text-anchor="middle" dominant-baseline="central"
                    fill="#0f172a" font-family="system-ui, -apple-system, sans-serif" font-size="13.5" font-weight="600">
                    ${SVG.escapeXml(pos.lines[0])}
                </text>`
                : `<text x="${pos.cx}" y="${pos.cy}" text-anchor="middle" dominant-baseline="central"
                    fill="#0f172a" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600">
                    <tspan x="${pos.cx}" dy="-8">${SVG.escapeXml(pos.lines[0])}</tspan>
                    <tspan x="${pos.cx}" dy="16">${SVG.escapeXml(pos.lines[1])}</tspan>
                </text>`;

            const rectSvg = `
            <g class="diagram-node structure-chart-node">
                <rect x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" rx="6" ry="6"
                    fill="#ffffff" stroke="#1e293b" stroke-width="1.8" filter="url(#soft-shadow)"/>
                ${textSvg}
            </g>
            `;
            this.elements.push(rectSvg);
        });

        const box = this.bounds.getViewBox(50, 40);
        const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" width="${box.width}" height="${box.height}">
            ${SVG.createDefs()}
            <g id="structure-chart-layer">
                ${this.elements.join('\n')}
            </g>
        </svg>
        `.trim();

        return {
            svg: svgContent,
            width: box.width,
            height: box.height
        };
    }
}
