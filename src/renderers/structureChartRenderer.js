import { SVG, BoundingBox, FONT_STACK, MONO_FONT_STACK } from '../utils/svgHelpers.js';

/**
 * Strict ДСТУ ГОСТ 19.701-90 (ISO 5807) Structure Chart Renderer
 * Supports:
 * 1. Single-file top-down hierarchical call-graph diagrams (Labs 01–08)
 *    with multi-tier bus routing and cobalt-blue recursion self-loops.
 * 2. Multi-file / multi-module GOST diagrams (Lab 09+) with dashed module
 *    enclosures (`модуль <name>`), sharp `.h`/`.cpp` file boxes, namespaces,
 *    macros, `#include` (`•───►`) dependency arrows, and blue call/macro arrows.
 */
export class StructureChartRenderer {
    constructor(astOrData = {}, options = {}) {
        const data = astOrData || {};
        this.rawFunctions = data.functions || (data.allFunctions ? data.allFunctions.map(f => ({
            name: f.name,
            qualifiedName: f.qualifiedName || f.name,
            signature: f.signature,
            qualifiedSignature: f.qualifiedSignature || f.signature,
            file: f.file || null,
            namespace: f.namespace || null,
            isMain: Boolean(f.isMain || f.name === 'main')
        })) : []);
        this.allFunctions = data.allFunctions || this.rawFunctions;
        this.callGraph = (data.callGraph || []).filter(e => !e.isStdLib);
        this.files = data.files || [];
        this.modules = data.modules || [];
        this.includes = (data.includes || []).filter(inc => inc && inc.toFile);
        this.macroUsages = data.macroUsages || [];
        this.isMultiFile = Boolean(
            data.isMultiFile ||
            this.files.length > 1 ||
            this.modules.length > 1 ||
            this.includes.length > 0
        );
        this.options = Object.assign({
            theme: 'light'
        }, options);

        this.elements = [];
        this.bounds = new BoundingBox();
    }

    // -------------------------------------------------------------------------
    // Shared Geometry & Drawing Primitives (Strict GOST 19.701-90)
    // -------------------------------------------------------------------------

    getFnKey(fn) {
        if (!fn) return '';
        const q = fn.qualifiedName || fn.name;
        return this.isMultiFile && fn.file ? `${fn.file}::${q}` : q;
    }

    getBodyForFunction(fn) {
        const match = this.allFunctions.find(f =>
            (fn.file ? f.file === fn.file : true) &&
            (f.qualifiedName || f.name) === (fn.qualifiedName || fn.name)
        );
        return match?.body || fn.body || null;
    }

    splitParams(paramStr, maxChars = 30) {
        if (!paramStr) return [];
        const parts = paramStr.split(',').map(p => p.trim()).filter(Boolean);
        const lines = [];
        let cur = '';
        for (const part of parts) {
            if (!cur) {
                cur = part;
            } else if (`${cur}, ${part}`.length <= maxChars) {
                cur = `${cur}, ${part}`;
            } else {
                lines.push(`${cur},`);
                cur = part;
            }
        }
        if (cur) lines.push(cur);
        return lines;
    }

