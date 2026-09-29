/**
 * Flowchart Generator (Класична університетська блок-схема за ДСТУ/ГОСТ 19.701-90)
 * Replicates the exact format, layout, and line rules from Ukrainian university lectures.
 */

import { SVG, BoundingBox } from '../utils/svgHelpers.js';
import { toMathExpression, parseFraction } from '../utils/mathFormatter.js';

class FlowchartRenderer {
    constructor(ast, options = {}) {
        this.ast = ast;
        this.options = Object.assign({
            expressionStyle: 'original', // 'original' (реальний код) or 'lecture' (вираз_1)
            expressionMode: 'cpp',       // 'cpp' (C++ код) or 'math' (математичні формули)
            branchLabels: 'plus_minus',  // 'plus_minus' (+/-) or 'yes_no' (Так/Ні)
            arrowRule: 'all',           // 'all' (стрілки на всіх переходах)
            outputShape: 'document',    // 'document' (wave bottom) or 'parallelogram'
            showDeclarations: false,
            centerX: 340,
            startY: 45,
            nodeGap: 30
        }, options);

        this.elements = [];
        this.bounds = new BoundingBox();
        this.currentY = this.options.startY;
        this.centerX = this.options.centerX;
    }

    // Helper wrappers that push SVG strings AND track bounds
    addStadium(cx, cy, w, h, text, opts) {
        this.bounds.addRect(cx - w / 2, cy - h / 2, w, h);
        this.elements.push(SVG.stadium(cx, cy, w, h, text, opts));
    }

    addParallelogram(cx, cy, w, h, text, opts) {
        this.bounds.addRect(cx - w / 2, cy - h / 2, w, h);
        this.elements.push(SVG.parallelogram(cx, cy, w, h, text, opts));
    }

    addRectangle(cx, cy, w, h, text, opts) {
        this.bounds.addRect(cx - w / 2, cy - h / 2, w, h);
        this.elements.push(SVG.rectangle(cx, cy, w, h, text, opts));
    }

    addFractionRectangle(cx, cy, w, h, target, numText, denText, opts = {}) {
        this.bounds.addRect(cx - w / 2, cy - h / 2, w, h);
        this.elements.push(SVG.fractionRectangle(cx, cy, w, h, target, numText, denText, opts));
    }

    addRhombus(cx, cy, w, h, text, opts) {
        this.bounds.addRect(cx - w / 2, cy - h / 2, w, h);
        this.elements.push(SVG.rhombus(cx, cy, w, h, text, opts));
    }

    addDocument(cx, cy, w, h, text, opts) {
        this.bounds.addRect(cx - w / 2, cy - h / 2, w, h + 8);
        this.elements.push(SVG.document(cx, cy, w, h, text, opts));
    }

    addLine(x1, y1, x2, y2, hasArrow = false, markerType = 'arrow-flow') {
        this.bounds.addPoint(x1, y1);
        this.bounds.addPoint(x2, y2);
        this.elements.push(SVG.line(x1, y1, x2, y2, hasArrow, markerType));
    }

    addPolyline(points, hasArrow = false, markerType = 'arrow-flow') {
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

        // Terminal Start: "початок"
        this.renderStart();

        // Process statements
        for (let i = 0; i < this.ast.length; i++) {
            const stmt = this.ast[i];
            if (stmt.type === 'return' && stmt.isMainZero && i === this.ast.length - 1) {
                continue;
            }
            this.renderStatement(stmt);
        }

        // Terminal End: "кінець"
        this.renderEnd();

        // Dynamic and robust viewBox based on actual content
        const vb = this.bounds.getViewBox(55, 45);

        const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.width} ${vb.height}" width="${vb.width}" height="${vb.height}">
            ${SVG.createDefs()}
            <g id="flowchart-layer">
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

    renderStart() {
        const h = 36;
        const startText = this.options.startText || (this.ast.functionName && this.ast.functionName !== 'main' ? (this.ast.functionSignature || this.ast.functionName) : 'початок');
        const lines = SVG.splitText(startText, 30);
        const maxLen = Math.max(...lines.map(l => l.length));
        const w = Math.max(120, maxLen * 8.5 + 32);
        const cy = this.currentY + h / 2;

        this.addStadium(this.centerX, cy, w, h, lines.length === 1 ? lines[0] : lines);
        this.currentY += h;

        const nextY = this.currentY + this.options.nodeGap;
        this.addLine(this.centerX, this.currentY, this.centerX, nextY, this.shouldDrawArrow('down'));
        this.currentY = nextY;
    }

