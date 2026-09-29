/**
 * UML Activity Diagram Generator (UML 2.x Діаграма діяльності)
 * Replicates the exact format and layout from Ukrainian university lectures (Slide 7 right side).
 */

import { SVG, BoundingBox } from '../utils/svgHelpers.js';
import { toMathExpression, parseFraction } from '../utils/mathFormatter.js';

class UmlRenderer {
    constructor(ast, options = {}) {
        this.ast = ast;
        this.options = Object.assign({
            expressionStyle: 'original', // 'original' (реальний код) or 'lecture' (вираз_1)
            expressionMode: 'cpp',       // 'cpp' (C++ код) or 'math' (математичні формули)
            showDeclarations: false,
            centerX: 340,
            startY: 45,
            nodeGap: 28,
            diamondSize: 20
        }, options);

        this.elements = [];
        this.bounds = new BoundingBox();
        this.currentY = this.options.startY;
        this.centerX = this.options.centerX;
    }

    // Helper wrappers that push SVG strings AND track bounds
    addInitialNode(cx, cy, r) {
        this.bounds.addCircle(cx, cy, r);
        this.elements.push(SVG.umlInitialNode(cx, cy, r));
    }

    addFinalNode(cx, cy, r) {
        this.bounds.addCircle(cx, cy, r);
        this.elements.push(SVG.umlFinalNode(cx, cy, r));
    }

    addAction(cx, cy, w, h, text, opts = {}) {
        this.bounds.addRect(cx - w / 2, cy - h / 2, w, h);
        this.elements.push(SVG.umlAction(cx, cy, w, h, text, opts));
    }

    addFractionAction(cx, cy, w, h, target, numText, denText, opts = {}) {
        this.bounds.addRect(cx - w / 2, cy - h / 2, w, h);
        this.elements.push(SVG.fractionRectangle(cx, cy, w, h, target, numText, denText, { ...opts, isUml: true }));
    }

    addDiamond(cx, cy, size) {
        const hs = size / 2;
        this.bounds.addRect(cx - hs, cy - hs, size, size);
        this.elements.push(SVG.umlDiamond(cx, cy, size));
    }

    addLine(x1, y1, x2, y2, hasArrow = true, markerType = 'arrow-uml') {
        this.bounds.addPoint(x1, y1);
        this.bounds.addPoint(x2, y2);
        this.elements.push(SVG.line(x1, y1, x2, y2, hasArrow, markerType));
    }

    addPolyline(points, hasArrow = true, markerType = 'arrow-uml') {
        points.forEach(([px, py]) => this.bounds.addPoint(px, py));
        this.elements.push(SVG.polyline(points, hasArrow, markerType));
    }

    addLabel(x, y, text, opts = {}) {
        this.bounds.addText(x, y, text, opts);
        this.elements.push(SVG.label(x, y, text, opts));
    }