    wrapCommaList(items, prefix = '', suffix = '', maxChars = 34) {
        if (!items || items.length === 0) return [];
        const lines = [];
        let cur = prefix;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const isLast = i === items.length - 1;
            const sep = cur === prefix ? '' : ', ';
            const end = isLast ? suffix : '';
            const candidate = `${cur}${sep}${item}${end}`;
            if (candidate.length <= maxChars || cur === prefix) {
                cur = candidate;
            } else {
                lines.push(`${cur},`);
                cur = `${item}${end}`;
            }
        }
        if (cur) lines.push(cur);
        return lines;
    }

    measureBox(titleLines, subLines = [], opts = {}) {
        const minW = opts.minW ?? 156;
        const minH = opts.minH ?? 52;
        const padX = opts.padX ?? 34;
        const padY = opts.padY ?? 14;
        const titleSize = opts.titleSize ?? 12.5;
        const subSize = opts.subSize ?? 11;

        const maxTitleLen = Math.max(...titleLines.map(l => l.length), 0);
        const maxSubLen = Math.max(...subLines.map(l => l.text.length), 0);
        const titleW = maxTitleLen * (titleSize * 0.64);
        const subW = maxSubLen * (subSize * 0.63);
        const w = Math.max(minW, Math.ceil(Math.max(titleW, subW) + padX));

        const titleLineH = titleSize * 1.38;
        const subLineH = subSize * 1.45;
        const contentH = titleLines.length * titleLineH + (subLines.length > 0 ? 4 + subLines.length * subLineH : 0);
        const h = Math.max(minH, Math.ceil(contentH + padY * 2));

        return { w, h, titleLineH, subLineH };
    }

    drawRect(x, y, w, h, opts = {}) {
        const fill = opts.fill || '#FFFFFF';
        const stroke = opts.stroke || '#0f172a';
        const strokeWidth = opts.strokeWidth ?? 1.4;
        const dash = opts.dashArray ? ` stroke-dasharray="${opts.dashArray}"` : '';
        this.bounds.addRect(x, y, w, h);
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0" ry="0" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="miter"${dash}/>`;
    }

    drawText(x, y, text, opts = {}) {
        const anchor = opts.anchor || 'middle';
        const size = opts.size ?? 12;
        const weight = opts.weight || '600';
        const color = opts.color || '#0f172a';
        const family = opts.family || MONO_FONT_STACK;
        const baseline = opts.baseline || 'central';
        this.bounds.addText(x, y, text, { anchor, size });
        return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="${baseline}" fill="${color}" font-family="${family}" font-size="${size}" font-weight="${weight}">${SVG.escapeXml(text)}</text>`;
    }

    drawBoxWithContent(box, titleLines, subLines = [], opts = {}) {
        const strokeWidth = opts.strokeWidth ?? 1.4;
        const titleSize = opts.titleSize ?? 12.5;
        const subSize = opts.subSize ?? 11;
        const titleLineH = titleSize * 1.38;
        const subLineH = subSize * 1.45;
        const contentH = titleLines.length * titleLineH + (subLines.length > 0 ? 4 + subLines.length * subLineH : 0);

        let curY = box.y + (box.h - contentH) / 2 + titleLineH / 2;
        const inner = [this.drawRect(box.x, box.y, box.w, box.h, { strokeWidth })];

        for (const tLine of titleLines) {
            inner.push(this.drawText(box.cx, curY, tLine, {
                size: titleSize,
                weight: '700',
                color: '#0f172a',
                family: opts.titleFamily || MONO_FONT_STACK
            }));
            curY += titleLineH;
        }
        if (subLines.length > 0) {
            curY += 4 + (subLineH - titleLineH) / 2;
            for (const sLine of subLines) {
                inner.push(this.drawText(box.cx, curY, sLine.text, {
                    size: subSize,
                    weight: sLine.weight || '400',
                    color: sLine.color || '#334155',
                    family: sLine.family || MONO_FONT_STACK
                }));
                curY += subLineH;
            }
        }

        if (opts.isNode !== false) {
            const idAttr = opts.nodeId ? ` data-node-id="${SVG.escapeXml(opts.nodeId)}"` : '';
            this.elements.push(`<g class="diagram-node structure-chart-node"${idAttr}>\n${inner.join('\n')}\n</g>`);
        } else {
            this.elements.push(inner.join('\n'));
        }
    }

    drawConnector(points, opts = {}) {
        if (!points || points.length < 2) return;
        points.forEach(([px, py]) => this.bounds.addPoint(px, py));
        const hasArrow = Boolean(opts.markerEnd);
        if (points.length === 2) {
            this.elements.push(SVG.line(points[0][0], points[0][1], points[1][0], points[1][1], hasArrow, opts.markerEnd || 'arrow-black', opts));
        } else {
            this.elements.push(SVG.polyline(points, hasArrow, opts.markerEnd || 'arrow-black', opts));
        }
    }

    drawRecursionLoop(box, side = 'right') {
        const loopOut = 22;
        const loopTop = box.y - 18;
        const exitY = Math.round(box.y + box.h * 0.44);
        const insetX = Math.min(20, Math.max(12, Math.floor(box.w * 0.14)));

        let pts;
        let labelX;
        if (side === 'left') {
            pts = [
                [box.x, exitY],
                [box.x - loopOut, exitY],
                [box.x - loopOut, loopTop],
                [box.x + insetX, loopTop],
                [box.x + insetX, box.y]
            ];
            labelX = box.x - 2;
        } else {
            pts = [
                [box.x + box.w, exitY],
                [box.x + box.w + loopOut, exitY],
                [box.x + box.w + loopOut, loopTop],
                [box.x + box.w - insetX, loopTop],
                [box.x + box.w - insetX, box.y]
            ];
            labelX = box.x + box.w + 2;
        }

        this.drawConnector(pts, {
            stroke: '#1d4ed8',
            strokeWidth: 1.5,
            markerEnd: 'arrow-blue'
        });
        this.elements.push(this.drawText(labelX, loopTop - 10, 'рекурсія', {
            anchor: 'middle',
            size: 11,
            weight: '700',
            color: '#1d4ed8',
            family: FONT_STACK
        }));
    }

    extractFunctionDisplayLines(fn, fileObj = null) {
        const titleName = fn.qualifiedName || fn.name;
        const title = `${titleName}()`;
        const sig = fn.qualifiedSignature || fn.signature || title;
        const pStart = sig.indexOf('(');
        const pEnd = sig.lastIndexOf(')');
        const paramText = (pStart !== -1 && pEnd > pStart) ? sig.slice(pStart + 1, pEnd).trim() : '';

        const subLines = [];
        if (fn.isMain && !paramText) {
            subLines.push({ text: 'головна програма', family: FONT_STACK, color: '#334155' });
        } else if (paramText) {
            const wrapped = this.splitParams(paramText, 30);
            wrapped.forEach(line => subLines.push({ text: line, family: MONO_FONT_STACK, color: '#334155' }));
        }

        // Check for preprocessor #if/#elif blocks in function body
        const body = this.getBodyForFunction(fn);
        if (Array.isArray(body) && body.length > 0) {
            const preprocLines = [];
            const collectPreproc = (stmts) => {
                if (!Array.isArray(stmts)) return;
                for (const s of stmts) {
                    if (s && s.isPreprocessor && s.condition) {
                        preprocLines.push(s.condition);
                        if (s.elseBranch) collectPreproc(s.elseBranch);
                    }
                }
            };
            collectPreproc(body);
            if (preprocLines.length > 0) {
                preprocLines.slice(0, 3).forEach(line => {
                    subLines.push({ text: line, family: MONO_FONT_STACK, color: '#334155' });
                });
            }
        }

        if (this.isMultiFile && fileObj && fileObj.usingNamespaces && fileObj.usingNamespaces.length > 0 && !fn.isMain) {
            const filtered = fileObj.usingNamespaces.filter(ns => ns !== 'std' && ns !== fn.namespace);
            if (filtered.length > 0) {
                subLines.push({ text: `using ${filtered.join(', ')};`, family: MONO_FONT_STACK, color: '#334155' });
            }
        }

        return { titleLines: [title], subLines };
    }

    // -------------------------------------------------------------------------
    // Mode 1: Single-File Top-Down Strict GOST Structure Chart
    // -------------------------------------------------------------------------

    computeTopDownTiers(fnList, resolveKey, edges) {
        const keys = fnList.map(fn => this.getFnKey(fn));
        const keySet = new Set(keys);
        const adj = new Map(keys.map(k => [k, []]));
        const inDeg = new Map(keys.map(k => [k, 0]));

        for (const e of edges) {
            const u = resolveKey(e.fromQualified || e.from, e.fromFile);
            const v = resolveKey(e.toQualified || e.to, e.toFile);
            if (!u || !v || u === v || !keySet.has(u) || !keySet.has(v)) continue;
            if (!adj.get(u).includes(v)) {
                adj.get(u).push(v);
                inDeg.set(v, inDeg.get(v) + 1);
            }
        }

        const mainFn = fnList.find(f => f.isMain || f.name === 'main');
        const mainKey = mainFn ? this.getFnKey(mainFn) : null;
        const depth = new Map();

        const roots = mainKey ? [mainKey] : keys.filter(k => inDeg.get(k) === 0);
        if (roots.length === 0 && keys.length > 0) roots.push(keys[0]);

        for (const r of roots) depth.set(r, 0);

        // Direct callees of main() stay on Tier 1 so horizontal sibling arrows stay clean
        // (e.g. ExtractRightTriangle -> IsValidTriangle); deeper helpers use longest-path.
        const mainDirectSet = new Set();
        if (mainKey) {
            for (const c of (adj.get(mainKey) || [])) {
                depth.set(c, 1);
                mainDirectSet.add(c);
            }
        }

        // Longest-path DFS from non-main roots or Tier 1 nodes with active stack guard
        const dfs = (u, d, stack) => {
            const children = adj.get(u) || [];
            for (const v of children) {
                if (stack.has(v) || mainDirectSet.has(v)) continue;
                const nextD = d + 1;
                if (!depth.has(v) || depth.get(v) < nextD) {
                    depth.set(v, nextD);
                    stack.add(v);
                    dfs(v, nextD, stack);
                    stack.delete(v);
                }
            }
        };

        for (const r of roots) {
            dfs(r, 0, new Set([r]));
        }
        for (const c of mainDirectSet) {
            dfs(c, 1, new Set([mainKey, c]));
        }

        // Unreachable helper functions sit on Tier 1 (or Tier 0 if no main)
        for (const k of keys) {
            if (!depth.has(k)) {
                depth.set(k, mainKey ? 1 : 0);
            }
        }

        return { depth, adj, mainKey };
    }

    buildSingleFileHierarchy(fnList, edges, fileObj = null) {
        const keyBySimple = new Map();
        const keyByQual = new Map();
        const fnMap = new Map();

        fnList.forEach((fn, idx) => {
            const key = this.getFnKey(fn);
            fnMap.set(key, { fn, key, idx });
            keyBySimple.set(fn.name, key);
            keyByQual.set(fn.qualifiedName || fn.name, key);
        });

        const resolveKey = (name, file) => {
            if (!name) return null;
            if (file && fnMap.has(`${file}::${name}`)) return `${file}::${name}`;
            if (fnMap.has(name)) return name;
            if (keyByQual.has(name)) return keyByQual.get(name);
            if (keyBySimple.has(name)) return keyBySimple.get(name);
            return null;
        };

        const { depth, adj } = this.computeTopDownTiers(fnList, resolveKey, edges);

        const recSet = new Set();
        for (const e of edges) {
            const u = resolveKey(e.fromQualified || e.from, e.fromFile);
            const v = resolveKey(e.toQualified || e.to, e.toFile);
            if (u && v && (u === v || e.isRecursive)) {
                recSet.add(u);
            }
        }

        // Group into tiers
        const maxTier = Math.max(...Array.from(depth.values()), 0);
        const tiers = Array.from({ length: maxTier + 1 }, () => []);
        fnList.forEach(fn => {
            const k = this.getFnKey(fn);
            tiers[depth.get(k)].push(k);
        });

        // Order Tier 1 by source call order from main(), and deeper tiers by parent order
        const orderIndex = new Map();
        tiers[0].forEach((k, i) => orderIndex.set(k, i));

        for (let t = 1; t <= maxTier; t++) {
            const parentOrder = new Map();
            let seqCounter = 0;
            for (const pk of tiers[t - 1]) {
                for (const ck of (adj.get(pk) || [])) {
                    if (depth.get(ck) === t && !parentOrder.has(ck)) {
                        parentOrder.set(ck, seqCounter++);
                    }
                }
            }
            tiers[t].sort((a, b) => {
                const pa = parentOrder.has(a) ? parentOrder.get(a) : 10000 + fnMap.get(a).idx;
                const pb = parentOrder.has(b) ? parentOrder.get(b) : 10000 + fnMap.get(b).idx;
                return pa - pb;
            });
            tiers[t].forEach((k, i) => orderIndex.set(k, i));
        }

        // Measure each node
        const nodeDims = new Map();
        for (const [k, item] of fnMap.entries()) {
            const { titleLines, subLines } = this.extractFunctionDisplayLines(item.fn, fileObj);
            const dim = this.measureBox(titleLines, subLines, { minW: 158, minH: 52 });
            nodeDims.set(k, { titleLines, subLines, dim, isRecursive: recSet.has(k), tier: depth.get(k) });
        }

        // Determine recursion loop sides
        const recSides = new Map();
        tiers.forEach(tierKeys => {
            tierKeys.forEach((k, idx) => {
                if (recSet.has(k)) {
                    recSides.set(k, (tierKeys.length > 1 && idx === 0) ? 'left' : 'right');
                }
            });
        });

        // Horizontal positions per tier (centered around x = 0 initially)
        const positions = new Map();
        const tierBoxes = tiers.map(tierKeys => {
            if (tierKeys.length === 0) return [];
            const maxH = Math.max(...tierKeys.map(k => nodeDims.get(k).dim.h));
            const gaps = [];
            for (let i = 0; i < tierKeys.length - 1; i++) {
                const leftRecRight = recSides.get(tierKeys[i]) === 'right';
                const rightRecLeft = recSides.get(tierKeys[i + 1]) === 'left';
                let gap = 46;
                if (leftRecRight) gap += 36;
                if (rightRecLeft) gap += 36;
                gaps.push(gap);
            }
            const totalW = tierKeys.reduce((s, k) => s + nodeDims.get(k).dim.w, 0) + gaps.reduce((s, g) => s + g, 0);
            let curX = -totalW / 2;
            return tierKeys.map((k, i) => {
                const w = nodeDims.get(k).dim.w;
                const box = {
                    key: k,
                    fn: fnMap.get(k).fn,
                    x: Math.round(curX),
                    y: 0,
                    w,
                    h: maxH,
                    cx: Math.round(curX + w / 2),
                    cy: 0,
                    ...nodeDims.get(k),
                    recSide: recSides.get(k) || null
                };
                positions.set(k, box);
                curX += w + (i < gaps.length ? gaps[i] : 0);
                return box;
            });
        });

        // Align Tier 0 root centered over Tier 1 if single root
        if (tierBoxes[0]?.length === 1 && tierBoxes[1]?.length > 0) {
            const minX1 = Math.min(...tierBoxes[1].map(b => b.x));
            const maxX1 = Math.max(...tierBoxes[1].map(b => b.x + b.w));
            const center1 = Math.round((minX1 + maxX1) / 2);
            const rootBox = tierBoxes[0][0];
            rootBox.cx = center1;
            rootBox.x = Math.round(center1 - rootBox.w / 2);
        }

        // Align Tier t>=2 nodes directly underneath their parent(s) X while preventing collisions
        for (let t = 2; t <= maxTier; t++) {
            const row = tierBoxes[t];
            if (!row || row.length === 0) continue;

            // Compute ideal cx for each box from its parent(s)
            const desiredCxs = row.map(b => {
                const callers = [];
                for (const [u, vs] of adj.entries()) {
                    if (vs.includes(b.key) && depth.get(u) < t) callers.push(positions.get(u));
                }
                if (callers.length > 0) {
                    return Math.round(callers.reduce((s, c) => s + c.cx, 0) / callers.length);
                }
                return b.cx;
            });

            // Place boxes at desired centers, then push right minimally to satisfy gaps
            for (let i = 0; i < row.length; i++) {
                row[i].cx = desiredCxs[i];
                row[i].x = Math.round(row[i].cx - row[i].w / 2);
            }
            for (let i = 1; i < row.length; i++) {
                const prev = row[i - 1];
                const cur = row[i];
                let minGap = 46;
                if (prev.recSide === 'right') minGap += 36;
                if (cur.recSide === 'left') minGap += 36;
                const minLeft = prev.x + prev.w + minGap;
                if (cur.x < minLeft) {
                    cur.x = minLeft;
                    cur.cx = Math.round(cur.x + cur.w / 2);
                }
            }
        }

        // Collect unique non-self edges
        const uniqueEdges = [];
        const seenEdges = new Set();
        for (const e of edges) {
            const u = resolveKey(e.fromQualified || e.from, e.fromFile);
            const v = resolveKey(e.toQualified || e.to, e.toFile);
            if (!u || !v || u === v) continue;
            const ek = `${u}->${v}`;
            if (!seenEdges.has(ek)) {
                seenEdges.add(ek);
                uniqueEdges.push({ from: u, to: v });
            }
        }

        // Assign vertical Y coordinates per tier
        let curY = 40;
        for (let t = 0; t <= maxTier; t++) {
            const boxes = tierBoxes[t];
            if (!boxes || boxes.length === 0) continue;
            const rowH = boxes[0].h;
            for (const b of boxes) {
                b.y = curY;
                b.cy = Math.round(curY + rowH / 2);
            }

            if (t < maxTier) {
                const callersInTier = new Set(
                    uniqueEdges
                        .filter(e => depth.get(e.from) === t && depth.get(e.to) > t)
                        .map(e => e.from)
                );
                const sameTierSkips = uniqueEdges.filter(e => {
                    if (depth.get(e.from) !== t || depth.get(e.to) !== t) return false;
                    const idxA = orderIndex.get(e.from);
                    const idxB = orderIndex.get(e.to);
                    return Math.abs(idxA - idxB) > 1;
                }).length;
                const nextHasRec = tierBoxes[t + 1].some(b => b.isRecursive);
                const busCount = Math.max(1, callersInTier.size) + sameTierSkips;
                const gapY = Math.max(66, 36 + busCount * 16 + (nextHasRec ? 28 : 0));
                curY += rowH + gapY;
            }
        }

        return { positions, tierBoxes, uniqueEdges, depth, orderIndex };
    }

    renderSingleFileLayout(fnList, edges, offsetX = 0, offsetY = 0, opts = {}) {
        const { positions, tierBoxes, uniqueEdges, depth, orderIndex } = this.buildSingleFileHierarchy(fnList, edges, opts.fileObj || null);

        // Shift positions by (offsetX, offsetY)
        for (const box of positions.values()) {
            box.x += offsetX;
            box.cx += offsetX;
            box.y += offsetY;
            box.cy += offsetY;
        }

        // Tally incoming non-same-tier callers per target for clean arrowhead spacing
        const incomingByTarget = new Map();
        for (const e of uniqueEdges) {
            if (depth.get(e.from) !== depth.get(e.to)) {
                if (!incomingByTarget.has(e.to)) incomingByTarget.set(e.to, []);
                incomingByTarget.get(e.to).push(e.from);
            }
        }

        const getEntryX = (fromKey, toKey) => {
            const toBox = positions.get(toKey);
            const callers = incomingByTarget.get(toKey) || [];
            if (callers.length <= 1) return toBox.cx;
            // Sort callers left-to-right so entry arrowheads never cross
            const sorted = [...callers].sort((a, b) => positions.get(a).cx - positions.get(b).cx);
            const idx = sorted.indexOf(fromKey);
            const maxSpan = Math.min(toBox.w * 0.45, (sorted.length - 1) * 18);
            const step = sorted.length > 1 ? maxSpan / (sorted.length - 1) : 0;
            return Math.round(toBox.cx - maxSpan / 2 + idx * step);
        };

        const lineColor = opts.callColor || '#0f172a';
        const markerEnd = opts.callMarker || 'arrow-black';
        const strokeWidth = opts.callWidth || 1.6;

        // 1. Group Tier t -> Tier t+1 edges by caller so each caller gets a clean bus
        const edgesByCaller = new Map();
        const sameTierEdges = [];
        const skipTierEdges = [];

        for (const e of uniqueEdges) {
            const dFrom = depth.get(e.from);
            const dTo = depth.get(e.to);
            if (dTo === dFrom + 1) {
                if (!edgesByCaller.has(e.from)) edgesByCaller.set(e.from, []);
                edgesByCaller.get(e.from).push(e.to);
            } else if (dTo === dFrom) {
                sameTierEdges.push(e);
            } else {
                skipTierEdges.push(e);
            }
        }

        // Route Tier t -> Tier t+1 buses
        const callerTierTrack = new Map();
        for (const [callerKey, targets] of edgesByCaller.entries()) {
            const dFrom = depth.get(callerKey);
            const trackIdx = callerTierTrack.get(dFrom) || 0;
            callerTierTrack.set(dFrom, trackIdx + 1);

            const fromBox = positions.get(callerKey);
            const tierBottom = Math.max(...tierBoxes[dFrom].map(b => b.y + b.h));
            const busY = tierBottom + 22 + trackIdx * 15;

            const entryPoints = targets.map(tk => ({
                tk,
                toBox: positions.get(tk),
                ex: getEntryX(callerKey, tk)
            }));

            if (entryPoints.length === 1 && Math.abs(fromBox.cx - entryPoints[0].ex) <= 3 && trackIdx === 0) {
                const { ex, toBox } = entryPoints[0];
                this.drawConnector([[fromBox.cx, fromBox.y + fromBox.h], [ex, toBox.y]], {
                    stroke: lineColor, strokeWidth, markerEnd
                });
            } else {
                const xs = [fromBox.cx, ...entryPoints.map(p => p.ex)];
                const minBusX = Math.min(...xs);
                const maxBusX = Math.max(...xs);
                // Vertical stem down from caller
                this.drawConnector([[fromBox.cx, fromBox.y + fromBox.h], [fromBox.cx, busY]], {
                    stroke: lineColor, strokeWidth
                });
                // Horizontal bus bar
                if (maxBusX > minBusX) {
                    this.drawConnector([[minBusX, busY], [maxBusX, busY]], {
                        stroke: lineColor, strokeWidth
                    });
                }
                // Vertical drops into each target
                for (const { ex, toBox } of entryPoints) {
                    this.drawConnector([[ex, busY], [ex, toBox.y]], {
                        stroke: lineColor, strokeWidth, markerEnd
                    });
                }
            }
        }

        // Route same-tier sibling calls
        const sameTierLaneCount = new Map();
        for (const e of sameTierEdges) {
            const d = depth.get(e.from);
            const fromBox = positions.get(e.from);
            const toBox = positions.get(e.to);
            const idxA = orderIndex.get(e.from);
            const idxB = orderIndex.get(e.to);

            if (Math.abs(idxA - idxB) === 1) {
                const goRight = fromBox.x < toBox.x;
                const yOffset = (fromBox.isRecursive && fromBox.recSide === (goRight ? 'right' : 'left')) ? 10 : 0;
                const y = fromBox.cy + yOffset;
                const x1 = goRight ? fromBox.x + fromBox.w : fromBox.x;
                const x2 = goRight ? toBox.x : toBox.x + toBox.w;
                this.drawConnector([[x1, y], [x2, y]], { stroke: lineColor, strokeWidth, markerEnd });
            } else {
                const lane = sameTierLaneCount.get(d) || 0;
                sameTierLaneCount.set(d, lane + 1);
                const tierBottom = Math.max(...tierBoxes[d].map(b => b.y + b.h));
                const extraOffset = (callerTierTrack.get(d) || 0) * 15;
                const laneY = tierBottom + 22 + extraOffset + lane * 14;
                const exitX = fromBox.cx + 10;
                const entryX = toBox.cx - 10;
                this.drawConnector([
                    [exitX, fromBox.y + fromBox.h],
                    [exitX, laneY],
                    [entryX, laneY],
                    [entryX, toBox.y + toBox.h]
                ], { stroke: lineColor, strokeWidth, markerEnd });
            }
        }

        // Route skip-tier / back-edge calls safely clear of intermediate boxes
        skipTierEdges.forEach((e, idx) => {
            const dFrom = depth.get(e.from);
            const dTo = depth.get(e.to);
            const fromBox = positions.get(e.from);
            const toBox = positions.get(e.to);
            const entryX = dFrom < dTo ? getEntryX(e.from, e.to) : toBox.cx;

            // Find an unobstructed vertical X gutter between tier dFrom and dTo
            const minAllX = Math.min(...Array.from(positions.values()).map(b => b.x)) - 26;
            const maxAllX = Math.max(...Array.from(positions.values()).map(b => b.x + b.w)) + 26;
            const midTargetX = (fromBox.cx + entryX) / 2;
            const candidateXs = [midTargetX];
            for (let t = Math.min(dFrom, dTo) + 1; t < Math.max(dFrom, dTo); t++) {
                const boxes = tierBoxes[t] || [];
                for (let i = 0; i < boxes.length - 1; i++) {
                    candidateXs.push((boxes[i].x + boxes[i].w + boxes[i + 1].x) / 2);
                }
            }
            candidateXs.push(minAllX - idx * 14, maxAllX + idx * 14);

            const isClearX = (gx) => {
                for (let t = Math.min(dFrom, dTo) + 1; t < Math.max(dFrom, dTo); t++) {
                    for (const b of (tierBoxes[t] || [])) {
                        if (gx >= b.x - 10 && gx <= b.x + b.w + 10) return false;
                    }
                }
                return true;
            };

            const gutterX = Math.round(candidateXs.find(isClearX) ?? (maxAllX + idx * 14));
            const startY = fromBox.y + fromBox.h;
            const topCorridorY = startY + 14 + (callerTierTrack.get(dFrom) || 0) * 15 + idx * 10;
            const targetTopY = toBox.y;
            const approachY = targetTopY - 16 - idx * 10;

            this.drawConnector([
                [fromBox.cx, startY],
                [fromBox.cx, topCorridorY],
                [gutterX, topCorridorY],
                [gutterX, approachY],
                [entryX, approachY],
                [entryX, targetTopY]
            ], { stroke: lineColor, strokeWidth, markerEnd });
        });

        // 2. Draw all function boxes & recursion loops on top
        for (const box of positions.values()) {
            this.drawBoxWithContent(box, box.titleLines, box.subLines, {
                isNode: true,
                nodeId: `sc_${box.fn.name}`,
                strokeWidth: 1.5
            });
            if (box.isRecursive) {
                this.drawRecursionLoop(box, box.recSide || 'right');
            }
        }

        return positions;
    }

    renderSingleFile() {
        const validFuncs = this.rawFunctions.filter(f => !f.isDeclaration);
        if (validFuncs.length === 0) {
            return this.renderEmpty();
        }
        this.renderSingleFileLayout(validFuncs, this.callGraph, 0, 0);
        return this.finalizeSvg(50, 40);
    }

    // -------------------------------------------------------------------------
    // Mode 2: Multi-File / Multi-Module Strict GOST Structure Chart (Lab 9+)
    // -------------------------------------------------------------------------

    groupGlobalsLines(globals, filterNs = null) {
        const filtered = globals.filter(g => filterNs === null || (g.namespace || null) === filterNs);
        if (filtered.length === 0) return [];
        const groups = [];
        for (const g of filtered) {
            const key = `${g.isExtern ? 'extern ' : ''}${g.type || 'auto'}`;
            const last = groups[groups.length - 1];
            if (last && last.key === key) {
                last.names.push(g.name);
            } else {
                groups.push({ key, names: [g.name] });
            }
        }
        const lines = [];
        for (const grp of groups) {
            const wrapped = this.wrapCommaList(grp.names, `${grp.key} `, ';', 32);
            wrapped.forEach(l => lines.push(l));
        }
        return lines;
    }

    buildHeaderBlocks(fileObj) {
        const blocks = [];
        const namespaces = fileObj.namespaces || [];
        const declFuncs = (fileObj.functions || []).filter(f => f.isDeclaration);
        const implFuncs = (fileObj.functions || []).filter(f => !f.isDeclaration);
        const globals = fileObj.globals || [];
        const macros = fileObj.macros || [];

        if (namespaces.length > 0) {
            for (const ns of namespaces) {
                const subLines = [];
                declFuncs.filter(f => f.namespace === ns).forEach(f => {
                    subLines.push({ text: `${f.returnType ? `${f.returnType} ` : 'void '}${f.signature || `${f.name}()`};`, color: '#334155' });
                });
                const gLines = this.groupGlobalsLines(globals, ns);
                gLines.forEach(l => subLines.push({ text: l, color: '#334155' }));
                blocks.push({
                    kind: 'namespace',
                    id: `ns_${fileObj.name}_${ns}`,
                    titleLines: [`namespace ${ns}`],
                    subLines
                });
            }
            return blocks;
        }

        if (declFuncs.length > 0 || implFuncs.length > 0 || globals.length > 0) {
            const subLines = [];
            [...declFuncs, ...implFuncs].forEach(f => {
                subLines.push({ text: f.qualifiedSignature || f.signature || `${f.name}()`, color: '#334155' });
            });
            this.groupGlobalsLines(globals, null).forEach(l => subLines.push({ text: l, color: '#334155' }));
            if (macros.length === 0) {
                blocks.push({
                    kind: 'header_decls',
                    id: `hdr_${fileObj.name}`,
                    titleLines: [fileObj.name],
                    subLines
                });
                return blocks;
            }
        }

        // Macros header grouping
        if (macros.length > 0) {
            return this.buildMacroGroupBlocks(fileObj);
        }

        blocks.push({
            kind: 'header_empty',
            id: `hdr_${fileObj.name}`,
            titleLines: [fileObj.name],
            subLines: []
        });
        return blocks;
    }

    isObjectMacro(m) {
        return !m || m.kind === 'object' || m.kind === 'constant' || !Array.isArray(m.params) || m.params.length === 0;
    }

    formatMacroDisplay(m) {
        if (this.isObjectMacro(m)) {
            return m.body ? `#define ${m.name} ${m.body}`.trim() : `#define ${m.name}`;
        }
        return `${m.name}(${m.params.join(', ')})`;
    }

    buildMacroGroupBlocks(fileObj, alignMode = 'auto', callerOrder = []) {
        const macros = fileObj.macros || [];
        if (macros.length === 0) return [];

        const usagesForFile = this.macroUsages.filter(u => u.toHeader === fileObj.name);
        // Map each macro -> set of calling functions
        const macroToCallers = new Map();
        for (const m of macros) macroToCallers.set(m.name, new Set());
        for (const u of usagesForFile) {
            if (macroToCallers.has(u.macroName)) {
                macroToCallers.get(u.macroName).add(u.fromFunction || u.fromQualified);
            }
        }

        if (alignMode === 'horizontal' && callerOrder.length >= 2) {
            // Group macros per Tier-1 function in callerOrder so vertical arrows drop straight down!
            const groups = callerOrder.map(fnName => ({
                caller: fnName,
                macros: [],
                title: fnName
            }));
            const unattributed = [];
            for (const m of macros) {
                const callers = Array.from(macroToCallers.get(m.name) || []);
                const nonMainCaller = callerOrder.find(c => callers.includes(c));
                if (nonMainCaller) {
                    groups.find(g => g.caller === nonMainCaller).macros.push(m);
                } else {
                    unattributed.push(m);
                }
            }
            if (unattributed.length > 0) {
                const targetGroup = groups.find(g => g.macros.length === 0) || groups[groups.length - 1];
                targetGroup.macros.push(...unattributed);
            }

            const nonEmpty = groups.filter(g => g.macros.length > 0);
            if (nonEmpty.length > 0) {
                return nonEmpty.map((g, idx) => {
                    const labels = g.macros.map(m =>
                        this.isObjectMacro(m) ? m.name : `${m.name}(${m.params.join(', ')})`
                    );
                    const wrapped = this.wrapCommaList(labels, '', '', 26);
                    return {
                        kind: 'macro_group',
                        id: `mg_${fileObj.name}_${idx}`,
                        callerKeys: [g.caller, ...Array.from(new Set(g.macros.flatMap(m => Array.from(macroToCallers.get(m.name) || []))))],
                        macroNames: g.macros.map(m => m.name),
                        titleLines: [`Макроси (${g.caller})`],
                        subLines: wrapped.map(t => ({ text: t, color: '#334155' }))
                    };
                });
            }
        }

        // Default / Vertical split (e.g., Lab_09_2_1: constants & output macros vs math & branch macros)
        const mainCallers = new Set(this.rawFunctions.filter(f => f.isMain).map(f => f.name));
        const outputOrConst = [];
        const mathOrLogic = [];

        for (const m of macros) {
            const callers = Array.from(macroToCallers.get(m.name) || []);
            const usedOnlyByMain = callers.length > 0 && callers.every(c => mainCallers.has(c));
            const isConstOrPrint = this.isObjectMacro(m) || /print|log|msg|out|err/i.test(m.name);
            if (usedOnlyByMain || isConstOrPrint) {
                outputOrConst.push(m);
            } else {
                mathOrLogic.push(m);
            }
        }

        const groups = [];
        if (outputOrConst.length > 0 && mathOrLogic.length > 0) {
            groups.push({ title: 'Константи та виведення', list: outputOrConst });
            groups.push({ title: 'Математичні та логічні макроси', list: mathOrLogic });
        } else {
            groups.push({ title: 'Макроси та директиви', list: macros });
        }

        return groups.map((g, idx) => {
            const subLines = [];
            const objMacros = g.list.filter(m => this.isObjectMacro(m));
            const fnMacros = g.list.filter(m => !this.isObjectMacro(m));
            objMacros.forEach(m => subLines.push({ text: this.formatMacroDisplay(m), color: '#334155' }));
            if (fnMacros.length > 0) {
                const fnNames = fnMacros.map(m => `${m.name}(${m.params.join(', ')})`);
                this.wrapCommaList(fnNames, '', '', 34).forEach(line => {
                    subLines.push({ text: line, color: '#334155' });
                });
            }
            // Prefer callers of function-like macros in this group so shared constants (e.g. Z) don't cross-wire
            const fnCallers = Array.from(new Set(fnMacros.flatMap(m => Array.from(macroToCallers.get(m.name) || []))));
            const allCallers = Array.from(new Set(g.list.flatMap(m => Array.from(macroToCallers.get(m.name) || []))));
            return {
                kind: 'macro_group',
                id: `mg_${fileObj.name}_${idx}`,
                callerKeys: fnCallers.length > 0 ? fnCallers : allCallers,
                macroNames: g.list.map(m => m.name),
                titleLines: [g.title],
                subLines
            };
        });
    }

    buildSourceBlocks(fileObj) {
        const implFuncs = (fileObj.functions || []).filter(f => !f.isDeclaration);
        if (implFuncs.length > 0) {
            return implFuncs.map(f => {
                const { titleLines, subLines } = this.extractFunctionDisplayLines(f, fileObj);
                return {
                    kind: 'function',
                    id: `fn_${fileObj.name}_${f.qualifiedName || f.name}`,
                    fn: f,
                    titleLines,
                    subLines
                };
            });
        }

        // Source file with globals only (e.g., var.cpp)
        const namespaces = fileObj.namespaces || [];
        const globals = fileObj.globals || [];
        if (namespaces.length > 0) {
            return namespaces.map(ns => ({
                kind: 'namespace_defs',
                id: `nsdef_${fileObj.name}_${ns}`,
                titleLines: [`namespace ${ns}`],
                subLines: this.groupGlobalsLines(globals, ns).map(l => ({ text: l, color: '#334155' }))
            }));
        }

        return [{
            kind: 'file_globals',
            id: `globals_${fileObj.name}`,
            titleLines: [fileObj.name],
            subLines: this.groupGlobalsLines(globals, null).map(l => ({ text: l, color: '#334155' }))
        }];
    }

    orderPairedModulesTopologically(pairedModules, fileMap) {
        if (pairedModules.length <= 1) return pairedModules;
        const modByFile = new Map();
        pairedModules.forEach(m => {
            if (m.headerFile) modByFile.set(m.headerFile, m.name);
            if (m.sourceFile) modByFile.set(m.sourceFile, m.name);
        });

        // Build directed edges: caller -> callee (or main -> module), and non-var -> var
        const score = new Map(pairedModules.map(m => [m.name, 0]));
        const mainFiles = this.files.filter(f => (f.functions || []).some(fn => fn.isMain)).map(f => f.name);
        const modCalls = new Map(pairedModules.map(m => [m.name, new Set()]));

        for (const e of this.callGraph) {
            const fromMod = modByFile.get(e.fromFile);
            const toMod = modByFile.get(e.toFile);
            if (mainFiles.includes(e.fromFile) && toMod) {
                score.set(toMod, Math.min(score.get(toMod), -10));
            }
            if (fromMod && toMod && fromMod !== toMod) {
                modCalls.get(fromMod).add(toMod);
            }
        }

        // Modules without functions (data/globals only like var) belong on the right
        for (const m of pairedModules) {
            const srcFile = fileMap.get(m.sourceFile);
            const hasFuncs = srcFile && (srcFile.functions || []).some(f => !f.isDeclaration);
            if (!hasFuncs) {
                score.set(m.name, 100);
            }
        }

        // Topological sort respecting call order
        const remaining = [...pairedModules].sort((a, b) => score.get(a.name) - score.get(b.name));
        const ordered = [];
        const placed = new Set();

        while (remaining.length > 0) {
            const idx = remaining.findIndex(m => {
                // Prefer module with no unplaced callers
                return !remaining.some(other => other.name !== m.name && modCalls.get(other.name).has(m.name));
            });
            const next = remaining.splice(idx >= 0 ? idx : 0, 1)[0];
            if (!placed.has(next.name)) {
                ordered.push(next);
                placed.add(next.name);
            }
        }
        return ordered;
    }

    drawLegend(rightX, topY) {
        const itemsW = 395;
        const startX = Math.max(20, rightX - itemsW);
        this.drawConnector([[startX, topY + 10], [startX + 36, topY + 10]], {
            stroke: '#0f172a',
            strokeWidth: 1.4,
            markerStart: 'dot-black',
            markerEnd: 'arrow-black'
        });
        this.elements.push(this.drawText(startX + 44, topY + 10, '#include (підключення)', {
            anchor: 'start',
            size: 10.5,
            weight: '500',
            color: '#0f172a',
            family: MONO_FONT_STACK
        }));

        const callStart = startX + 215;
        this.drawConnector([[callStart, topY + 10], [callStart + 36, topY + 10]], {
            stroke: '#1d4ed8',
            strokeWidth: 1.5,
            markerEnd: 'arrow-blue'
        });
        this.elements.push(this.drawText(callStart + 44, topY + 10, 'виклик / макрос', {
            anchor: 'start',
            size: 10.5,
            weight: '600',
            color: '#1d4ed8',
            family: FONT_STACK
        }));
    }

    renderMultiFile() {
        const fileMap = new Map(this.files.map(f => [f.name, f]));
        const pairedModules = this.modules.filter(m => m.isPaired && m.headerFile && m.sourceFile);

        if (pairedModules.length > 0) {
            return this.renderPairedModulesLayout(pairedModules, fileMap);
        }
        return this.renderStandaloneMultiFileLayout();
    }

    renderPairedModulesLayout(pairedModules, fileMap) {
        const orderedMods = this.orderPairedModulesTopologically(pairedModules, fileMap);
        const pairedFileSet = new Set();
        orderedMods.forEach(m => {
            pairedFileSet.add(m.headerFile);
            pairedFileSet.add(m.sourceFile);
        });

        const topFiles = this.files.filter(f => !pairedFileSet.has(f.name) && !f.isHeader);
        const extraHeaders = this.files.filter(f => !pairedFileSet.has(f.name) && f.isHeader);

        // Measure inner blocks for each paired module
        const modSpecs = orderedMods.map(m => {
            const hFile = fileMap.get(m.headerFile) || { name: m.headerFile, namespaces: [], functions: [], globals: [], macros: [] };
            const sFile = fileMap.get(m.sourceFile) || { name: m.sourceFile, namespaces: [], functions: [], globals: [], macros: [], usingNamespaces: [] };
            const hBlocks = this.buildHeaderBlocks(hFile).map(b => ({
                ...b,
                dim: this.measureBox(b.titleLines, b.subLines, { minW: 210, minH: 54, padX: 30, padY: 10 })
            }));
            const sBlocks = this.buildSourceBlocks(sFile).map(b => ({
                ...b,
                dim: this.measureBox(b.titleLines, b.subLines, { minW: 210, minH: 58, padX: 30, padY: 12 })
            }));

            const maxInnerW = Math.max(220, ...hBlocks.map(b => b.dim.w), ...sBlocks.map(b => b.dim.w));
            const fileW = maxInnerW + 32;
            const modW = fileW + 36;
            const hInnerTotalH = hBlocks.reduce((s, b) => s + b.dim.h, 0) + Math.max(0, hBlocks.length - 1) * 12;
            const sInnerTotalH = sBlocks.reduce((s, b) => s + b.dim.h, 0) + Math.max(0, sBlocks.length - 1) * 12;
            const headerH = 38 + hInnerTotalH + 14;
            const sourceH = 38 + sInnerTotalH + 14;

            return { mod: m, hFile, sFile, hBlocks, sBlocks, fileW, modW, headerH, sourceH };
        });

        const uniformHeaderH = Math.max(96, ...modSpecs.map(s => s.headerH));
        const uniformSourceH = Math.max(108, ...modSpecs.map(s => s.sourceH));

        // Measure top standalone .cpp files
        const topSpecs = topFiles.map(tf => {
            const blocks = this.buildSourceBlocks(tf).map(b => ({
                ...b,
                dim: this.measureBox(b.titleLines, b.subLines, { minW: 240, minH: 52, padX: 36, padY: 12 })
            }));
            const maxInnerW = Math.max(240, ...blocks.map(b => b.dim.w));
            const fileW = Math.max(360, maxInnerW + 100);
            const innerH = blocks.reduce((s, b) => s + b.dim.h, 0) + Math.max(0, blocks.length - 1) * 14;
            const fileH = 38 + innerH + 14;
            return { file: tf, blocks, fileW, fileH };
        });

        // Count cross-module adjacent vs skip #include edges to size corridors
        const modIndexByFile = new Map();
        modSpecs.forEach((ms, i) => {
            modIndexByFile.set(ms.mod.headerFile, i);
            modIndexByFile.set(ms.mod.sourceFile, i);
        });

        const midIncludeEdges = [];
        const skipIncludeEdges = [];
        for (const inc of this.includes) {
            const fi = modIndexByFile.get(inc.fromFile);
            const ti = modIndexByFile.get(inc.toFile);
            if (fi !== undefined && ti !== undefined) {
                if (Math.abs(fi - ti) <= 1) {
                    midIncludeEdges.push({ ...inc, fi, ti });
                } else {
                    skipIncludeEdges.push({ ...inc, fi, ti });
                }
            }
        }

        const crossAdjacentCount = midIncludeEdges.filter(e => e.fi !== e.ti).length;
        const totalMidCorridorLanes = crossAdjacentCount + skipIncludeEdges.length;
        const internalGap = Math.max(102, 54 + totalMidCorridorLanes * 20);
        const modGapX = 96;
        const totalModRowW = modSpecs.reduce((s, ms) => s + ms.modW, 0) + Math.max(0, modSpecs.length - 1) * modGapX;

        const topRowW = topSpecs.reduce((s, ts) => s + ts.fileW, 0) + Math.max(0, topSpecs.length - 1) * 40;
        const startX = 60;
        const totalSpanW = Math.max(totalModRowW, topRowW);
        const rowLeftX = startX + Math.round((totalSpanW - totalModRowW) / 2);

        const topFileY = 24;
        const maxTopH = topSpecs.length > 0 ? Math.max(...topSpecs.map(t => t.fileH)) : 0;
        const topToModGap = topSpecs.length > 0 ? 86 : 0;
        const modY = topFileY + maxTopH + topToModGap;
        const modH = 18 + uniformHeaderH + internalGap + uniformSourceH + 18;

        // Place top files centered
        const fileBoxMap = new Map();
        const fnBoxMap = new Map();

        let curTopX = startX + Math.round((totalSpanW - topRowW) / 2);
        for (const ts of topSpecs) {
            const fBox = { x: curTopX, y: topFileY, w: ts.fileW, h: ts.fileH, cx: curTopX + ts.fileW / 2, name: ts.file.name };
            fileBoxMap.set(ts.file.name, fBox);
            this.elements.push(this.drawRect(fBox.x, fBox.y, fBox.w, fBox.h, { strokeWidth: 1.6 }));
            this.elements.push(this.drawText(fBox.x + 14, fBox.y + 18, ts.file.name, { anchor: 'start', size: 13, weight: '700' }));

            let innerY = fBox.y + 34;
            for (const b of ts.blocks) {
                const bx = fBox.x + Math.round((fBox.w - b.dim.w) / 2);
                const box = { x: bx, y: innerY, w: b.dim.w, h: b.dim.h, cx: bx + Math.round(b.dim.w / 2), cy: innerY + Math.round(b.dim.h / 2) };
                this.drawBoxWithContent(box, b.titleLines, b.subLines, { nodeId: b.id });
                if (b.fn) {
                    fnBoxMap.set(`${ts.file.name}::${b.fn.qualifiedName || b.fn.name}`, box);
                    fnBoxMap.set(b.fn.qualifiedName || b.fn.name, box);
                    fnBoxMap.set(b.fn.name, box);
                }
                innerY += b.dim.h + 14;
            }
            curTopX += ts.fileW + 40;
        }

        // Place paired modules
        const modBoxes = [];
        let curModX = rowLeftX;
        for (const ms of modSpecs) {
            const modBox = { x: curModX, y: modY, w: ms.modW, h: modH };
            modBoxes.push(modBox);

            // Label above top-left corner + dashed module frame
            this.elements.push(this.drawText(modBox.x, modBox.y - 11, `модуль ${ms.mod.name}`, {
                anchor: 'start', size: 13, weight: '700', family: FONT_STACK
            }));
            this.elements.push(this.drawRect(modBox.x, modBox.y, modBox.w, modBox.h, {
                strokeWidth: 1.4, dashArray: '6,4'
            }));

            const fileX = modBox.x + 18;
            const headerY = modBox.y + 18;
            const sourceY = headerY + uniformHeaderH + internalGap;

            // Header file box
            const hBox = { x: fileX, y: headerY, w: ms.fileW, h: uniformHeaderH, cx: fileX + Math.round(ms.fileW / 2), name: ms.hFile.name };
            fileBoxMap.set(ms.hFile.name, hBox);
            this.elements.push(this.drawRect(hBox.x, hBox.y, hBox.w, hBox.h, { strokeWidth: 1.6 }));
            this.elements.push(this.drawText(hBox.x + 12, hBox.y + 18, ms.hFile.name, { anchor: 'start', size: 13, weight: '700' }));

            let hy = hBox.y + 32;
            const hBlockW = ms.fileW - 32;
            for (const b of ms.hBlocks) {
                const box = { x: hBox.x + 16, y: hy, w: hBlockW, h: b.dim.h, cx: hBox.cx, cy: hy + Math.round(b.dim.h / 2) };
                this.drawBoxWithContent(box, b.titleLines, b.subLines, { isNode: false, strokeWidth: 1.4 });
                hy += b.dim.h + 12;
            }

            // Source file box
            const sBox = { x: fileX, y: sourceY, w: ms.fileW, h: uniformSourceH, cx: fileX + Math.round(ms.fileW / 2), name: ms.sFile.name };
            fileBoxMap.set(ms.sFile.name, sBox);
            this.elements.push(this.drawRect(sBox.x, sBox.y, sBox.w, sBox.h, { strokeWidth: 1.6 }));
            this.elements.push(this.drawText(sBox.x + 12, sBox.y + 18, ms.sFile.name, { anchor: 'start', size: 13, weight: '700' }));

            let sy = sBox.y + 32;
            const sBlockW = ms.fileW - 32;
            for (const b of ms.sBlocks) {
                const box = { x: sBox.x + 16, y: sy, w: sBlockW, h: b.dim.h, cx: sBox.cx, cy: sy + Math.round(b.dim.h / 2) };
                this.drawBoxWithContent(box, b.titleLines, b.subLines, { nodeId: b.id, strokeWidth: 1.4 });
                if (b.fn) {
                    fnBoxMap.set(`${ms.sFile.name}::${b.fn.qualifiedName || b.fn.name}`, box);
                    fnBoxMap.set(b.fn.qualifiedName || b.fn.name, box);
                    fnBoxMap.set(b.fn.name, box);
                }
                sy += b.dim.h + 12;
            }

            curModX += ms.modW + modGapX;
        }

        // Extra standalone headers if any (e.g. macros.h combined with paired modules)
        let maxExtraBottom = modY + modH;
        if (extraHeaders.length > 0) {
            let exY = modY;
            const exX = curModX;
            for (const eh of extraHeaders) {
                const blocks = this.buildHeaderBlocks(eh).map(b => ({
                    ...b,
                    dim: this.measureBox(b.titleLines, b.subLines, { minW: 220, minH: 56, padX: 32, padY: 10 })
                }));
                const ew = Math.max(250, ...blocks.map(b => b.dim.w)) + 32;
                const ehTotal = 38 + blocks.reduce((s, b) => s + b.dim.h, 0) + Math.max(0, blocks.length - 1) * 12 + 14;
                const eBox = { x: exX, y: exY, w: ew, h: ehTotal, cx: exX + Math.round(ew / 2), name: eh.name };
                fileBoxMap.set(eh.name, eBox);
                this.elements.push(this.drawRect(eBox.x, eBox.y, eBox.w, eBox.h, { strokeWidth: 1.6 }));
                this.elements.push(this.drawText(eBox.x + 12, eBox.y + 18, eh.name, { anchor: 'start', size: 13, weight: '700' }));

                let by = eBox.y + 32;
                for (const b of blocks) {
                    const box = { x: eBox.x + 16, y: by, w: ew - 32, h: b.dim.h, cx: eBox.cx, cy: by + Math.round(b.dim.h / 2) };
                    this.drawBoxWithContent(box, b.titleLines, b.subLines, { isNode: false, strokeWidth: 1.4 });
                    by += b.dim.h + 12;
                }
                exY += ehTotal + 24;
                maxExtraBottom = Math.max(maxExtraBottom, exY);
            }
        }

        // Route #include links from top files down to module headers
        for (const ts of topSpecs) {
            const fromBox = fileBoxMap.get(ts.file.name);
            const targets = this.includes
                .filter(inc => inc.fromFile === ts.file.name && fileBoxMap.has(inc.toFile))
                .map(inc => ({ rawTarget: inc.rawTarget || inc.toFile, box: fileBoxMap.get(inc.toFile) }));

            if (targets.length > 0 && fromBox) {
                const stemX = fromBox.cx;
                const stemY = fromBox.y + fromBox.h - 4;
                const busY = fromBox.y + fromBox.h + 34;
                const xs = [stemX, ...targets.map(t => t.box.cx)];
                const minBusX = Math.min(...xs);
                const maxBusX = Math.max(...xs);

                this.drawConnector([[stemX, stemY], [stemX, busY]], {
                    stroke: '#0f172a', strokeWidth: 1.4, markerStart: 'dot-black'
                });
                if (maxBusX > minBusX) {
                    this.drawConnector([[minBusX, busY], [maxBusX, busY]], {
                        stroke: '#0f172a', strokeWidth: 1.4
                    });
                }
                for (const t of targets) {
                    this.drawConnector([[t.box.cx, busY], [t.box.cx, t.box.y]], {
                        stroke: '#0f172a', strokeWidth: 1.4, markerEnd: 'arrow-black'
                    });
                }
                const incLabel = `#include ${targets.map(t => `"${t.rawTarget}"`).join(', ')}`;
                this.elements.push(this.drawText(stemX + 12, busY - 10, incLabel, {
                    anchor: 'start', size: 10.5, weight: '500', color: '#0f172a', family: MONO_FONT_STACK
                }));
            }
        }

        // Route internal & adjacent-module #include links cleanly inside middle corridor
        const sourceTopPorts = new Map(); // fileName -> list of edges
        const headerBottomPorts = new Map();
        midIncludeEdges.forEach(e => {
            if (!sourceTopPorts.has(e.fromFile)) sourceTopPorts.set(e.fromFile, []);
            sourceTopPorts.get(e.fromFile).push(e);
            if (!headerBottomPorts.has(e.toFile)) headerBottomPorts.set(e.toFile, []);
            headerBottomPorts.get(e.toFile).push(e);
        });

        // Account for skip-edges that also enter header bottoms from inter-module gap
        skipIncludeEdges.forEach(e => {
            if (!headerBottomPorts.has(e.toFile)) headerBottomPorts.set(e.toFile, []);
            headerBottomPorts.get(e.toFile).push(e);
        });

        const getPortX = (box, edgesOnEdge, edge, sortKey, fallbackBias = 0.5) => {
            const safeMinX = box.x + Math.max(96, box.name.length * 8.2 + 24);
            const safeMaxX = box.x + box.w - 18;
            if (!edgesOnEdge || edgesOnEdge.length <= 1) {
                return Math.round(safeMinX + (safeMaxX - safeMinX) * fallbackBias);
            }
            const sorted = [...edgesOnEdge].sort((a, b) => sortKey(a) - sortKey(b));
            const idx = sorted.indexOf(edge);
            const span = Math.max(24, safeMaxX - safeMinX);
            const step = span / (sorted.length - 1);
            return Math.round(safeMinX + idx * step);
        };

        // Pre-compute straight X for same-module (.cpp -> .h) links so they never zigzag
        const sameModuleAlignedX = new Map();
        for (const e of midIncludeEdges) {
            if (e.fi !== e.ti) continue;
            const sBox = fileBoxMap.get(e.fromFile);
            const hBox = fileBoxMap.get(e.toFile);
            if (!sBox || !hBox) continue;
            const hIncoming = headerBottomPorts.get(e.toFile) || [e];
            const sOutgoing = sourceTopPorts.get(e.fromFile) || [e];
            const hasLeftIncoming = hIncoming.some(x => x.fi < e.ti);
            const hasRightOutgoing = sOutgoing.some(x => x.ti > e.fi);
            const safeMinX = hBox.x + Math.max(96, hBox.name.length * 8.2 + 24);
            const safeMaxX = hBox.x + hBox.w - 18;
            let aligned;
            if (hasLeftIncoming && !hasRightOutgoing) {
                aligned = safeMaxX;
            } else if (!hasLeftIncoming && hasRightOutgoing) {
                aligned = Math.round(safeMinX + (safeMaxX - safeMinX) * 0.28);
            } else if (hasLeftIncoming && hasRightOutgoing) {
                aligned = Math.round(safeMinX + (safeMaxX - safeMinX) * 0.55);
            } else {
                aligned = Math.round(Math.max(safeMinX, hBox.cx));
            }
            sameModuleAlignedX.set(e, aligned);
        }

        // Order cross-module edges from closest-gap first so higher lanes take left-most entry ports
        // and lower lanes pass cleanly underneath to inner entry ports (zero crossings!)
        const crossMidEdges = midIncludeEdges
            .filter(e => e.fi !== e.ti)
            .sort((a, b) => Math.abs(a.fi - a.ti) - Math.abs(b.fi - b.ti) || b.fi - a.fi);

        // Assign laneY & entryX cleanly per header box
        const assignedHeaderX = new Map();
        for (const e of midIncludeEdges) {
            if (e.fi === e.ti) {
                const sBox = fileBoxMap.get(e.fromFile);
                const hBox = fileBoxMap.get(e.toFile);
                if (!sBox || !hBox) continue;
                const alignedX = sameModuleAlignedX.get(e) ?? hBox.cx;
                this.drawConnector([[alignedX, sBox.y + 6], [alignedX, hBox.y + hBox.h]], {
                    stroke: '#0f172a', strokeWidth: 1.4, markerStart: 'dot-black', markerEnd: 'arrow-black'
                });
            }
        }

        const allocHeaderEntryX = (hBox, fromIdx, sameModEdge) => {
            const safeMinX = hBox.x + Math.max(92, hBox.name.length * 8.2 + 20);
            const selfX = sameModEdge ? sameModuleAlignedX.get(sameModEdge) : null;
            const maxAllowed = selfX && fromIdx < sameModEdge.ti ? selfX - 28 : (hBox.x + hBox.w - 18);
            const used = assignedHeaderX.get(hBox.name) || [];
            let cand = safeMinX;
            while (used.some(u => Math.abs(u - cand) < 26) && cand + 26 <= maxAllowed) {
                cand += 34;
            }
            if (cand > maxAllowed) cand = Math.max(safeMinX, maxAllowed);
            used.push(cand);
            assignedHeaderX.set(hBox.name, used);
            return Math.round(cand);
        };

        let midLaneIdx = 0;
        for (const e of crossMidEdges) {
            const sBox = fileBoxMap.get(e.fromFile);
            const hBox = fileBoxMap.get(e.toFile);
            if (!sBox || !hBox) continue;

            const sSelf = (sourceTopPorts.get(e.fromFile) || []).find(x => x.fi === x.ti);
            const hSelf = (headerBottomPorts.get(e.toFile) || []).find(x => x.fi === x.ti);
            const sSelfX = sSelf ? sameModuleAlignedX.get(sSelf) : null;

            let startX = sSelfX !== null
                ? (e.ti > e.fi ? Math.min(sBox.x + sBox.w - 18, sSelfX + 48) : Math.max(sBox.x + 92, sSelfX - 48))
                : getPortX(sBox, sourceTopPorts.get(e.fromFile), e, item => item.ti, 0.5);
            const endX = allocHeaderEntryX(hBox, e.fi, hSelf);

            const laneY = hBox.y + hBox.h + 26 + midLaneIdx * 20;
            midLaneIdx++;
            this.drawConnector([
                [startX, sBox.y + 6],
                [startX, laneY],
                [endX, laneY],
                [endX, hBox.y + hBox.h]
            ], {
                stroke: '#0f172a', strokeWidth: 1.4, markerStart: 'dot-black', markerEnd: 'arrow-black'
            });
        }

        // Route skip-module #include links underneath module dashed boxes, up through clean gap
        let bottomCorridorMaxY = maxExtraBottom;
        skipIncludeEdges.forEach((e, idx) => {
            const sBox = fileBoxMap.get(e.fromFile);
            const hBox = fileBoxMap.get(e.toFile);
            if (!sBox || !hBox) return;

            const bottomY = modY + modH + 24 + idx * 18;
            bottomCorridorMaxY = Math.max(bottomCorridorMaxY, bottomY);

            const exitX = sBox.cx;
            const hSelf = (headerBottomPorts.get(e.toFile) || []).find(x => x.fi === x.ti);
            const endX = allocHeaderEntryX(hBox, e.fi, hSelf);

            // Pick gap just adjacent to target module
            const gapModuleLeft = e.ti > e.fi ? modBoxes[e.ti - 1] : modBoxes[e.ti];
            const gapModuleRight = e.ti > e.fi ? modBoxes[e.ti] : modBoxes[e.ti + 1];
            const gapX = gapModuleLeft && gapModuleRight
                ? Math.round((gapModuleLeft.x + gapModuleLeft.w + gapModuleRight.x) / 2) + idx * 10
                : (hBox.x - 24);
            const upperLaneY = hBox.y + hBox.h + 26 + midLaneIdx * 20;
            midLaneIdx++;

            this.drawConnector([
                [exitX, sBox.y + sBox.h - 6],
                [exitX, bottomY],
                [gapX, bottomY],
                [gapX, upperLaneY],
                [endX, upperLaneY],
                [endX, hBox.y + hBox.h]
            ], {
                stroke: '#0f172a', strokeWidth: 1.4, markerStart: 'dot-black', markerEnd: 'arrow-black'
            });
        });

        // Route blue function calls (#1d4ed8)
        let outerLeftLane = 0;
        let outerRightLane = 0;
        const drawnCalls = new Set();

        for (const e of this.callGraph) {
            const fromKey = `${e.fromFile || ''}::${e.fromQualified || e.from}`;
            const toKey = `${e.toFile || ''}::${e.toQualified || e.to}`;
            const fromBox = fnBoxMap.get(fromKey) || fnBoxMap.get(e.fromQualified) || fnBoxMap.get(e.from);
            const toBox = fnBoxMap.get(toKey) || fnBoxMap.get(e.toQualified) || fnBoxMap.get(e.to);

            if (!fromBox) continue;
            if (e.isRecursive || fromKey === toKey || (e.from === e.to && e.fromFile === e.toFile)) {
                this.drawRecursionLoop(fromBox, 'right');
                continue;
            }
            if (!toBox) continue;

            const callPairKey = `${fromBox.x},${fromBox.y}->${toBox.x},${toBox.y}`;
            if (drawnCalls.has(callPairKey)) continue;
            drawnCalls.add(callPairKey);

            const callLabel = `виклик ${e.to}()`;
            const fromModIdx = modIndexByFile.get(e.fromFile);
            const toModIdx = modIndexByFile.get(e.toFile);

            if (fromModIdx === undefined && toModIdx !== undefined) {
                // Call from top main file down to module function
                if (toModIdx === 0) {
                    const outerX = modBoxes[0].x - 30 - outerLeftLane * 16;
                    outerLeftLane++;
                    this.drawConnector([
                        [fromBox.x, fromBox.cy],
                        [outerX, fromBox.cy],
                        [outerX, toBox.cy],
                        [toBox.x, toBox.cy]
                    ], { stroke: '#1d4ed8', strokeWidth: 1.5, markerEnd: 'arrow-blue' });
                    this.elements.push(this.drawText(Math.round((outerX + fromBox.x) / 2), fromBox.cy - 10, callLabel, {
                        anchor: 'middle', size: 10.5, weight: '600', color: '#1d4ed8', family: FONT_STACK
                    }));
                } else if (toModIdx === modBoxes.length - 1) {
                    const lastMod = modBoxes[modBoxes.length - 1];
                    const outerX = lastMod.x + lastMod.w + 30 + outerRightLane * 16;
                    outerRightLane++;
                    this.drawConnector([
                        [fromBox.x + fromBox.w, fromBox.cy],
                        [outerX, fromBox.cy],
                        [outerX, toBox.cy],
                        [toBox.x + toBox.w, toBox.cy]
                    ], { stroke: '#1d4ed8', strokeWidth: 1.5, markerEnd: 'arrow-blue' });
                    this.elements.push(this.drawText(Math.round((outerX + fromBox.x + fromBox.w) / 2), fromBox.cy - 10, callLabel, {
                        anchor: 'middle', size: 10.5, weight: '600', color: '#1d4ed8', family: FONT_STACK
                    }));
                } else {
                    const leftMod = modBoxes[toModIdx - 1];
                    const rightMod = modBoxes[toModIdx];
                    const gapX = Math.round((leftMod.x + leftMod.w + rightMod.x) / 2);
                    const topLaneY = fileBoxMap.get(e.fromFile).y + fileBoxMap.get(e.fromFile).h + 14;
                    this.drawConnector([
                        [fromBox.cx, fromBox.y + fromBox.h],
                        [fromBox.cx, topLaneY],
                        [gapX, topLaneY],
                        [gapX, toBox.cy],
                        [toBox.x, toBox.cy]
                    ], { stroke: '#1d4ed8', strokeWidth: 1.5, markerEnd: 'arrow-blue' });
                }
            } else if (fromModIdx !== undefined && toModIdx !== undefined && Math.abs(fromModIdx - toModIdx) === 1 && Math.abs(fromBox.cy - toBox.cy) <= 10) {
                // Direct horizontal arrow across adjacent module gap
                const goRight = fromBox.x < toBox.x;
                const x1 = goRight ? fromBox.x + fromBox.w : fromBox.x;
                const x2 = goRight ? toBox.x : toBox.x + toBox.w;
                const y = toBox.cy;
                this.drawConnector([[x1, y], [x2, y]], { stroke: '#1d4ed8', strokeWidth: 1.5, markerEnd: 'arrow-blue' });
                this.elements.push(this.drawText(Math.round((x1 + x2) / 2), y - 10, callLabel, {
                    anchor: 'middle', size: 10.5, weight: '600', color: '#1d4ed8', family: FONT_STACK
                }));
            } else if (fromBox.x === toBox.x && fromBox.y < toBox.y) {
                this.drawConnector([[fromBox.cx, fromBox.y + fromBox.h], [toBox.cx, toBox.y]], {
                    stroke: '#1d4ed8', strokeWidth: 1.5, markerEnd: 'arrow-blue'
                });
            } else {
                // Fallback clean right/bottom routing
                const laneY = Math.max(fromBox.y + fromBox.h, toBox.y + toBox.h) + 18;
                this.drawConnector([
                    [fromBox.cx, fromBox.y + fromBox.h],
                    [fromBox.cx, laneY],
                    [toBox.cx, laneY],
                    [toBox.cx, toBox.y + toBox.h]
                ], { stroke: '#1d4ed8', strokeWidth: 1.5, markerEnd: 'arrow-blue' });
            }
        }

        // Bottom-right Legend
        const legendY = Math.max(modY + modH + 18, bottomCorridorMaxY + 14);
        const rightEdge = Math.max(...modBoxes.map(b => b.x + b.w), ...Array.from(fileBoxMap.values()).map(b => b.x + b.w));
        this.drawLegend(rightEdge, legendY);

        return this.finalizeSvg(44, 32);
    }

    renderStandaloneMultiFileLayout() {
        const sourceFiles = this.files.filter(f => !f.isHeader);
        const headerFiles = this.files.filter(f => f.isHeader);

        // Fallback if files array didn't classify headers
        const primaryCpp = sourceFiles[0] || this.files[0];
        const primaryFuncs = (primaryCpp?.functions || this.rawFunctions).filter(f => !f.isDeclaration);

        // Determine internal call hierarchy of primary .cpp to decide side-by-side vs top-bottom
        const fnList = primaryFuncs.length > 0 ? primaryFuncs : this.rawFunctions.filter(f => !f.isDeclaration);
        const hierarchy = fnList.length > 0
            ? this.buildSingleFileHierarchy(fnList, this.callGraph.filter(e => !e.fromFile || e.fromFile === primaryCpp?.name), primaryCpp)
            : { positions: new Map(), tierBoxes: [], uniqueEdges: [], depth: new Map(), orderIndex: new Map() };

        const maxTierWidthCount = Math.max(0, ...hierarchy.tierBoxes.map(tb => tb.length));
        const useTopBottom = headerFiles.length === 0 || sourceFiles.length > 1 || maxTierWidthCount >= 3 || headerFiles.length > 1;

        const fnBoxMap = new Map();
        const macroGroupBoxes = [];
        const fileBoxMap = new Map();

        if (!useTopBottom && headerFiles.length === 1 && primaryCpp) {
            // Side-by-side GOST layout (like Lab_09_2_1: Lab_09_2_1.cpp on LEFT, macros.h on RIGHT)
            const hFile = headerFiles[0];
            const hBlocks = this.buildHeaderBlocks(hFile, 'vertical').map(b => ({
                ...b,
                dim: this.measureBox(b.titleLines, b.subLines, { minW: 300, minH: 64, padX: 34, padY: 12 })
            }));

            // Measure .cpp functions stacked cleanly via hierarchy
            const cppContentBoxes = Array.from(hierarchy.positions.values());
            const minCppX = cppContentBoxes.length ? Math.min(...cppContentBoxes.map(b => b.x)) : 0;
            const maxCppX = cppContentBoxes.length ? Math.max(...cppContentBoxes.map(b => b.x + b.w)) : 280;
            const minCppY = cppContentBoxes.length ? Math.min(...cppContentBoxes.map(b => b.y)) : 40;
            const maxCppY = cppContentBoxes.length ? Math.max(...cppContentBoxes.map(b => b.y + b.h)) : 180;

            const cppInnerW = Math.max(290, maxCppX - minCppX);
            const cppFileW = cppInnerW + 72;
            const hInnerW = Math.max(300, ...hBlocks.map(b => b.dim.w));
            const hFileW = hInnerW + 52;

            const hInnerTotalH = hBlocks.reduce((s, b) => s + b.dim.h, 0) + Math.max(0, hBlocks.length - 1) * 28;
            const cppInnerTotalH = maxCppY - minCppY;
            const unifiedFileH = Math.max(220, 58 + Math.max(cppInnerTotalH, hInnerTotalH) + 22);

            const cppFileBox = { x: 40, y: 26, w: cppFileW, h: unifiedFileH, name: primaryCpp.name };
            const gapBetweenFiles = 120;
            const hFileBox = { x: cppFileBox.x + cppFileW + gapBetweenFiles, y: 26, w: hFileW, h: unifiedFileH, name: hFile.name };
            fileBoxMap.set(primaryCpp.name, cppFileBox);
            fileBoxMap.set(hFile.name, hFileBox);

            this.elements.push(this.drawRect(cppFileBox.x, cppFileBox.y, cppFileBox.w, cppFileBox.h, { strokeWidth: 1.6 }));
            this.elements.push(this.drawText(cppFileBox.x + 14, cppFileBox.y + 20, primaryCpp.name, { anchor: 'start', size: 13, weight: '700' }));

            this.elements.push(this.drawRect(hFileBox.x, hFileBox.y, hFileBox.w, hFileBox.h, { strokeWidth: 1.6 }));
            this.elements.push(this.drawText(hFileBox.x + 14, hFileBox.y + 20, hFile.name, { anchor: 'start', size: 13, weight: '700' }));

            // Render .cpp functions inside cppFileBox
            const shiftX = cppFileBox.x + 36 + Math.round((cppInnerW - (maxCppX - minCppX)) / 2) - minCppX;
            const shiftY = cppFileBox.y + 56 - minCppY;
            const renderedCppPos = this.renderSingleFileLayout(
                fnList,
                this.callGraph.filter(e => !e.fromFile || e.fromFile === primaryCpp.name),
                shiftX,
                shiftY,
                { fileObj: primaryCpp, callColor: '#1d4ed8', callMarker: 'arrow-blue', callWidth: 1.5 }
            );
            for (const box of renderedCppPos.values()) {
                fnBoxMap.set(box.fn.name, box);
                fnBoxMap.set(box.fn.qualifiedName || box.fn.name, box);
            }

            // Render header macro/decl blocks aligned inside hFileBox
            let hy = hFileBox.y + 56;
            for (const b of hBlocks) {
                const bx = hFileBox.x + 26;
                const box = { x: bx, y: hy, w: hInnerW, h: b.dim.h, cx: bx + Math.round(hInnerW / 2), cy: hy + Math.round(b.dim.h / 2) };
                this.drawBoxWithContent(box, b.titleLines, b.subLines, { isNode: false, strokeWidth: 1.4 });
                macroGroupBoxes.push({ ...b, box });
                hy += b.dim.h + 28;
            }

            // #include horizontal arrow at top between files
            this.drawConnector([[cppFileBox.x + cppFileBox.w - 6, cppFileBox.y + 20], [hFileBox.x, cppFileBox.y + 20]], {
                stroke: '#0f172a', strokeWidth: 1.4, markerStart: 'dot-black', markerEnd: 'arrow-black'
            });
            this.elements.push(this.drawText(Math.round((cppFileBox.x + cppFileBox.w + hFileBox.x) / 2), cppFileBox.y + 11, '#include', {
                anchor: 'middle', size: 10.5, weight: '500', color: '#0f172a', family: MONO_FONT_STACK
            }));

            // Macro usage horizontal blue arrows
            const drawnMacroArrows = new Set();
            const labeledTargetYs = new Set();
            let bentLaneIdx = 0;
            const fileGapLeft = cppFileBox.x + cppFileBox.w;
            const fileGapRight = hFileBox.x;

            for (const mg of macroGroupBoxes) {
                const callers = mg.callerKeys || [];
                const callerBoxes = callers.map(c => fnBoxMap.get(c)).filter(Boolean);
                const uniqueCallers = Array.from(new Set(callerBoxes)).sort((a, b) => a.cy - b.cy);
                if (uniqueCallers.length === 0 && renderedCppPos.size > 0) {
                    uniqueCallers.push(Array.from(renderedCppPos.values())[0]);
                }

                // Count callers that must bend to reach this macro group
                const bendingCallers = uniqueCallers.filter(cBox => !(Math.abs(cBox.cy - mg.box.cy) <= 40 && mg.box.cy >= cBox.y && mg.box.cy <= cBox.y + cBox.h));
                let bendOffsetIdx = 0;

                for (const cBox of uniqueCallers) {
                    const key = `${cBox.y}->${mg.box.y}`;
                    if (drawnMacroArrows.has(key)) continue;
                    drawnMacroArrows.add(key);

                    const straightY = Math.abs(cBox.cy - mg.box.cy) <= 40 ? cBox.cy : mg.box.cy;
                    const x1 = cBox.x + cBox.w;
                    const x2 = mg.box.x;
                    const isStraight = straightY >= cBox.y && straightY <= cBox.y + cBox.h;

                    let targetY = mg.box.cy;
                    let labelCenterX = Math.round((fileGapLeft + fileGapRight) / 2);

                    if (isStraight) {
                        targetY = straightY;
                        this.drawConnector([[x1, targetY], [x2, targetY]], {
                            stroke: '#1d4ed8', strokeWidth: 1.5, markerEnd: 'arrow-blue'
                        });
                    } else {
                        const laneX = fileGapLeft + 22 + (bendingCallers.length > 1 ? (cBox.cy < mg.box.cy ? 0 : 14) : bentLaneIdx * 12);
                        bentLaneIdx++;
                        if (bendingCallers.length > 1) {
                            targetY = Math.round(mg.box.cy + (bendOffsetIdx - (bendingCallers.length - 1) / 2) * 14);
                            bendOffsetIdx++;
                        }
                        const startY = cBox.cy + (cBox.cy < mg.box.cy ? 8 : -8);
                        this.drawConnector([[x1, startY], [laneX, startY], [laneX, targetY], [x2, targetY]], {
                            stroke: '#1d4ed8', strokeWidth: 1.5, markerEnd: 'arrow-blue'
                        });
                        labelCenterX = Math.round((fileGapLeft + 36 + fileGapRight) / 2);
                    }

                    // Emit label at most once per macro group, centered on the clear horizontal segment
                    const labelGroupKey = mg.id;
                    if (!labeledTargetYs.has(labelGroupKey)) {
                        labeledTargetYs.add(labelGroupKey);
                        const usedByThis = this.macroUsages
                            .filter(u => u.fromFunction === cBox.fn.name && mg.macroNames?.includes(u.macroName))
                            .map(u => u.macroName);
                        const lbl = (uniqueCallers.length === 1 && usedByThis.length === 1) ? `${usedByThis[0]}()` : 'макроси';
                        const labelY = isStraight ? targetY - 10 : Math.min(targetY, mg.box.cy) - 12;
                        this.elements.push(this.drawText(labelCenterX, labelY, lbl, {
                            anchor: 'middle', size: 10.5, weight: '600', color: '#1d4ed8', family: FONT_STACK
                        }));
                    }
                }
            }

            this.drawLegend(hFileBox.x + hFileBox.w, unifiedFileH + 40);
            return this.finalizeSvg(44, 32);
        }

        // Top-Bottom Multi-File Layout (e.g., Lab_09_2_2: Lab_09_2_2.cpp on TOP, triangle_macros.h on BOTTOM)
        let curY = 24;
        const renderedSourceBoxes = [];
        for (const sf of sourceFiles) {
            const sFuncs = (sf.functions || []).filter(f => !f.isDeclaration);
            if (sFuncs.length > 0) {
                const sHier = this.buildSingleFileHierarchy(sFuncs, this.callGraph.filter(e => !e.fromFile || e.fromFile === sf.name), sf);
                const sBoxes = Array.from(sHier.positions.values());
                const minX = Math.min(...sBoxes.map(b => b.x));
                const maxX = Math.max(...sBoxes.map(b => b.x + b.w));
                const minY = Math.min(...sBoxes.map(b => b.y));
                const maxY = Math.max(...sBoxes.map(b => b.y + b.h));

                const fileW = Math.max(360, maxX - minX + 52);
                const fileH = 54 + (maxY - minY) + 26;
                const fBox = { x: 44, y: curY, w: fileW, h: fileH, name: sf.name, tierBoxes: sHier.tierBoxes };
                fileBoxMap.set(sf.name, fBox);

                this.elements.push(this.drawRect(fBox.x, fBox.y, fBox.w, fBox.h, { strokeWidth: 1.6 }));
                this.elements.push(this.drawText(fBox.x + 14, fBox.y + 20, sf.name, { anchor: 'start', size: 13, weight: '700' }));

                const shiftX = fBox.x + 26 - minX;
                const shiftY = fBox.y + 52 - minY;
                const posMap = this.renderSingleFileLayout(
                    sFuncs,
                    this.callGraph.filter(e => !e.fromFile || e.fromFile === sf.name),
                    shiftX,
                    shiftY,
                    { fileObj: sf, callColor: '#1d4ed8', callMarker: 'arrow-blue', callWidth: 1.5 }
                );
                for (const box of posMap.values()) {
                    fnBoxMap.set(`${sf.name}::${box.fn.name}`, box);
                    fnBoxMap.set(box.fn.name, box);
                }
                renderedSourceBoxes.push({ file: sf, box: fBox, posMap, tierBoxes: sHier.tierBoxes });
                curY += fileH + 64;
            } else {
                const blocks = this.buildSourceBlocks(sf).map(b => ({
                    ...b,
                    dim: this.measureBox(b.titleLines, b.subLines, { minW: 240, minH: 54, padX: 30, padY: 12 })
                }));
                const fileW = Math.max(360, ...blocks.map(b => b.dim.w)) + 52;
                const fileH = 44 + blocks.reduce((s, b) => s + b.dim.h, 0) + 20;
                const fBox = { x: 44, y: curY, w: fileW, h: fileH, name: sf.name };
                fileBoxMap.set(sf.name, fBox);
                this.elements.push(this.drawRect(fBox.x, fBox.y, fBox.w, fBox.h, { strokeWidth: 1.6 }));
                this.elements.push(this.drawText(fBox.x + 14, fBox.y + 20, sf.name, { anchor: 'start', size: 13, weight: '700' }));
                let by = fBox.y + 38;
                for (const b of blocks) {
                    const box = { x: fBox.x + 26, y: by, w: fileW - 52, h: b.dim.h, cx: fBox.x + fileW / 2, cy: by + b.dim.h / 2 };
                    this.drawBoxWithContent(box, b.titleLines, b.subLines, { isNode: false, strokeWidth: 1.4 });
                    by += b.dim.h + 12;
                }
                curY += fileH + 64;
            }
        }

        // Place header files horizontally below source files
        const primaryRendered = renderedSourceBoxes[0];
        const allSourceSubBoxes = primaryRendered
            ? Array.from(primaryRendered.posMap.values()).filter(b => !b.fn.isMain).sort((a, b) => a.cx - b.cx)
            : [];
        const callerOrder = allSourceSubBoxes.map(b => b.fn.name);

        for (const hf of headerFiles) {
            const hBlocks = hf.macros?.length > 0
                ? this.buildMacroGroupBlocks(hf, 'horizontal', callerOrder)
                : this.buildHeaderBlocks(hf);
            const measured = hBlocks.map(b => ({
                ...b,
                dim: this.measureBox(b.titleLines, b.subLines, { minW: 175, minH: 64, padX: 26, padY: 10 })
            }));

            const gapX = 24;
            const totalBlocksW = measured.reduce((s, b) => s + b.dim.w, 0) + Math.max(0, measured.length - 1) * gapX;
            const minHeaderW = primaryRendered ? primaryRendered.box.w : 400;
            const headerW = Math.max(minHeaderW, totalBlocksW + 44);
            const maxBlockH = Math.max(66, ...measured.map(b => b.dim.h));
            const headerH = 44 + maxBlockH + 20;

            const hBox = { x: 44, y: curY, w: headerW, h: headerH, name: hf.name };
            fileBoxMap.set(hf.name, hBox);
            this.elements.push(this.drawRect(hBox.x, hBox.y, hBox.w, hBox.h, { strokeWidth: 1.6 }));
            this.elements.push(this.drawText(hBox.x + 14, hBox.y + 20, hf.name, { anchor: 'start', size: 13, weight: '700' }));

            // Align each macro block underneath its primary caller when widths permit
            let curBx = hBox.x + Math.round((headerW - totalBlocksW) / 2);
            const blockY = hBox.y + 38;
            for (const b of measured) {
                const callerName = b.callerKeys?.[0];
                const callerBox = callerName ? fnBoxMap.get(callerName) : null;
                const alignedW = callerBox ? Math.max(b.dim.w, callerBox.w) : b.dim.w;
                let bx = curBx;
                if (callerBox && callerBox.x >= curBx - 12 && measured.length === callerOrder.length) {
                    bx = callerBox.x;
                }
                const box = {
                    x: bx,
                    y: blockY,
                    w: Math.min(alignedW, b.dim.w + 40),
                    h: maxBlockH,
                    cx: bx + Math.round(Math.min(alignedW, b.dim.w + 40) / 2),
                    cy: blockY + Math.round(maxBlockH / 2)
                };
                // Keep within hBox bounds
                if (box.x + box.w > hBox.x + hBox.w - 16) {
                    box.x = curBx;
                    box.w = b.dim.w;
                    box.cx = box.x + Math.round(box.w / 2);
                }
                this.drawBoxWithContent(box, b.titleLines, b.subLines, { isNode: false, strokeWidth: 1.4 });
                macroGroupBoxes.push({ ...b, box });
                curBx = Math.max(curBx + b.dim.w + gapX, box.x + box.w + gapX);
            }
            curY += headerH + 34;
        }

        // #include links along outer left border
        this.includes.forEach((inc, idx) => {
            const fromBox = fileBoxMap.get(inc.fromFile);
            const toBox = fileBoxMap.get(inc.toFile);
            if (!fromBox || !toBox) return;
            const leftX = Math.min(fromBox.x, toBox.x) - 24 - idx * 14;
            const startY = fromBox.y + fromBox.h - 14;
            const endY = toBox.y + 18;
            this.drawConnector([
                [fromBox.x + 6, startY],
                [leftX, startY],
                [leftX, endY],
                [toBox.x, endY]
            ], { stroke: '#0f172a', strokeWidth: 1.4, markerStart: 'dot-black', markerEnd: 'arrow-black' });
        });

        // Vertical blue macro usage arrows from functions down to macro groups
        for (const mg of macroGroupBoxes) {
            const primaryCaller = mg.callerKeys?.[0];
            const cBox = primaryCaller ? fnBoxMap.get(primaryCaller) : null;
            if (cBox) {
                const alignedX = (mg.box.x <= cBox.cx && cBox.cx <= mg.box.x + mg.box.w) ? cBox.cx : mg.box.cx;
                if (Math.abs(cBox.cx - alignedX) <= 8) {
                    this.drawConnector([[cBox.cx, cBox.y + cBox.h], [cBox.cx, mg.box.y]], {
                        stroke: '#1d4ed8', strokeWidth: 1.5, markerEnd: 'arrow-blue'
                    });
                } else {
                    const midY = Math.round((cBox.y + cBox.h + mg.box.y) / 2);
                    this.drawConnector([
                        [cBox.cx, cBox.y + cBox.h],
                        [cBox.cx, midY],
                        [mg.box.cx, midY],
                        [mg.box.cx, mg.box.y]
                    ], { stroke: '#1d4ed8', strokeWidth: 1.5, markerEnd: 'arrow-blue' });
                }
            }
        }

        const rightEdge = Math.max(...Array.from(fileBoxMap.values()).map(b => b.x + b.w));
        this.drawLegend(rightEdge, curY - 12);
        return this.finalizeSvg(44, 32);
    }

    // -------------------------------------------------------------------------
    // SVG Assembly
    // -------------------------------------------------------------------------

    renderEmpty() {
        const vb = { x: 0, y: 0, width: 420, height: 180 };
        const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.width} ${vb.height}" width="${vb.width}" height="${vb.height}">
    ${SVG.createDefs()}
    ${SVG.bgRect(vb)}
    <g id="structure-chart-layer">
        <text x="210" y="90" text-anchor="middle" dominant-baseline="central" fill="#64748b" font-family="${FONT_STACK}" font-size="13.5">Немає виявлених функцій</text>
    </g>
</svg>`.trim();
        return { svg, width: vb.width, height: vb.height };
    }

    finalizeSvg(padX = 48, padY = 36) {
        const box = this.bounds.getViewBox(padX, padY);
        const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" width="${box.width}" height="${box.height}">
    ${SVG.createDefs()}
    ${SVG.bgRect(box)}
    <g id="structure-chart-layer">
        ${this.elements.join('\n')}
    </g>
</svg>`.trim();

        return {
            svg: svgContent,
            width: box.width,
            height: box.height
        };
    }

    render() {
        this.elements = [];
        this.bounds = new BoundingBox();

        if (this.isMultiFile && this.files.length > 0) {
            return this.renderMultiFile();
        }
        return this.renderSingleFile();
    }
}

export default StructureChartRenderer;