    renderEnd() {
        const h = 36;
        const w = 120;
        const cy = this.currentY + h / 2;

        this.addStadium(this.centerX, cy, w, h, 'кінець');
        this.currentY += h;
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

    renderInput(stmt) {
        let text = stmt.text || 'x';
        if (!text.toLowerCase().startsWith('ввід')) {
            text = `ввід ${text}`;
        }
        const lines = SVG.splitText(text, 34);
        const maxLen = Math.max(...lines.map(l => l.length));
        const w = Math.max(100, maxLen * 8.5 + 36);
        const h = Math.max(38, lines.length * 19 + 14);
        const cy = this.currentY + h / 2;

        this.addParallelogram(this.centerX, cy, w, h, lines);
        this.currentY += h;

        const nextY = this.currentY + this.options.nodeGap;
        this.addLine(this.centerX, this.currentY, this.centerX, nextY, this.shouldDrawArrow('down'));
        this.currentY = nextY;
    }

    renderOutput(stmt) {
        let text = stmt.text || 'y';
        if (!text.toLowerCase().startsWith('вивід')) {
            text = `вивід ${text}`;
        }
        const lines = SVG.splitText(text, 34);
        const maxLen = Math.max(...lines.map(l => l.length));
        const w = Math.max(90, maxLen * 8.5 + 34);
        const h = Math.max(42, lines.length * 19 + 16);
        const cy = this.currentY + h / 2;

        if (this.options.outputShape === 'parallelogram') {
            this.addParallelogram(this.centerX, cy, w, h, lines);
        } else {
            this.addDocument(this.centerX, cy, w, h, lines);
        }
        this.currentY += h;

        const nextY = this.currentY + this.options.nodeGap;
        this.addLine(this.centerX, this.currentY, this.centerX, nextY, this.shouldDrawArrow('down'));
        this.currentY = nextY;
    }

    renderReturn(stmt) {
        const dim = this.calcActionDimensions(stmt, false);
        const cy = this.currentY + dim.h / 2;

        this.renderActionShape(this.centerX, cy, dim, 'return');
        this.currentY += dim.h;

        const nextY = this.currentY + this.options.nodeGap;
        this.addLine(this.centerX, this.currentY, this.centerX, nextY, this.shouldDrawArrow('down'));
        this.currentY = nextY;
    }

    checkFraction(stmt) {
        if (!stmt) return null;
        let frac = parseFraction(stmt.text || stmt.raw || '');
        if (!frac || !frac.isFraction) {
            if (stmt.expr) {
                frac = parseFraction(stmt.expr);
            }
        }
        if (frac && frac.isFraction) {
            let target = frac.target || stmt.target || '';
            target = target.replace(/^(const\s+|constexpr\s+)?(double|float|int|long|short|auto|char|bool|unsigned|signed|size_t)\s+/, '').trim();
            return {
                target: target,
                prefix: toMathExpression(frac.prefix || ''),
                numText: toMathExpression(frac.numerator),
                denText: toMathExpression(frac.denominator),
                suffix: toMathExpression(frac.suffix || '')
            };
        }
        return null;
    }

    calcActionDimensions(actOrText, isIO = false, maxChars = 34) {
        if (typeof actOrText === 'object' && actOrText !== null) {
            if (this.options.expressionMode === 'math' && (actOrText.type === 'process' || actOrText.type === 'return')) {
                const frac = this.checkFraction(actOrText);
                if (frac) {
                    const charW = 8.2;
                    const leftPart = frac.target ? `${frac.target} = ${frac.prefix}` : frac.prefix;
                    const leftW = leftPart ? leftPart.length * charW : 0;
                    const rightW = frac.suffix ? frac.suffix.length * charW : 0;
                    const numW = frac.numText.length * 8.0;
                    const denW = frac.denText.length * 8.0;
                    const barW = Math.max(numW, denW) + 16;
                    const totalW = leftW + (leftW > 0 ? 6 : 0) + barW + (rightW > 0 ? 6 : 0) + rightW;
                    return {
                        isFraction: true,
                        frac,
                        lines: [],
                        w: Math.max(136, Math.ceil(totalW + 36)),
                        h: 58
                    };
                }
            }
            const text = this.getNodeText(actOrText);
            const lines = SVG.splitText(text, maxChars);
            const maxL = Math.max(...lines.map(l => l.length));
            const w = Math.max(isIO ? 100 : 136, maxL * 8.5 + 24);
            const h = Math.max(38, lines.length * 19 + 14);
            return { isFraction: false, lines, w, h };
        } else {
            let text = String(actOrText || '');
            if (this.options.expressionMode === 'math') {
                text = toMathExpression(text);
            }
            const lines = SVG.splitText(text, maxChars);
            const maxL = Math.max(...lines.map(l => l.length));
            const w = Math.max(isIO ? 100 : 136, maxL * 8.5 + 24);
            const h = Math.max(38, lines.length * 19 + 14);
            return { isFraction: false, lines, w, h };
        }
    }

    renderProcess(stmt) {
        const dim = this.calcActionDimensions(stmt, false);
        const cy = this.currentY + dim.h / 2;

        this.renderActionShape(this.centerX, cy, dim, stmt.type);
        this.currentY += dim.h;

        const nextY = this.currentY + this.options.nodeGap;
        this.addLine(this.centerX, this.currentY, this.centerX, nextY, this.shouldDrawArrow('down'));
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

    calcRhombusDimensions(conditionText) {
        const text = this.getConditionText(conditionText);
        const lines = SVG.splitText(text, 34);
        const maxCondLen = Math.max(...lines.map(l => l.length));
        let w = Math.max(130, maxCondLen * 10 + 52);
        const h = Math.max(50, lines.length * 24 + 18);
        if (lines.length > 1) {
            w = Math.max(w, Math.round(h * 2.2));
        }
        return { lines, w, h };
    }

    // 1. Short if (без else, Слайд 4 і Слайд 7 спосіб 1)
    renderShortIf(stmt) {
        const { lines, w: condW, h: condH } = this.calcRhombusDimensions(stmt.condition);
        const condY = this.currentY + condH / 2;
        const condX = this.centerX;

        this.addRhombus(condX, condY, condW, condH, lines);

        const plusLabel = this.options.branchLabels === 'yes_no' ? 'Так' : '+';
        const minusLabel = this.options.branchLabels === 'yes_no' ? 'Ні' : '-';

        // Calculate max action width
        const thenStmts = stmt.thenBranch || [];
        const thenDims = thenStmts.map(act => this.calcActionDimensions(act));
        let maxActW = Math.max(136, ...thenDims.map(d => d.w));

        // Dynamic branch offset to prevent any overlap or clipping
        const branchOffset = Math.max(165, condW / 2 + maxActW / 2 + 35);
        const leftColX = condX - branchOffset;
        const rightColX = condX + branchOffset;

        // + label placed at midpoint of horizontal segment
        const midRightX = (condX + condW / 2 + rightColX) / 2;
        this.addLabel(midRightX, condY - 11, plusLabel, { size: 14 });

        const actionTopY = Math.max(condY + 30, condY + condH / 2 + 12);
        this.addPolyline([
            [condX + condW / 2, condY],
            [rightColX, condY],
            [rightColX, actionTopY]
        ], this.shouldDrawArrow('down'));

        // Action block(s) on right
        let actionBottomY = actionTopY;
        for (let i = 0; i < thenStmts.length; i++) {
            const act = thenStmts[i];
            const dim = thenDims[i];
            this.renderActionShape(rightColX, actionBottomY + dim.h / 2, dim, act.type);
            actionBottomY += dim.h;
        }

        // - label placed at midpoint of horizontal segment
        const midLeftX = (condX - condW / 2 + leftColX) / 2;
        this.addLabel(midLeftX, condY - 11, minusLabel, { size: 14 });

        // Merge Y level
        const mergeY = Math.max(actionBottomY + 24, condY + condH / 2 + 45);

        // Right vertical line down to merge level
        this.addLine(rightColX, actionBottomY, rightColX, mergeY);

        // Left branch: line from diamond left, down to merge level
        this.addPolyline([
            [condX - condW / 2, condY],
            [leftColX, condY],
            [leftColX, mergeY]
        ]);

        // Continuous horizontal bus line connecting leftColX and rightColX
        this.addLine(leftColX, mergeY, rightColX, mergeY);

        // Exit down from central axis
        const nextY = mergeY + this.options.nodeGap;
        this.addLine(condX, mergeY, condX, nextY, this.shouldDrawArrow('down'));
        this.currentY = nextY;
    }

    // 2. Full if (з else, Слайд 5)
    renderFullIf(stmt) {
        const { lines, w: condW, h: condH } = this.calcRhombusDimensions(stmt.condition);
        const condY = this.currentY + condH / 2;
        const condX = this.centerX;

        this.addRhombus(condX, condY, condW, condH, lines);

        const plusLabel = this.options.branchLabels === 'yes_no' ? 'Так' : '+';
        const minusLabel = this.options.branchLabels === 'yes_no' ? 'Ні' : '-';

        const thenDims = (stmt.thenBranch || []).map(act => this.calcActionDimensions(act));
        const elseDims = (stmt.elseBranch || []).map(act => this.calcActionDimensions(act));
        const maxThenW = Math.max(136, ...thenDims.map(d => d.w));
        const maxElseW = Math.max(136, ...elseDims.map(d => d.w));

        const maxSideW = Math.max(maxThenW, maxElseW);
        const branchOffset = Math.max(165, condW / 2 + maxSideW / 2 + 35);
        const rightColX = condX + branchOffset;
        const leftColX = condX - branchOffset;

        // + branch (right)
        const midRightX = (condX + condW / 2 + rightColX) / 2;
        this.addLabel(midRightX, condY - 11, plusLabel, { size: 14 });
        const actionTopY = Math.max(condY + 30, condY + condH / 2 + 12);

        this.addPolyline([
            [condX + condW / 2, condY],
            [rightColX, condY],
            [rightColX, actionTopY]
        ], this.shouldDrawArrow('down'));

        let rightBottomY = actionTopY;
        for (let i = 0; i < (stmt.thenBranch || []).length; i++) {
            const act = stmt.thenBranch[i];
            const dim = thenDims[i];
            this.renderActionShape(rightColX, rightBottomY + dim.h / 2, dim, act.type);
            rightBottomY += dim.h;
        }

        // - branch (left)
        const midLeftX = (condX - condW / 2 + leftColX) / 2;
        this.addLabel(midLeftX, condY - 11, minusLabel, { size: 14 });
        this.addPolyline([
            [condX - condW / 2, condY],
            [leftColX, condY],
            [leftColX, actionTopY]
        ], this.shouldDrawArrow('down'));

        let leftBottomY = actionTopY;
        for (let i = 0; i < (stmt.elseBranch || []).length; i++) {
            const act = stmt.elseBranch[i];
            const dim = elseDims[i];
            this.renderActionShape(leftColX, leftBottomY + dim.h / 2, dim, act.type);
            leftBottomY += dim.h;
        }

        const mergeY = Math.max(rightBottomY, leftBottomY) + 24;

        this.addLine(rightColX, rightBottomY, rightColX, mergeY);
        this.addLine(leftColX, leftBottomY, leftColX, mergeY);
        this.addLine(leftColX, mergeY, rightColX, mergeY);

        const nextY = mergeY + this.options.nodeGap;
        this.addLine(condX, mergeY, condX, nextY, this.shouldDrawArrow('down'));
        this.currentY = nextY;
    }

    // 3. Chained if-else (Слайд 7 Спосіб 2)
    renderChainedIfElse(chain) {
        const plusLabel = this.options.branchLabels === 'yes_no' ? 'Так' : '+';
        const minusLabel = this.options.branchLabels === 'yes_no' ? 'Ні' : '-';

        const numConds = chain.conditions.length;

        // Exactly 2 conditions (Slide 7)
        if (numConds === 2) {
            const cond1 = chain.conditions[0];
            const cond2 = chain.conditions[1];

            const { lines: cond1Lines, w: cond1W, h: cond1H } = this.calcRhombusDimensions(cond1.condition);
            const cond1Y = this.currentY + cond1H / 2;
            const cond1X = this.centerX;

            this.addRhombus(cond1X, cond1Y, cond1W, cond1H, cond1Lines);

            // Right (+): B = вираз_1
            const act1 = cond1.thenBranch[0];
            const dim1 = this.calcActionDimensions(act1);
            const act1W = dim1.w;
            const act1H = dim1.h;

            const rightX = cond1X + Math.max(165, cond1W / 2 + act1W / 2 + 35);

            const midRight1X = (cond1X + cond1W / 2 + rightX) / 2;
            this.addLabel(midRight1X, cond1Y - 11, plusLabel, { size: 14 });

            const act1TopY = Math.max(cond1Y + 30, cond1Y + cond1H / 2 + 12);
            this.addPolyline([
                [cond1X + cond1W / 2, cond1Y],
                [rightX, cond1Y],
                [rightX, act1TopY]
            ], this.shouldDrawArrow('down'));

            this.renderActionShape(rightX, act1TopY + act1H / 2, dim1, act1?.type);
            const act1BottomY = act1TopY + act1H;

            // Left (-): Goes down to second rhombus
            const { lines: cond2Lines, w: cond2W, h: cond2H } = this.calcRhombusDimensions(cond2.condition);

            const act2 = chain.elseBranch[0];
            const dim2 = this.calcActionDimensions(act2);
            const act2W = dim2.w;
            const act2H = dim2.h;

            const act3 = cond2.thenBranch[0];
            const dim3 = this.calcActionDimensions(act3);
            const act3W = dim3.w;
            const act3H = dim3.h;

            const centerColX = cond1X;
            const cond2Offset = Math.max(160, cond1W / 2 + cond2W / 2 + 25, act3W / 2 + cond2W / 2 + 25);
            const cond2X = cond1X - cond2Offset;
            const leftColX = cond2X - Math.max(110, cond2W / 2 + act2W / 2 + 25);
            const cond2Y = Math.max(cond1Y + 54, cond1Y + cond1H / 2 + cond2H / 2 + 18);

            const midLeft1X = (cond1X - cond1W / 2 + cond2X) / 2;
            this.addLabel(midLeft1X, cond1Y - 11, minusLabel, { size: 14 });

            // Line from cond1 left to cond2 top
            this.addPolyline([
                [cond1X - cond1W / 2, cond1Y],
                [cond2X, cond1Y],
                [cond2X, cond2Y - cond2H / 2]
            ], this.shouldDrawArrow('down'));

            // Second rhombus at cond2X
            this.addRhombus(cond2X, cond2Y, cond2W, cond2H, cond2Lines);

            // From cond2:
            // Right (+): B = вираз_3
            const midRight2X = (cond2X + cond2W / 2 + centerColX) / 2;
            this.addLabel(midRight2X, cond2Y - 11, plusLabel, { size: 14 });
            const act3TopY = Math.max(cond2Y + 30, cond2Y + cond2H / 2 + 12);

            this.addPolyline([
                [cond2X + cond2W / 2, cond2Y],
                [centerColX, cond2Y],
                [centerColX, act3TopY]
            ], this.shouldDrawArrow('down'));

            this.renderActionShape(centerColX, act3TopY + act3H / 2, dim3, act3?.type);
            const act3BottomY = act3TopY + act3H;

            // Left (-): B = вираз_2
            const midLeft2X = (cond2X - cond2W / 2 + leftColX) / 2;
            this.addLabel(midLeft2X, cond2Y - 11, minusLabel, { size: 14 });
            const act2TopY = Math.max(cond2Y + 30, cond2Y + cond2H / 2 + 12);

            this.addPolyline([
                [cond2X - cond2W / 2, cond2Y],
                [leftColX, cond2Y],
                [leftColX, act2TopY]
            ], this.shouldDrawArrow('down'));

            this.renderActionShape(leftColX, act2TopY + act2H / 2, dim2, act2?.type);
            const act2BottomY = act2TopY + act2H;

            // Bottom horizontal bus line at mergeY
            const mergeY = Math.max(act1BottomY, act2BottomY, act3BottomY) + 24;

            // Drop lines from each of the 3 action boxes to the bus
            this.addLine(leftColX, act2BottomY, leftColX, mergeY);
            this.addLine(centerColX, act3BottomY, centerColX, mergeY);
            this.addLine(rightX, act1BottomY, rightX, mergeY);

            // Continuous horizontal bus line connecting leftColX to rightX
            this.addLine(leftColX, mergeY, rightX, mergeY);

            // Exit down from central axis
            const nextY = mergeY + this.options.nodeGap;
            this.addLine(cond1X, mergeY, cond1X, nextY, this.shouldDrawArrow('down'));
            this.currentY = nextY;
            return;
        }

        // Generalized N > 2 cascade
        const condDims = chain.conditions.map(c => this.calcRhombusDimensions(c.condition));
        const maxCondW = Math.max(120, ...condDims.map(d => d.w));

        const allThenDims = chain.conditions.flatMap(c => (c.thenBranch || []).map(act => this.calcActionDimensions(act)));
        const maxThenW = Math.max(136, ...allThenDims.map(d => d.w));

        const rightColX = this.centerX + Math.max(160, maxCondW / 2 + maxThenW / 2 + 35);
        const busRightX = rightColX + maxThenW / 2 + 25;

        const branchBottoms = [];
        let curX = this.centerX;
        let curY = this.currentY;

        for (let i = 0; i < numConds; i++) {
            const condItem = chain.conditions[i];
            const { lines, w: condW, h: condH } = condDims[i];
            const condCenterY = curY + condH / 2;

            this.addRhombus(curX, condCenterY, condW, condH, lines);

            // '+' branch: goes right to rightColX
            this.addLabel(curX + condW / 2 + 16, condCenterY - 11, plusLabel, { size: 14 });

            const actTopY = Math.max(condCenterY + 28, condCenterY + condH / 2 + 10);
            this.addPolyline([
                [curX + condW / 2, condCenterY],
                [rightColX, condCenterY],
                [rightColX, actTopY]
            ], this.shouldDrawArrow('down'));

            let actBottomY = actTopY;
            for (const act of condItem.thenBranch) {
                const dim = this.calcActionDimensions(act);
                this.renderActionShape(rightColX, actBottomY + dim.h / 2, dim, act.type);
                actBottomY += dim.h;
            }
            branchBottoms.push({ x: rightColX, y: actBottomY });

            // Connect action bottom to busRightX
            this.addLine(rightColX, actBottomY, busRightX, actBottomY);

            // '-' branch: goes left
            this.addLabel(curX - condW / 2 - 16, condCenterY - 11, minusLabel, { size: 14 });

            if (i < numConds - 1) {
                const nextX = curX - Math.max(85, condW / 2 + 25);
                const nextY = Math.max(condCenterY + 60, actBottomY + 20);

                this.addPolyline([
                    [curX - condW / 2, condCenterY],
                    [nextX, condCenterY],
                    [nextX, nextY]
                ], this.shouldDrawArrow('down'));

                curX = nextX;
                curY = nextY;
            } else {
                const elseX = curX - Math.max(95, condW / 2 + 35);
                const elseTopY = Math.max(condCenterY + 28, condCenterY + condH / 2 + 10);
                this.addPolyline([
                    [curX - condW / 2, condCenterY],
                    [elseX, condCenterY],
                    [elseX, elseTopY]
                ], this.shouldDrawArrow('down'));

                let elseBottomY = elseTopY;
                if (chain.elseBranch && chain.elseBranch.length > 0) {
                    for (const act of chain.elseBranch) {
                        const dim = this.calcActionDimensions(act);
                        this.renderActionShape(elseX, elseBottomY + dim.h / 2, dim, act.type);
                        elseBottomY += dim.h;
                    }
                }
                branchBottoms.push({ x: elseX, y: elseBottomY, isElse: true });
            }
        }

        const maxY = Math.max(...branchBottoms.map(b => b.y)) + 24;

        // Down from busRightX to maxY
        const minThenY = Math.min(...branchBottoms.filter(b => !b.isElse).map(b => b.y));
        this.addLine(busRightX, minThenY, busRightX, maxY);
        this.addLine(busRightX, maxY, this.centerX, maxY);

        // Else branch drops down to maxY and connects to centerX
        const elseBranch = branchBottoms.find(b => b.isElse);
        if (elseBranch) {
            this.addLine(elseBranch.x, elseBranch.y, elseBranch.x, maxY);
            this.addLine(elseBranch.x, maxY, this.centerX, maxY);
        }

        const nextY = maxY + this.options.nodeGap;
        this.addLine(this.centerX, maxY, this.centerX, nextY, this.shouldDrawArrow('down'));
        this.currentY = nextY;
    }

    // 4. While loop
    renderWhile(stmt) {
        const { lines, w: condW, h: condH } = this.calcRhombusDimensions(stmt.condition);
        const condY = this.currentY + condH / 2;
        const condX = this.centerX;

        this.addRhombus(condX, condY, condW, condH, lines);

        const plusLabel = this.options.branchLabels === 'yes_no' ? 'Так' : '+';
        const minusLabel = this.options.branchLabels === 'yes_no' ? 'Ні' : '-';

        // Down (+): loop body
        this.addLabel(condX + 18, condY + condH / 2 + 14, plusLabel, { size: 14 });
        const bodyStartY = condY + condH / 2 + this.options.nodeGap;
        this.addLine(condX, condY + condH / 2, condX, bodyStartY, this.shouldDrawArrow('down'));
        this.currentY = bodyStartY;

        for (const bodyStmt of (stmt.body || [])) {
            this.renderStatement(bodyStmt);
        }

        const loopBottomY = this.currentY;
        const loopLeftX = Math.min(this.bounds.minX, condX - condW / 2) - 35;
        const loopTopY = condY - condH / 2 - 16;

        // Loop back line (left -> up past cond -> top of cond)
        this.addPolyline([
            [condX, loopBottomY],
            [loopLeftX, loopBottomY],
            [loopLeftX, loopTopY],
            [condX, loopTopY],
            [condX, condY - condH / 2]
        ], true, 'arrow-flow');

        // Right (-): exit from loop
        this.addLabel(condX + condW / 2 + 16, condY - 11, minusLabel, { size: 14 });
        const exitRightX = Math.max(this.bounds.maxX, condX + condW / 2) + 35;
        const exitY = loopBottomY + 24;

        this.addPolyline([
            [condX + condW / 2, condY],
            [exitRightX, condY],
            [exitRightX, exitY],
            [condX, exitY]
        ], false);

        const nextY = exitY + this.options.nodeGap;
        this.addLine(condX, exitY, condX, nextY, this.shouldDrawArrow('down'));
        this.currentY = nextY;
    }

    // 5. For loop
    renderFor(stmt) {
        if (stmt.init) {
            this.renderProcess({ text: stmt.init, type: 'process' });
        }

        const { lines, w: condW, h: condH } = this.calcRhombusDimensions(stmt.condition);
        const condY = this.currentY + condH / 2;
        const condX = this.centerX;

        this.addRhombus(condX, condY, condW, condH, lines);

        const plusLabel = this.options.branchLabels === 'yes_no' ? 'Так' : '+';
        const minusLabel = this.options.branchLabels === 'yes_no' ? 'Ні' : '-';

        // Down (+): loop body
        this.addLabel(condX + 18, condY + condH / 2 + 14, plusLabel, { size: 14 });
        const bodyStartY = condY + condH / 2 + this.options.nodeGap;
        this.addLine(condX, condY + condH / 2, condX, bodyStartY, this.shouldDrawArrow('down'));
        this.currentY = bodyStartY;

        for (const bodyStmt of (stmt.body || [])) {
            this.renderStatement(bodyStmt);
        }

        if (stmt.step) {
            this.renderProcess({ text: stmt.step, type: 'process' });
        }

        const loopBottomY = this.currentY;
        const loopLeftX = Math.min(this.bounds.minX, condX - condW / 2) - 35;
        const loopTopY = condY - condH / 2 - 16;

        this.addPolyline([
            [condX, loopBottomY],
            [loopLeftX, loopBottomY],
            [loopLeftX, loopTopY],
            [condX, loopTopY],
            [condX, condY - condH / 2]
        ], true, 'arrow-flow');

        this.addLabel(condX + condW / 2 + 16, condY - 11, minusLabel, { size: 14 });
        const exitRightX = Math.max(this.bounds.maxX, condX + condW / 2) + 35;
        const exitY = loopBottomY + 24;

        this.addPolyline([
            [condX + condW / 2, condY],
            [exitRightX, condY],
            [exitRightX, exitY],
            [condX, exitY]
        ], false);

        const nextY = exitY + this.options.nodeGap;
        this.addLine(condX, exitY, condX, nextY, this.shouldDrawArrow('down'));
        this.currentY = nextY;
    }

    // 6. Do-while loop
    renderDoWhile(stmt) {
        const bodyStartY = this.currentY;

        for (const bodyStmt of (stmt.body || [])) {
            this.renderStatement(bodyStmt);
        }

        const { lines, w: condW, h: condH } = this.calcRhombusDimensions(stmt.condition);
        const condY = this.currentY + condH / 2;
        const condX = this.centerX;

        this.addRhombus(condX, condY, condW, condH, lines);

        const plusLabel = this.options.branchLabels === 'yes_no' ? 'Так' : '+';
        const minusLabel = this.options.branchLabels === 'yes_no' ? 'Ні' : '-';

        // Right (+): loop back to top of body
        this.addLabel(condX + condW / 2 + 16, condY - 11, plusLabel, { size: 14 });
        const loopRightX = Math.max(this.bounds.maxX, condX + condW / 2) + 35;

        this.addPolyline([
            [condX + condW / 2, condY],
            [loopRightX, condY],
            [loopRightX, bodyStartY - 14],
            [condX, bodyStartY - 14],
            [condX, bodyStartY]
        ], true, 'arrow-flow');

        // Down (-): exit
        this.addLabel(condX + 18, condY + condH / 2 + 14, minusLabel, { size: 14 });
        const nextY = condY + condH / 2 + this.options.nodeGap;
        this.addLine(condX, condY + condH / 2, condX, nextY, this.shouldDrawArrow('down'));
        this.currentY = nextY;
    }

    getNodeText(node) {
        if (!node) return '';
        if (this.options.expressionStyle === 'lecture' && node.simplifiedText) {
            return node.simplifiedText;
        }
        let txt = node.text || node.fullText || (node.raw ? node.raw.replace(/;$/, '') : '');
        if (this.options.expressionMode === 'math') {
            return toMathExpression(txt);
        }
        return txt;
    }

    renderActionShape(cx, cy, dimOrW, hOrType, textOrEmpty, typeOrActNode) {
        if (typeof dimOrW === 'object' && dimOrW !== null) {
            const dim = dimOrW;
            const type = hOrType;
            if (dim.isFraction) {
                this.addFractionRectangle(cx, cy, dim.w, dim.h, dim.frac.target, dim.frac.numText, dim.frac.denText, {
                    prefix: dim.frac.prefix,
                    suffix: dim.frac.suffix
                });
                return;
            }
            if (type === 'output' && this.options.outputShape === 'document') {
                this.addDocument(cx, cy, dim.w, dim.h, dim.lines);
            } else if (type === 'input') {
                this.addParallelogram(cx, cy, dim.w, dim.h, dim.lines);
            } else {
                this.addRectangle(cx, cy, dim.w, dim.h, dim.lines);
            }
        } else {
            const w = dimOrW;
            const h = hOrType;
            const text = textOrEmpty;
            const type = typeOrActNode;
            if (type === 'output' && this.options.outputShape === 'document') {
                this.addDocument(cx, cy, w, h, text);
            } else if (type === 'input') {
                this.addParallelogram(cx, cy, w, h, text);
            } else {
                this.addRectangle(cx, cy, w, h, text);
            }
        }
    }

    shouldDrawArrow(direction) {
        if (this.options.arrowRule === 'all') return true;
        // Academic rule (Slide 1 & 2):
        // Downward and rightward lines: NO ARROWS
        // Upward and leftward lines: ARROWS
        if (direction === 'down' || direction === 'right') return false;
        return true;
    }
}

export { FlowchartRenderer };
export default FlowchartRenderer;