    render() {
        this.elements = [];
        this.bounds = new BoundingBox();
        this.currentY = this.options.startY;

        // Initial node (solid circle)
        this.renderInitialNode();

        // Process statements
        for (let i = 0; i < this.ast.length; i++) {
            const stmt = this.ast[i];
            if (stmt.type === 'return' && stmt.isMainZero && i === this.ast.length - 1) {
                continue;
            }
            this.renderStatement(stmt);
        }

        // Final node (bullseye)
        this.renderFinalNode();

        // Dynamic and robust viewBox based on actual content
        const vb = this.bounds.getViewBox(55, 45);

        const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.width} ${vb.height}" width="${vb.width}" height="${vb.height}">
            ${SVG.createDefs()}
            <g id="uml-layer">
                ${this.elements.join('\n')}
            </g>
        </svg>
        `;

        return {
            svg: svgContent,
            width: vb.width,
            height: vb.height
        };
    }

    renderInitialNode() {
        if (this.ast.functionName && this.ast.functionName !== 'main') {
            const signature = this.ast.functionSignature || this.ast.functionName;
            const { lines, w, h } = this.calcActionDimensions(signature, false);
            const cy = this.currentY + h / 2;
            this.addAction(this.centerX, cy, w, h, lines);
            this.currentY += h;
        } else {
            const r = 11;
            const cy = this.currentY + r;
            this.addInitialNode(this.centerX, cy, r);
            this.currentY += r * 2;
        }

        const nextY = this.currentY + this.options.nodeGap;
        this.addLine(this.centerX, this.currentY, this.centerX, nextY, true, 'arrow-uml');
        this.currentY = nextY;
    }

    renderFinalNode() {
        const r = 13;
        const cy = this.currentY + r;
        this.addFinalNode(this.centerX, cy, r);
        this.currentY += r * 2;
    }

    renderStatement(stmt) {
        switch (stmt.type) {
            case 'input':
                this.renderInput(stmt);
                break;
            case 'output':
                this.renderOutput(stmt);
                break;
            case 'process':
                this.renderProcess(stmt);
                break;
            case 'return':
                this.renderReturn(stmt);
                break;
            case 'if':
                this.renderIf(stmt);
                break;
            case 'while':
                this.renderWhile(stmt);
                break;
            case 'for':
                this.renderFor(stmt);
                break;
            case 'do_while':
                this.renderDoWhile(stmt);
                break;
            default:
                break;
        }
    }

    renderReturn(stmt) {
        const text = stmt.text || 'return';
        const { lines, w, h } = this.calcActionDimensions(text, false);
        const cy = this.currentY + h / 2;

        this.addAction(this.centerX, cy, w, h, lines);
        this.currentY += h;

        const nextY = this.currentY + this.options.nodeGap;
        this.addLine(this.centerX, this.currentY, this.centerX, nextY, true, 'arrow-uml');
        this.currentY = nextY;
    }

    calcActionDimensions(actOrText, isIO = false, maxChars = 32) {
        if (typeof actOrText === 'object' && actOrText !== null) {
            if (this.options.expressionMode === 'math' && actOrText.type === 'process') {
                const frac = this.checkFraction(actOrText);
                if (frac) {
                    const charW = 8.5;
                    const prefix = frac.target ? `${frac.target} = ` : '';
                    const prefixW = prefix.length * charW;
                    const numW = frac.numText.length * charW;
                    const denW = frac.denText.length * charW;
                    const barW = Math.max(numW, denW) + 20;
                    const totalW = prefixW + barW;
                    return {
                        isFraction: true,
                        frac,
                        lines: [],
                        w: Math.max(120, totalW + 28),
                        h: 56
                    };
                }
            }
            const text = this.getNodeText(actOrText);
            const lines = SVG.splitText(text, maxChars);
            const maxL = Math.max(...lines.map(l => l.length));
            const w = Math.max(isIO ? 105 : 120, maxL * 8.5 + 26);
            const h = Math.max(34, lines.length * 18 + 14);
            return { isFraction: false, lines, w, h };
        } else {
            let text = String(actOrText || '');
            if (this.options.expressionMode === 'math') {
                text = toMathExpression(text);
            }
            const lines = SVG.splitText(text, maxChars);
            const maxL = Math.max(...lines.map(l => l.length));
            const w = Math.max(isIO ? 105 : 120, maxL * 8.5 + 26);
            const h = Math.max(34, lines.length * 18 + 14);
            return { isFraction: false, lines, w, h };
        }
    }

    renderActionNode(cx, cy, dim, opts = {}) {
        if (dim.isFraction) {
            this.addFractionAction(cx, cy, dim.w, dim.h, dim.frac.target, dim.frac.numText, dim.frac.denText, opts);
        } else {
            this.addAction(cx, cy, dim.w, dim.h, dim.lines, opts);
        }
    }

    renderInput(stmt) {
        const dim = this.calcActionDimensions(stmt, true);
        const cy = this.currentY + dim.h / 2;

        this.renderActionNode(this.centerX, cy, dim, { isIO: true });
        this.currentY += dim.h;

        const nextY = this.currentY + this.options.nodeGap;
        this.addLine(this.centerX, this.currentY, this.centerX, nextY, true, 'arrow-uml');
        this.currentY = nextY;
    }

    renderOutput(stmt) {
        const dim = this.calcActionDimensions(stmt, true);
        const cy = this.currentY + dim.h / 2;

        this.renderActionNode(this.centerX, cy, dim, { isIO: true });
        this.currentY += dim.h;

        const nextY = this.currentY + this.options.nodeGap;
        this.addLine(this.centerX, this.currentY, this.centerX, nextY, true, 'arrow-uml');
        this.currentY = nextY;
    }

    checkFraction(stmt) {
        if (!stmt) return null;
        let expr = stmt.expr;
        let target = stmt.target || '';
        if (!expr && stmt.text && stmt.text.includes('=')) {
            const parts = stmt.text.split('=');
            target = parts[0].trim();
            expr = parts.slice(1).join('=').trim();
        }
        if (!expr) return null;
        const frac = parseFraction(expr);
        if (frac.isFraction) {
            return {
                target: target,
                numText: toMathExpression(frac.numerator),
                denText: toMathExpression(frac.denominator)
            };
        }
        return null;
    }

    renderProcess(stmt) {
        const dim = this.calcActionDimensions(stmt, false);
        const cy = this.currentY + dim.h / 2;

        this.renderActionNode(this.centerX, cy, dim);
        this.currentY += dim.h;

        const nextY = this.currentY + this.options.nodeGap;
        this.addLine(this.centerX, this.currentY, this.centerX, nextY, true, 'arrow-uml');
        this.currentY = nextY;
    }

    renderIf(stmt) {
        const chain = this.flattenIfChain(stmt);
        if (chain.conditions.length > 1) {
            this.renderChainedIfElse(chain);
        } else if (chain.elseBranch && chain.elseBranch.length > 0) {
            this.renderFullIf(stmt);
        } else {
            this.renderShortIf(stmt);
        }
    }

    flattenIfChain(stmt) {
        const conditions = [];
        let cur = stmt;
        while (cur && cur.type === 'if') {
            conditions.push({
                condition: this.getConditionText(cur.condition),
                thenBranch: cur.thenBranch || []
            });
            if (cur.elseBranch && cur.elseBranch.length === 1 && cur.elseBranch[0].type === 'if') {
                cur = cur.elseBranch[0];
            } else {
                return {
                    conditions: conditions,
                    elseBranch: cur.elseBranch || []
                };
            }
        }
        return { conditions: conditions, elseBranch: [] };
    }

    getConditionText(cond) {
        if (!cond) return '';
        if (this.options.expressionMode === 'math') {
            return toMathExpression(cond);
        }
        return cond;
    }

    // 1. Short if (без else, Слайд 4 і Слайд 7 спосіб 1)
    renderShortIf(stmt) {
        const dSize = this.options.diamondSize;
        const decY = this.currentY + dSize / 2;

        // Decision diamond
        this.addDiamond(this.centerX, decY, dSize);

        // Guard text
        const guardText = `[ ${this.getConditionText(stmt.condition)} ]`;
        const guardLen = Math.max(50, guardText.length * 8.0);

        const act = stmt.thenBranch && stmt.thenBranch[0];
        const dim = this.calcActionDimensions(act, act?.type === 'output' || act?.type === 'input');
        const actW = dim.w;
        const actH = dim.h;

        // Dynamic right column: guarantees guard label never collides with action box
        const minGap = Math.max(90, guardLen + 24);
        const rightColX = Math.max(this.centerX + 195, this.centerX + dSize / 2 + minGap + actW / 2);

        // Guard label placed above line
        const labelX = this.centerX + dSize / 2 + 8;
        this.addLabel(labelX, decY - 11, guardText, { anchor: 'start', size: 12, weight: 'normal' });

        // Arrow from decision diamond right vertex to action box left edge
        this.addLine(this.centerX + dSize / 2, decY, rightColX - actW / 2, decY, true, 'arrow-uml');

        // Action box centered at (rightColX, decY)
        this.renderActionNode(rightColX, decY, dim, { isIO: act?.type === 'output' || act?.type === 'input' });

        // Merge diamond below decision diamond
        const mergeCy = decY + Math.max(48, actH / 2 + 20);
        this.addDiamond(this.centerX, mergeCy, dSize);

        // Straight arrow down from decision diamond into merge diamond
        this.addLine(this.centerX, decY + dSize / 2, this.centerX, mergeCy - dSize / 2, true, 'arrow-uml');

        // From action box bottom: drop down to merge level, then left with arrow into merge diamond
        const actionBottomY = decY + actH / 2;
        this.addPolyline([
            [rightColX, actionBottomY],
            [rightColX, mergeCy],
            [this.centerX + dSize / 2, mergeCy]
        ], true, 'arrow-uml');

        // Line down from merge diamond
        const nextY = mergeCy + dSize / 2 + this.options.nodeGap;
        this.addLine(this.centerX, mergeCy + dSize / 2, this.centerX, nextY, true, 'arrow-uml');
        this.currentY = nextY;
    }

    // 2. Full if (з else, Слайд 5)
    renderFullIf(stmt) {
        const dSize = this.options.diamondSize;
        const decY = this.currentY + dSize / 2;

        this.addDiamond(this.centerX, decY, dSize);

        const guardText = `[ ${this.getConditionText(stmt.condition)} ]`;
        const guardLen = Math.max(50, guardText.length * 8.0);

        const thenAct = stmt.thenBranch && stmt.thenBranch[0];
        const thenDim = this.calcActionDimensions(thenAct, thenAct?.type === 'output' || thenAct?.type === 'input');
        const thenW = thenDim.w;
        const thenH = thenDim.h;

        const minGap = Math.max(90, guardLen + 24);
        const rightColX = Math.max(this.centerX + 195, this.centerX + dSize / 2 + minGap + thenW / 2);

        // Label for then-branch
        this.addLabel(this.centerX + dSize / 2 + 8, decY - 11, guardText, { anchor: 'start', size: 12, weight: 'normal' });

        // Arrow to right action
        this.addLine(this.centerX + dSize / 2, decY, rightColX - thenW / 2, decY, true, 'arrow-uml');
        this.renderActionNode(rightColX, decY, thenDim, { isIO: thenAct?.type === 'output' || thenAct?.type === 'input' });

        // Else action straight down
        const elseAct = stmt.elseBranch && stmt.elseBranch[0];
        const elseDim = this.calcActionDimensions(elseAct, elseAct?.type === 'output' || elseAct?.type === 'input');
        const elseW = elseDim.w;
        const elseH = elseDim.h;
        const elseActionCy = decY + Math.max(48, elseH / 2 + 20);

        this.addLine(this.centerX, decY + dSize / 2, this.centerX, elseActionCy - elseH / 2, true, 'arrow-uml');
        this.renderActionNode(this.centerX, elseActionCy, elseDim, { isIO: elseAct?.type === 'output' || elseAct?.type === 'input' });

        // Merge diamond below else action
        const mergeCy = Math.max(elseActionCy + elseH / 2 + 28, decY + thenH / 2 + 28);
        this.addDiamond(this.centerX, mergeCy, dSize);

        // Arrow from else action down to merge diamond
        this.addLine(this.centerX, elseActionCy + elseH / 2, this.centerX, mergeCy - dSize / 2, true, 'arrow-uml');

        // Arrow from right action down and left to merge diamond
        this.addPolyline([
            [rightColX, decY + thenH / 2],
            [rightColX, mergeCy],
            [this.centerX + dSize / 2, mergeCy]
        ], true, 'arrow-uml');

        const nextY = mergeCy + dSize / 2 + this.options.nodeGap;
        this.addLine(this.centerX, mergeCy + dSize / 2, this.centerX, nextY, true, 'arrow-uml');
        this.currentY = nextY;
    }

    // 3. Chained if-else (Слайд 7 Спосіб 2)
    renderChainedIfElse(chain) {
        const dSize = this.options.diamondSize;
        const numConds = chain.conditions.length;

        // Exactly 2 conditions (Slide 7)
        if (numConds === 2) {
            const cond1 = chain.conditions[0];
            const cond2 = chain.conditions[1];

            const dec1Y = this.currentY + dSize / 2;

            // First decision diamond [ x<0 ]
            this.addDiamond(this.centerX, dec1Y, dSize);

            // Right action 1 (B = вираз_1)
            const act1 = cond1.thenBranch[0];
            const dim1 = this.calcActionDimensions(act1, act1?.type === 'output' || act1?.type === 'input');
            const act1W = dim1.w;
            const act1H = dim1.h;

            const guard1Text = `[ ${cond1.condition} ]`;
            const guard1Len = Math.max(50, guard1Text.length * 8.0);

            // Second condition
            const act3 = cond2.thenBranch[0];
            const dim3 = this.calcActionDimensions(act3, act3?.type === 'output' || act3?.type === 'input');
            const act3W = dim3.w;
            const act3H = dim3.h;

            const guard2Text = `[ ${cond2.condition} ]`;
            const guard2Len = Math.max(50, guard2Text.length * 8.0);

            const maxGuardLen = Math.max(guard1Len, guard2Len);
            const maxActW = Math.max(act1W, act3W);
            const minGap = Math.max(90, maxGuardLen + 24);
            const rightColX = Math.max(this.centerX + 195, this.centerX + dSize / 2 + minGap + maxActW / 2);

            this.addLabel(this.centerX + dSize / 2 + 8, dec1Y - 11, guard1Text, { anchor: 'start', size: 12, weight: 'normal' });
            this.addLine(this.centerX + dSize / 2, dec1Y, rightColX - act1W / 2, dec1Y, true, 'arrow-uml');
            this.renderActionNode(rightColX, dec1Y, dim1, { isIO: act1?.type === 'output' || act1?.type === 'input' });

            // Down arrow to second decision diamond [ x>1 ]
            const dec2Y = dec1Y + Math.max(48, act1H / 2 + 20);
            this.addLine(this.centerX, dec1Y + dSize / 2, this.centerX, dec2Y - dSize / 2, true, 'arrow-uml');
            this.addDiamond(this.centerX, dec2Y, dSize);

            // Right action 3 (B = вираз_3)
            this.addLabel(this.centerX + dSize / 2 + 8, dec2Y - 11, guard2Text, { anchor: 'start', size: 12, weight: 'normal' });
            this.addLine(this.centerX + dSize / 2, dec2Y, rightColX - act3W / 2, dec2Y, true, 'arrow-uml');
            this.renderActionNode(rightColX, dec2Y, dim3, { isIO: act3?.type === 'output' || act3?.type === 'input' });

            // Down arrow from dec2 to action 2 (B = вираз_2)
            const act2 = chain.elseBranch[0];
            const dim2 = this.calcActionDimensions(act2, act2?.type === 'output' || act2?.type === 'input');
            const act2W = dim2.w;
            const act2H = dim2.h;
            const act2Y = dec2Y + Math.max(50, act2H / 2 + 20);

            this.addLine(this.centerX, dec2Y + dSize / 2, this.centerX, act2Y - act2H / 2, true, 'arrow-uml');
            this.renderActionNode(this.centerX, act2Y, dim2, { isIO: act2?.type === 'output' || act2?.type === 'input' });

            // Central Merge diamond
            const mergeCy = act2Y + act2H / 2 + 30;
            this.addDiamond(this.centerX, mergeCy, dSize);

            // Right Merge diamond (as in Slide 7)
            const mergeRightX = rightColX;
            const mergeRightY = mergeCy;
            this.addDiamond(mergeRightX, mergeRightY, dSize);

            // Action 3 connects straight down into right merge diamond
            this.addLine(rightColX, dec2Y + act3H / 2, rightColX, mergeRightY - dSize / 2, true, 'arrow-uml');

            // Action 1 connects via outside bypass into right merge diamond (as in Slide 7)
            const bypassX = rightColX + maxActW / 2 + 20;

            this.addPolyline([
                [rightColX + act1W / 2, dec1Y],
                [bypassX, dec1Y],
                [bypassX, mergeRightY],
                [mergeRightX + dSize / 2, mergeRightY]
            ], true, 'arrow-uml');

            // Right merge diamond connects with horizontal arrow into central merge diamond
            this.addLine(mergeRightX - dSize / 2, mergeRightY, this.centerX + dSize / 2, mergeCy, true, 'arrow-uml');

            // Action 2 connects straight down into central merge diamond
            this.addLine(this.centerX, act2Y + act2H / 2, this.centerX, mergeCy - dSize / 2, true, 'arrow-uml');

            // Line down from central merge diamond
            const nextY = mergeCy + dSize / 2 + this.options.nodeGap;
            this.addLine(this.centerX, mergeCy + dSize / 2, this.centerX, nextY, true, 'arrow-uml');
            this.currentY = nextY;
            return;
        }

        // Generalized N > 2 cascade
        const rightColX = this.centerX + 180;
        let curDecY = this.currentY + dSize / 2;
        const branchBottoms = [];

        for (let i = 0; i < numConds; i++) {
            const condItem = chain.conditions[i];
            this.addDiamond(this.centerX, curDecY, dSize);

            const guardText = `[ ${condItem.condition} ]`;
            this.addLabel(this.centerX + dSize / 2 + 8, curDecY - 11, guardText, { anchor: 'start', size: 12, weight: 'normal' });

            let actCy = curDecY;
            let actBottomY = curDecY;
            for (const act of condItem.thenBranch) {
                const dim = this.calcActionDimensions(act, act.type === 'output' || act.type === 'input');
                this.addLine(this.centerX + dSize / 2, curDecY, rightColX - dim.w / 2, curDecY, true, 'arrow-uml');
                this.renderActionNode(rightColX, actCy, dim, { isIO: act.type === 'output' || act.type === 'input' });
                actBottomY = actCy + dim.h / 2;
                actCy += dim.h + 10;
            }
            branchBottoms.push({ x: rightColX, y: actBottomY, index: i });

            if (i < numConds - 1) {
                const nextDecY = curDecY + 48;
                this.addLine(this.centerX, curDecY + dSize / 2, this.centerX, nextDecY - dSize / 2, true, 'arrow-uml');
                curDecY = nextDecY;
            } else {
                let elseBottomY = curDecY;
                if (chain.elseBranch && chain.elseBranch.length > 0) {
                    const act = chain.elseBranch[0];
                    const dim = this.calcActionDimensions(act, act.type === 'output' || act.type === 'input');
                    const elseCy = curDecY + 48;

                    this.addLine(this.centerX, curDecY + dSize / 2, this.centerX, elseCy - dim.h / 2, true, 'arrow-uml');
                    this.renderActionNode(this.centerX, elseCy, dim, { isIO: act.type === 'output' || act.type === 'input' });
                    elseBottomY = elseCy + dim.h / 2;
                }
                branchBottoms.push({ x: this.centerX, y: elseBottomY, isElse: true });
            }
        }

        const maxBranchY = Math.max(...branchBottoms.map(b => b.y));
        const mergeCy = maxBranchY + 28;
        this.addDiamond(this.centerX, mergeCy, dSize);

        for (const b of branchBottoms) {
            if (b.isElse) {
                this.addLine(this.centerX, b.y, this.centerX, mergeCy - dSize / 2, true, 'arrow-uml');
            } else {
                const bypassOffset = b.index * 16;
                this.addPolyline([
                    [b.x, b.y],
                    [b.x + bypassOffset, b.y],
                    [b.x + bypassOffset, mergeCy],
                    [this.centerX + dSize / 2, mergeCy]
                ], true, 'arrow-uml');
            }
        }

        const nextY = mergeCy + dSize / 2 + this.options.nodeGap;
        this.addLine(this.centerX, mergeCy + dSize / 2, this.centerX, nextY, true, 'arrow-uml');
        this.currentY = nextY;
    }

    // 4. While loop
    renderWhile(stmt) {
        const dSize = this.options.diamondSize;
        const mergeCy = this.currentY + dSize / 2;
        this.addDiamond(this.centerX, mergeCy, dSize);

        const decCy = mergeCy + 36;
        this.addLine(this.centerX, mergeCy + dSize / 2, this.centerX, decCy - dSize / 2, true, 'arrow-uml');
        this.addDiamond(this.centerX, decCy, dSize);

        const guardText = `[ ${this.getConditionText(stmt.condition)} ]`;
        const guardLen = Math.max(50, guardText.length * 8.0);

        const bodyDims = (stmt.body || []).map(act => this.calcActionDimensions(act, act.type === 'output' || act.type === 'input'));
        let maxActW = Math.max(120, ...bodyDims.map(d => d.w));

        const rightOffset = Math.max(160, guardLen + 40, maxActW / 2 + 50);
        const rightX = this.centerX + rightOffset;

        this.addLabel(this.centerX + dSize / 2 + 8, decCy - 11, guardText, { anchor: 'start', size: 12, weight: 'normal' });

        let rightBottomY = decCy;
        for (let i = 0; i < (stmt.body || []).length; i++) {
            const act = stmt.body[i];
            const dim = bodyDims[i];

            this.addLine(this.centerX + dSize / 2, decCy, rightX - dim.w / 2, decCy, true, 'arrow-uml');
            this.renderActionNode(rightX, decCy, dim, { isIO: act.type === 'output' || act.type === 'input' });
            rightBottomY = decCy + dim.h / 2;
        }

        // Loop back arrow
        this.addPolyline([
            [rightX, rightBottomY],
            [rightX, mergeCy - 14],
            [this.centerX + dSize / 2 + 10, mergeCy - 14],
            [this.centerX, mergeCy - dSize / 2]
        ], true, 'arrow-uml');

        this.addLabel(this.centerX + 14, decCy + dSize / 2 + 14, '[ else ]', { anchor: 'start', size: 11.5, weight: 'normal' });
        const nextY = decCy + dSize / 2 + 40;
        this.addLine(this.centerX, decCy + dSize / 2, this.centerX, nextY, true, 'arrow-uml');
        this.currentY = nextY;
    }

    // 5. For loop
    renderFor(stmt) {
        if (stmt.init) {
            this.renderProcess({ text: stmt.init, type: 'process' });
        }

        const dSize = this.options.diamondSize;
        const mergeCy = this.currentY + dSize / 2;
        this.addDiamond(this.centerX, mergeCy, dSize);

        const decCy = mergeCy + 36;
        this.addLine(this.centerX, mergeCy + dSize / 2, this.centerX, decCy - dSize / 2, true, 'arrow-uml');
        this.addDiamond(this.centerX, decCy, dSize);

        const guardText = `[ ${this.getConditionText(stmt.condition)} ]`;
        const guardLen = Math.max(50, guardText.length * 8.0);

        const bodyDims = (stmt.body || []).map(act => this.calcActionDimensions(act, act.type === 'output' || act.type === 'input'));
        let maxActW = Math.max(120, ...bodyDims.map(d => d.w));

        const rightOffset = Math.max(160, guardLen + 40, maxActW / 2 + 50);
        const rightX = this.centerX + rightOffset;

        this.addLabel(this.centerX + dSize / 2 + 8, decCy - 11, guardText, { anchor: 'start', size: 12, weight: 'normal' });

        let rightBottomY = decCy;
        for (let i = 0; i < (stmt.body || []).length; i++) {
            const act = stmt.body[i];
            const dim = bodyDims[i];

            this.addLine(this.centerX + dSize / 2, decCy, rightX - dim.w / 2, decCy, true, 'arrow-uml');
            this.renderActionNode(rightX, decCy, dim, { isIO: act.type === 'output' || act.type === 'input' });
            rightBottomY = decCy + dim.h / 2;
        }

        if (stmt.step) {
            const stepDim = this.calcActionDimensions(stmt.step, false);
            const stepY = rightBottomY + 22;
            this.addLine(rightX, rightBottomY, rightX, stepY - stepDim.h / 2, true, 'arrow-uml');
            this.renderActionNode(rightX, stepY, stepDim);
            rightBottomY = stepY + stepDim.h / 2;
        }

        // Loop back arrow
        this.addPolyline([
            [rightX, rightBottomY],
            [rightX, mergeCy - 14],
            [this.centerX + dSize / 2 + 10, mergeCy - 14],
            [this.centerX, mergeCy - dSize / 2]
        ], true, 'arrow-uml');

        this.addLabel(this.centerX + 14, decCy + dSize / 2 + 14, '[ else ]', { anchor: 'start', size: 11.5, weight: 'normal' });
        const nextY = decCy + dSize / 2 + 40;
        this.addLine(this.centerX, decCy + dSize / 2, this.centerX, nextY, true, 'arrow-uml');
        this.currentY = nextY;
    }

    // 6. Do-while loop
    renderDoWhile(stmt) {
        const bodyStartY = this.currentY;
        let bodyY = bodyStartY;

        let maxBodyW = 110;
        for (const act of (stmt.body || [])) {
            const dim = this.calcActionDimensions(act, act.type === 'output' || act.type === 'input');
            maxBodyW = Math.max(maxBodyW, dim.w);
            this.renderActionNode(this.centerX, bodyY + dim.h / 2, dim, { isIO: act.type === 'output' || act.type === 'input' });
            bodyY += dim.h + 16;
        }

        const dSize = this.options.diamondSize;
        const decCy = bodyY + dSize / 2;
        this.addLine(this.centerX, bodyY - 16, this.centerX, decCy - dSize / 2, true, 'arrow-uml');
        this.addDiamond(this.centerX, decCy, dSize);

        const guardText = `[ ${this.getConditionText(stmt.condition)} ]`;
        const rightOffset = Math.max(150, guardText.length * 8.0 + 35, maxBodyW / 2 + 40);
        const rightX = this.centerX + rightOffset;

        this.addLabel(this.centerX + dSize / 2 + 8, decCy - 11, guardText, { anchor: 'start', size: 12, weight: 'normal' });
        this.addPolyline([
            [this.centerX + dSize / 2, decCy],
            [rightX, decCy],
            [rightX, bodyStartY - 10],
            [this.centerX, bodyStartY - 10]
        ], true, 'arrow-uml');

        this.addLabel(this.centerX + 14, decCy + dSize / 2 + 14, '[ else ]', { anchor: 'start', size: 11.5, weight: 'normal' });
        const nextY = decCy + dSize / 2 + 40;
        this.addLine(this.centerX, decCy + dSize / 2, this.centerX, nextY, true, 'arrow-uml');
        this.currentY = nextY;
    }

    getNodeText(node) {
        if (!node) return '';
        if (this.options.expressionStyle === 'lecture' && node.simplifiedText) {
            return node.simplifiedText;
        }
        let txt = '';
        if (node.type === 'output') {
            txt = node.umlText || `вивід ${node.text || 'y'}`;
        } else if (node.type === 'input') {
            txt = node.umlText || `ввід ${node.text || 'x'}`;
        } else {
            txt = node.text || node.fullText || (node.raw ? node.raw.replace(/;$/, '') : '');
        }
        if (this.options.expressionMode === 'math') {
            return toMathExpression(txt);
        }
        return txt;
    }
}

export { UmlRenderer };
export default UmlRenderer;
