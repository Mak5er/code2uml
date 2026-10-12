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
            theme: 'light',
            nodeWidth: 150,
            nodeHeight: 46
        }, options);
        this.elements = [];
        this.bounds = new BoundingBox();
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

        const nw = this.options.nodeWidth;
        const nh = this.options.nodeHeight;

        // Separate main and subroutines
        const mainFunc = this.functions.find(f => f.isMain || f.name === 'main');
        const subroutines = this.functions.filter(f => !f.isMain && f.name !== 'main');

        const positions = new Map();

        if (subroutines.length === 0) {
            // Only main function
            const cx = 200;
            const cy = 100;
            positions.set('main', { x: cx - nw / 2, y: cy - nh / 2, cx, cy, w: nw, h: nh, label: 'main()' });
        } else {
            // Two-tier hierarchical layout matching textbook page 93:
            // Subroutines on top layer, main() at the bottom
            const gapX = 50;
            const subTotalW = subroutines.length * nw + (subroutines.length - 1) * gapX;
            const startX = 60;
            const topY = 60;
            const bottomY = topY + nh + 90;

            subroutines.forEach((sub, idx) => {
                const x = startX + idx * (nw + gapX);
                const y = topY;
                const cx = x + nw / 2;
                const cy = y + nh / 2;
                positions.set(sub.name, {
                    x,
                    y,
                    cx,
                    cy,
                    w: nw,
                    h: nh,
                    label: sub.signature || `${sub.name}()`,
                    isRecursive: this.callGraph.some(e => e.from === sub.name && e.to === sub.name)
                });
            });

            // Center main below the subroutines
            const subCenterX = startX + subTotalW / 2;
            const mainX = subCenterX - nw / 2;
            const mainY = bottomY;
            const mainCx = mainX + nw / 2;
            const mainCy = mainY + nh / 2;

            if (mainFunc) {
                positions.set('main', {
                    x: mainX,
                    y: mainY,
                    cx: mainCx,
                    cy: mainCy,
                    w: nw,
                    h: nh,
                    label: 'main()',
                    isRecursive: false
                });
            }
        }

        // Draw connections / arrows
        const drawnEdges = new Set();
        this.callGraph.forEach(edge => {
            const edgeKey = `${edge.from}->${edge.to}`;
            if (drawnEdges.has(edgeKey)) return;
            drawnEdges.add(edgeKey);

            const fromPos = positions.get(edge.from);
            const toPos = positions.get(edge.to);

            if (edge.isRecursive && fromPos) {
                // Recursive loop arrow (exits right, loops around, enters top)
                const startX = fromPos.x + fromPos.w;
                const startY = fromPos.cy;
                const loopRight = startX + 28;
                const loopTop = fromPos.y - 18;
                const enterX = fromPos.cx + 20;
                const enterY = fromPos.y;

                const points = [
                    [startX, startY],
                    [loopRight, startY],
                    [loopRight, loopTop],
                    [enterX, loopTop],
                    [enterX, enterY]
                ];

                this.elements.push(SVG.polyline(points, true, 'arrow-flow'));
                this.elements.push(SVG.label(loopRight + 12, (startY + loopTop) / 2, 'рекурсія', {
                    anchor: 'start',
                    size: 11,
                    color: '#2563eb',
                    weight: '600'
                }));
                points.forEach(p => this.bounds.addPoint(p[0], p[1]));
                this.bounds.addPoint(loopRight + 60, (startY + loopTop) / 2);
            } else if (fromPos && toPos && edge.from !== edge.to) {
                // Call arrow from caller to callee
                let startX, startY, endX, endY;
                if (fromPos.y > toPos.y) {
                    // Upward call (e.g. main() -> f(n))
                    startX = fromPos.cx;
                    startY = fromPos.y;
                    endX = toPos.cx;
                    endY = toPos.y + toPos.h;
                } else if (fromPos.y < toPos.y) {
                    startX = fromPos.cx;
                    startY = fromPos.y + fromPos.h;
                    endX = toPos.cx;
                    endY = toPos.y;
                } else {
                    // Horizontal
                    startX = fromPos.x < toPos.x ? fromPos.x + fromPos.w : fromPos.x;
                    startY = fromPos.cy;
                    endX = fromPos.x < toPos.x ? toPos.x : toPos.x + toPos.w;
                    endY = toPos.cy;
                }

                if (Math.abs(startX - endX) < 5) {
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
        });

        // Draw function rectangles
        positions.forEach(pos => {
            this.bounds.addRect(pos.x, pos.y, pos.w, pos.h);
            const rectSvg = `
            <g class="diagram-node structure-chart-node">
                <rect x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" rx="5" ry="5"
                    fill="#ffffff" stroke="#1e293b" stroke-width="1.8" filter="url(#soft-shadow)"/>
                <text x="${pos.cx}" y="${pos.cy}" text-anchor="middle" dominant-baseline="central"
                    fill="#0f172a" font-family="system-ui, -apple-system, sans-serif" font-size="13.5" font-weight="600">
                    ${SVG.escapeXml(pos.label)}
                </text>
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
