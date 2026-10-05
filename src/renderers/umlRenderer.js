/**
 * UML Activity Diagram Generator (UML 2.x Діаграма діяльності)
 * Strictly conforms to canonical UML 2.x and academic rules (matching uml.pp.ua),
 * using the project's native typography, math expressions, and fraction formatting.
 */

import { SVG, BoundingBox } from "../utils/svgHelpers.js";
import { toMathExpression, parseFraction } from "../utils/mathFormatter.js";

class UmlRenderer {
  constructor(ast, options = {}) {
    this.ast = ast;
    const dSize = options.diamondSize || 24;
    this.options = Object.assign(
      {
        expressionStyle: "original", // 'original' (реальний код) or 'lecture' (вираз_1)
        expressionMode: "cpp", // 'cpp' (C++) or 'math' (математичні формули)
        showDeclarations: false,
        nodeGap: 26,
        diamondSize: dSize,
        mergeDiamondSize: options.mergeDiamondSize || dSize,
      },
      options
    );

    this.elements = [];
    this.bounds = new BoundingBox();
  }

  getNodeText(node) {
    if (!node) return "";
    if (this.options.expressionStyle === "lecture" && node.simplifiedText) {
      return node.simplifiedText;
    }
    let txt = "";
    if (node.type === "output") {
      txt = node.umlText || `вивід ${node.text || "y"}`;
    } else if (node.type === "input") {
      txt = node.umlText || `ввід ${node.text || "x"}`;
    } else {
      txt = node.text || node.fullText || (node.raw ? node.raw.replace(/;$/, "") : "");
    }
    if (this.options.expressionMode === "math") {
      return toMathExpression(txt);
    }
    return txt;
  }

  getConditionText(cond) {
    if (!cond) return "";
    if (this.options.expressionMode === "math") {
      return toMathExpression(cond);
    }
    return cond;
  }

  formatGuard(condText) {
    const raw = this.getConditionText(condText);
    return `[ ${raw} ]`;
  }

  checkFraction(stmt) {
    if (!stmt) return null;
    let frac = parseFraction(stmt.text || stmt.raw || "");
    if (!frac || !frac.isFraction) {
      if (stmt.expr) frac = parseFraction(stmt.expr);
    }
    if (frac && frac.isFraction) {
      let target = frac.target || stmt.target || "";
      target = target
        .replace(
          /^(const\s+|constexpr\s+)?(double|float|int|long|short|auto|char|bool|unsigned|signed|size_t)\s+/,
          ""
        )
        .trim();
      return {
        target: target,
        prefix: toMathExpression(frac.prefix || ""),
        numText: toMathExpression(frac.numerator),
        denText: toMathExpression(frac.denominator),
        suffix: toMathExpression(frac.suffix || ""),
      };
    }
    return null;
  }

  calcActionDimensions(node, isIO = false, maxChars = 40) {
    if (typeof node === "object" && node !== null) {
      if (
        this.options.expressionMode === "math" &&
        (node.type === "process" || node.type === "return")
      ) {
        const frac = this.checkFraction(node);
        if (frac) {
          const charW = 8.2;
          const sep = (frac.target === 'return' || /[-+*/]?=$/.test(frac.target)) ? ' ' : ' = ';
          const formattedTarget = frac.target ? frac.target.replace(/\*/g, '·') : '';
          const leftPart = formattedTarget ? `${formattedTarget}${sep}${frac.prefix}` : frac.prefix;
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
            w: Math.max(isIO ? 100 : 124, Math.ceil(totalW + 36)),
            h: 58,
          };
        }
      }
    }
    const text = this.getNodeText(node);
    const lines = SVG.splitText(text, maxChars);
    const maxL = Math.max(...lines.map((l) => l.length), 0);
    const w = Math.max(isIO ? 100 : 120, maxL * 8.5 + 28);
    const h = Math.max(34, lines.length * 18 + 14);
    return { isFraction: false, lines, w, h };
  }

  layoutPrimitive(node, type) {
    if (type === "start") {
      const r = 11;
      return {
        w: r * 2,
        h: r * 2,
        cx: r,
        render: (x, y) => {
          this.bounds.addCircle(x + r, y + r, r);
          this.elements.push(SVG.umlInitialNode(x + r, y + r, r));
        },
      };
    }
    if (type === "end") {
      const r = 13;
      return {
        w: r * 2,
        h: r * 2,
        cx: r,
        render: (x, y) => {
          this.bounds.addCircle(x + r, y + r, r);
          this.elements.push(SVG.umlFinalNode(x + r, y + r, r));
        },
      };
    }

    const isIO = type === "input" || type === "output";
    const dim = this.calcActionDimensions(node, isIO);
    return {
      w: dim.w,
      h: dim.h,
      cx: dim.w / 2,
      render: (x, y) => {
        const cx = x + dim.w / 2;
        const cy = y + dim.h / 2;
        this.bounds.addRect(x, y, dim.w, dim.h);
        if (dim.isFraction) {
          this.elements.push(
            SVG.fractionRectangle(
              cx,
              cy,
              dim.w,
              dim.h,
              dim.frac.target,
              dim.frac.numText,
              dim.frac.denText,
              {
                isUml: true,
                prefix: dim.frac.prefix,
                suffix: dim.frac.suffix,
              }
            )
          );
        } else {
          this.elements.push(
            SVG.umlAction(cx, cy, dim.w, dim.h, dim.lines, { isIO })
          );
        }
      },
    };
  }

  layoutSeq(items) {
    const valid = items.filter(Boolean);
    if (!valid.length) return { w: 0, h: 0, cx: 0, render: () => {} };
    const gap = this.options.nodeGap;
    const cx = Math.max(...valid.map((item) => item.cx));
    const rightMax = Math.max(...valid.map((item) => item.w - item.cx));
    const totalW = cx + rightMax;
    const yOffsets = [];
    let curY = 0;
    for (let i = 0; i < valid.length; i++) {
      yOffsets.push(curY);
      curY += valid[i].h + (i < valid.length - 1 ? gap : 0);
    }
    const totalH = curY;

    return {
      w: totalW,
      h: totalH,
      cx: cx,
      render: (x, y) => {
        const axisX = x + cx;
        for (let i = 0; i < valid.length; i++) {
          const item = valid[i];
          const itemX = axisX - item.cx;
          const itemY = y + yOffsets[i];
          item.render(itemX, itemY);
          if (i < valid.length - 1) {
            const nextItemY = y + yOffsets[i + 1];
            this.bounds.addPoint(axisX, itemY + item.h);
            this.bounds.addPoint(axisX, nextItemY);
            this.elements.push(
              SVG.line(axisX, itemY + item.h, axisX, nextItemY, true, "arrow-uml")
            );
          }
        }
      },
    };
  }

  layoutIf(node) {
    const condText = node.condition;
    const thenLayout = this.layoutNodeList(node.thenBranch || []);
    const hasElse = node.elseBranch && node.elseBranch.length > 0;
    const elseLayout = hasElse
      ? this.layoutNodeList(node.elseBranch)
      : { w: 0, h: 0, cx: 0, render: () => {} };

    const branches = [
      {
        label: "[інакше]",
        layout: elseLayout,
      },
      {
        label: this.formatGuard(condText),
        layout: thenLayout,
      },
    ];

    const gap = this.options.nodeGap;
    const dw = this.options.diamondSize || 24;
    const dh = this.options.diamondSize || 24;
    const branchSpacing = 34;

    const b0W = branches[0].layout.w > 0 ? branches[0].layout.w : Math.max(36, dw / 2 + 10);
    const b0Cx = branches[0].layout.w > 0 ? branches[0].layout.cx : b0W / 2;
    const b1W = branches[1].layout.w;
    const b1Cx = branches[1].layout.cx;

    let i0 = 0;
    let i1 = b0W + branchSpacing;
    let c0 = i0 + b0Cx;
    let c1 = i1 + b1Cx;

    const needed = dw + branchSpacing - (c1 - c0);
    if (needed > 0) {
      i1 += needed;
      c1 += needed;
    }
    const r = i1 + b1W;

    const diamondX = (c0 + c1) / 2;
    const vShift = -Math.min(0, diamondX - dw / 2);
    const totalW = Math.max(r, diamondX + dw / 2) + vShift;
    const topGap = dh + gap;
    const maxBranchH = Math.max(branches[0].layout.h, branches[1].layout.h);
    const mSize = this.options.mergeDiamondSize || dw;
    const mergeDiamondR = mSize / 2;
    const mergeY = topGap + maxBranchH + gap + mergeDiamondR;
    const totalH = mergeY + mergeDiamondR;
    const totalCx = diamondX + vShift;

    return {
      w: totalW,
      h: totalH,
      cx: totalCx,
      render: (ox, oy) => {
        const k = ox + totalCx;
        const topY = oy;
        const tt = topY + dh / 2;
        const marker = "arrow-uml";

        // Decision Diamond (empty inside)
        this.bounds.addRect(k - dw / 2, topY, dw, dh);
        this.elements.push(SVG.umlDiamond(k, tt, dw));

        const centers = [c0, c1];
        const iOffsets = [i0, i1];

        branches.forEach((branch, S) => {
          const branchX = ox + vShift + centers[S];
          const branchTopY = topY + topGap;
          const diamondExitX = k + (S === 1 ? dw / 2 : -dw / 2);

          // Top branch line
          const branchPts = [
            [diamondExitX, tt],
            [branchX, tt],
            [branchX, branchTopY],
          ];
          branchPts.forEach(([px, py]) => this.bounds.addPoint(px, py));
          this.elements.push(SVG.polyline(branchPts, true, marker));

          // Guard label near diamond exit
          const labelX = k + (S === 1 ? dw / 2 + 8 : -dw / 2 - 8);
          const labelAnchor = S === 1 ? "start" : "end";
          this.bounds.addText(labelX, tt - 7, branch.label, { anchor: labelAnchor, size: 12 });
          this.elements.push(
            SVG.label(labelX, tt - 7, branch.label, {
              anchor: labelAnchor,
              size: 12,
              weight: "600",
            })
          );

          // Render branch content
          if (branch.layout.w > 0 || branch.layout.h > 0) {
            branch.layout.render(ox + vShift + iOffsets[S], branchTopY);
          }

          // Bottom line from branch to merge diamond
          const branchBottomY = branchTopY + branch.layout.h;
          const targetX = S === 0 ? k - mergeDiamondR : k + mergeDiamondR;
          const targetY = topY + mergeY;

          if (Math.abs(branchX - targetX) < 1) {
            this.bounds.addPoint(branchX, branchBottomY);
            this.bounds.addPoint(targetX, targetY);
            this.elements.push(SVG.line(branchX, branchBottomY, targetX, targetY, true, marker));
          } else {
            const bottomPts = [
              [branchX, branchBottomY],
              [branchX, targetY],
              [targetX, targetY],
            ];
            bottomPts.forEach(([px, py]) => this.bounds.addPoint(px, py));
            this.elements.push(SVG.polyline(bottomPts, true, marker));
          }
        });

        // Merge Diamond
        const mSize = this.options.mergeDiamondSize || dw;
        this.bounds.addRect(k - mSize / 2, topY + mergeY - mSize / 2, mSize, mSize);
        this.elements.push(SVG.umlDiamond(k, topY + mergeY, mSize));
      },
    };
  }

  layoutWhile(stmt) {
    const condText = stmt.condition;
    const bodyItems = (stmt.body || []).slice();
    if (stmt.step) {
      bodyItems.push({ type: "process", text: stmt.step });
    }
    const gap = this.options.nodeGap;
    const dSize = this.options.diamondSize || 24;
    const mSize = this.options.mergeDiamondSize || dSize;
    const guard = this.formatGuard(condText);

    // If bodyItems has 2 statements and neither is branching/nested loop (standard Lab 4.1 loop: [action, step])
    const isComplex = bodyItems.some(
      (b) =>
        b.type === "if" ||
        b.type === "switch" ||
        b.type === "while" ||
        b.type === "for" ||
        b.type === "do_while"
    );

    if (bodyItems.length === 2 && !isComplex) {
      const actionLayout = this.layoutStatement(bodyItems[0]);
      const stepLayout = this.layoutStatement(bodyItems[1]);

      const mergeCy = Math.max(mSize / 2, stepLayout.h / 2) + 4;
      const arrowGap = 24;
      const decCy = mergeCy + stepLayout.h / 2 + arrowGap + actionLayout.h / 2;
      const totalH = Math.max(decCy + dSize / 2, decCy + actionLayout.h / 2) + gap;

      const axisX = Math.max(mSize / 2, dSize / 2) + 20;
      // Size branchSpacing so the guard label fits cleanly without excess empty space
      const guardW = guard.length * 6.0 + 8;
      const branchSpacing = Math.max(52, Math.round(guardW));

      const actLeft = axisX + dSize / 2 + branchSpacing;
      const actionW = actionLayout.w;
      const stepW = stepLayout.w;

      // Position step neatly above action, aligned with left-center of action:
      const stepOffset = Math.max(16, Math.min((actionW - stepW) / 2, 40));
      const stepLeft = actLeft + (actionW > stepW ? stepOffset : 0);
      const stepCx = stepLeft + stepW / 2;

      const rightEdge = Math.max(actLeft + actionW, stepLeft + stepW);
      const totalW = rightEdge + 16;

      return {
        w: totalW,
        h: totalH,
        cx: axisX,
        render: (ox, oy) => {
          const k = ox + axisX;
          const marker = "arrow-uml";

          // Top Merge Diamond
          this.bounds.addRect(k - mSize / 2, oy + mergeCy - mSize / 2, mSize, mSize);
          this.elements.push(SVG.umlDiamond(k, oy + mergeCy, mSize));

          // Vertical line from Merge Diamond down to Decision Diamond
          this.bounds.addPoint(k, oy + mergeCy + mSize / 2);
          this.bounds.addPoint(k, oy + decCy - dSize / 2);
          this.elements.push(SVG.line(k, oy + mergeCy + mSize / 2, k, oy + decCy - dSize / 2, true, marker));

          // Decision Diamond
          this.bounds.addRect(k - dSize / 2, oy + decCy - dSize / 2, dSize, dSize);
          this.elements.push(SVG.umlDiamond(k, oy + decCy, dSize));

          // Straight down exit from Decision Diamond to totalH
          this.bounds.addPoint(k, oy + decCy + dSize / 2);
          this.bounds.addPoint(k, oy + totalH);
          this.elements.push(SVG.line(k, oy + decCy + dSize / 2, k, oy + totalH, false, marker));

          // Branch to action on the right
          const actRenderX = ox + actLeft;
          const actY = oy + decCy;

          // Guard label above horizontal branch
          const labelX = k + dSize / 2 + 5;
          const labelY = oy + decCy - 7;
          this.bounds.addText(labelX, labelY, guard, { anchor: "start", size: 11 });
          this.elements.push(SVG.label(labelX, labelY, guard, { anchor: "start", size: 11, weight: "600" }));

          // Arrow from Decision right vertex to action left edge
          this.bounds.addPoint(k + dSize / 2, oy + decCy);
          this.bounds.addPoint(actRenderX, oy + decCy);
          this.elements.push(SVG.line(k + dSize / 2, oy + decCy, actRenderX, oy + decCy, true, marker));

          // Render action
          actionLayout.render(actRenderX, actY - actionLayout.h / 2);

          // Arrow up from action to step
          const stepRenderX = ox + stepLeft;
          const stepY = oy + mergeCy;
          const actTop = actY - actionLayout.h / 2;
          const stepBottom = stepY + stepLayout.h / 2;
          const arrowUpX = ox + stepCx;

          this.bounds.addPoint(arrowUpX, actTop);
          this.bounds.addPoint(arrowUpX, stepBottom);
          this.elements.push(SVG.line(arrowUpX, actTop, arrowUpX, stepBottom, true, marker));

          // Render step
          stepLayout.render(stepRenderX, stepY - stepLayout.h / 2);

          // Arrow left from step to Merge Diamond right vertex
          this.bounds.addPoint(stepRenderX, oy + mergeCy);
          this.bounds.addPoint(k + mSize / 2, oy + mergeCy);
          this.elements.push(SVG.line(stepRenderX, oy + mergeCy, k + mSize / 2, oy + mergeCy, true, marker));
        },
      };
    }

    // General While Loop (for 1 statement, complex bodies with branching, or arbitrary statements):
    const bodyLayout = this.layoutNodeList(bodyItems);

    const bodyLeftSpan = bodyLayout.cx;
    const bodyRightSpan = bodyLayout.w - bodyLayout.cx;

    const exitMarginLeft = 32;
    const loopMarginRight = 32;

    const innerLeft = Math.max(dSize / 2 + 20, bodyLeftSpan + exitMarginLeft);
    const innerRight = Math.max(dSize / 2 + 20, bodyRightSpan + loopMarginRight);
    const totalW = innerLeft + innerRight;
    const axisX = innerLeft;

    const mergeCy = mSize / 2;
    const decCy = mergeCy + mSize / 2 + gap + dSize / 2;
    const bodyTopY = decCy + dSize / 2 + gap;
    const bodyBottomY = bodyTopY + bodyLayout.h;
    const exitY = bodyBottomY + 16;
    const totalH = exitY + gap;

    return {
      w: totalW,
      h: totalH,
      cx: axisX,
      render: (ox, oy) => {
        const k = ox + axisX;
        const marker = "arrow-uml";

        // 1. Top Merge Diamond
        this.bounds.addRect(k - mSize / 2, oy + mergeCy - mSize / 2, mSize, mSize);
        this.elements.push(SVG.umlDiamond(k, oy + mergeCy, mSize));

        // Line from Merge Diamond down to Decision Diamond
        this.bounds.addPoint(k, oy + mergeCy + mSize / 2);
        this.bounds.addPoint(k, oy + decCy - dSize / 2);
        this.elements.push(SVG.line(k, oy + mergeCy + mSize / 2, k, oy + decCy - dSize / 2, true, marker));

        // 2. Decision Diamond
        this.bounds.addRect(k - dSize / 2, oy + decCy - dSize / 2, dSize, dSize);
        this.elements.push(SVG.umlDiamond(k, oy + decCy, dSize));

        // 3. TRUE branch: Straight down into body
        const trueLineBottomY = oy + bodyTopY;
        this.bounds.addPoint(k, oy + decCy + dSize / 2);
        this.bounds.addPoint(k, trueLineBottomY);
        this.elements.push(SVG.line(k, oy + decCy + dSize / 2, k, trueLineBottomY, true, marker));

        // Guard label on TRUE branch (down)
        const guardLabelX = k + 8;
        const guardLabelY = oy + decCy + dSize / 2 + 13;
        this.bounds.addText(guardLabelX, guardLabelY, guard, { anchor: "start", size: 11 });
        this.elements.push(SVG.label(guardLabelX, guardLabelY, guard, { anchor: "start", size: 11, weight: "600" }));

        // 4. Render Body on the central spine
        bodyLayout.render(k - bodyLayout.cx, oy + bodyTopY);

        // 5. Loopback line from bottom of body around the RIGHT to Merge Diamond
        // loopRightX is tightly positioned just right of the rightmost edge of the body:
        const loopRightX = k + bodyRightSpan + 24;
        const loopPts = [
          [k, oy + bodyBottomY],
          [k, oy + bodyBottomY + 12],
          [loopRightX, oy + bodyBottomY + 12],
          [loopRightX, oy + mergeCy],
          [k + mSize / 2, oy + mergeCy],
        ];
        loopPts.forEach(([px, py]) => this.bounds.addPoint(px, py));
        this.elements.push(SVG.polyline(loopPts, true, marker));

        // 6. FALSE branch: Exit from LEFT vertex of Decision Diamond around the body
        const exitLeftX = k - bodyLeftSpan - 20;
        const elseLabel = "[інакше]";
        this.bounds.addText(k - dSize / 2 - 8, oy + decCy - 6, elseLabel, { anchor: "end", size: 11 });
        this.elements.push(SVG.label(k - dSize / 2 - 8, oy + decCy - 6, elseLabel, { anchor: "end", size: 11, weight: "600" }));

        const exitPts = [
          [k - dSize / 2, oy + decCy],
          [exitLeftX, oy + decCy],
          [exitLeftX, oy + exitY],
          [k, oy + exitY],
          [k, oy + totalH],
        ];
        exitPts.forEach(([px, py]) => this.bounds.addPoint(px, py));
        this.elements.push(SVG.polyline(exitPts, false, marker));
      },
    };
  }

  layoutDoWhile(stmt) {
    const condText = stmt.condition;
    const bodyLayout = this.layoutNodeList(stmt.body || []);
    const gap = this.options.nodeGap;
    const dSize = this.options.diamondSize || 24;
    const mSize = this.options.mergeDiamondSize || dSize;
    const guard = this.formatGuard(condText);

    const loopMarginLeft = 20;
    const innerLeft = Math.max(dSize / 2, bodyLayout.cx);
    const innerRight = Math.max(dSize / 2, bodyLayout.w - bodyLayout.cx);
    const loopMarginRight = 36;
    const totalW = loopMarginLeft + innerLeft + innerRight + loopMarginRight;
    const axisX = loopMarginLeft + innerLeft;

    const mergeCy = mSize / 2;
    const bodyTopY = mSize + gap;
    const bodyBottomY = bodyTopY + bodyLayout.h;
    const decCy = bodyBottomY + gap + dSize / 2;
    const totalH = decCy + dSize / 2 + gap;

    return {
      w: totalW,
      h: totalH,
      cx: axisX,
      render: (ox, oy) => {
        const k = ox + axisX;
        const marker = "arrow-uml";

        // Top Merge Diamond
        this.bounds.addRect(k - mSize / 2, oy, mSize, mSize);
        this.elements.push(SVG.umlDiamond(k, oy + mergeCy, mSize));

        // Line to body
        this.bounds.addPoint(k, oy + mSize);
        this.bounds.addPoint(k, oy + bodyTopY);
        this.elements.push(SVG.line(k, oy + mSize, k, oy + bodyTopY, true, marker));

        // Render body
        bodyLayout.render(k - bodyLayout.cx, oy + bodyTopY);

        // Line from body to decision diamond
        this.bounds.addPoint(k, oy + bodyBottomY);
        this.bounds.addPoint(k, oy + decCy - dSize / 2);
        this.elements.push(SVG.line(k, oy + bodyBottomY, k, oy + decCy - dSize / 2, true, marker));

        // Decision Diamond
        this.bounds.addRect(k - dSize / 2, oy + decCy - dSize / 2, dSize, dSize);
        this.elements.push(SVG.umlDiamond(k, oy + decCy, dSize));

        // Loopback around RIGHT to top merge diamond
        const loopRightX = ox + totalW - 8;
        const labelX = k + dSize / 2 + 8;
        this.bounds.addText(labelX, oy + decCy - 6, guard, { anchor: "start", size: 12 });
        this.elements.push(SVG.label(labelX, oy + decCy - 6, guard, { anchor: "start", size: 12, weight: "600" }));

        const loopPts = [
          [k + dSize / 2, oy + decCy],
          [loopRightX, oy + decCy],
          [loopRightX, oy + mergeCy],
          [k + mSize / 2, oy + mergeCy],
        ];
        loopPts.forEach(([px, py]) => this.bounds.addPoint(px, py));
        this.elements.push(SVG.polyline(loopPts, true, marker));

        // Straight down exit from Decision Diamond to totalH
        this.bounds.addPoint(k, oy + decCy + dSize / 2);
        this.bounds.addPoint(k, oy + totalH);
        this.elements.push(SVG.line(k, oy + decCy + dSize / 2, k, oy + totalH, false, marker));
      },
    };
  }

  layoutFor(stmt) {
    const items = [];
    if (stmt.init) {
      items.push({ type: "process", text: stmt.init });
    }
    const forBody = [...(stmt.body || [])];
    if (stmt.step) {
      forBody.push({ type: "process", text: stmt.step });
    }
    items.push({
      type: "while",
      condition: stmt.condition,
      body: forBody,
    });
    return this.layoutNodeList(items);
  }

  layoutSwitch(stmt) {
    const cases = stmt.cases || [];
    const gap = this.options.nodeGap;
    const dw = this.options.diamondSize || 24;
    const dh = this.options.diamondSize || 24;
    const mSize = this.options.mergeDiamondSize || dw;
    const mR = mSize / 2;

    const caseBranches = cases.map((c) => ({
      label: `[ ${c.labels ? c.labels.join(", ") : c.label || "?"} ]`,
      layout: this.layoutNodeList(c.body || []),
    }));

    if (!caseBranches.length) {
      return { w: dw, h: dh, cx: dw / 2, render: (ox, oy) => {
        this.bounds.addRect(ox, oy, dw, dh);
        this.elements.push(SVG.umlDiamond(ox + dw / 2, oy + dh / 2, dw));
      }};
    }

    const branchSpacing = 30;
    let r = 0;
    const iOffsets = [];
    caseBranches.forEach((b) => {
      iOffsets.push(r);
      r += b.layout.w + branchSpacing;
    });
    r -= branchSpacing;

    const centers = caseBranches.map((b, idx) => iOffsets[idx] + b.layout.cx);
    const diamondX = (centers[0] + centers[centers.length - 1]) / 2;
    const vShift = -Math.min(0, diamondX - dw / 2);
    const totalW = Math.max(r, diamondX + dw / 2) + vShift;
    const topGap = dh + gap;
    const maxBranchH = Math.max(...caseBranches.map((b) => b.layout.h), 40);
    const mergeY = topGap + maxBranchH + gap + mR;
    const totalH = mergeY + mR;
    const totalCx = diamondX + vShift;

    return {
      w: totalW,
      h: totalH,
      cx: totalCx,
      render: (ox, oy) => {
        const k = ox + totalCx;
        const topY = oy;
        const tt = topY + dh / 2;
        const marker = "arrow-uml";

        this.bounds.addRect(k - dw / 2, topY, dw, dh);
        this.elements.push(SVG.umlDiamond(k, tt, dw));

        caseBranches.forEach((branch, S) => {
          const branchX = ox + vShift + centers[S];
          const branchTopY = topY + topGap;

          const branchPts = [
            [k, topY + dh],
            [k, topY + dh + 10],
            [branchX, topY + dh + 10],
            [branchX, branchTopY],
          ];
          branchPts.forEach(([px, py]) => this.bounds.addPoint(px, py));
          this.elements.push(SVG.polyline(branchPts, true, marker));

          this.bounds.addText(branchX + 6, branchTopY - 6, branch.label, { anchor: "start", size: 11 });
          this.elements.push(SVG.label(branchX + 6, branchTopY - 6, branch.label, { anchor: "start", size: 11, weight: "600" }));

          if (branch.layout.w > 0 || branch.layout.h > 0) {
            branch.layout.render(ox + vShift + iOffsets[S], branchTopY);
          }

          const branchBottomY = branchTopY + branch.layout.h;
          const targetY = topY + mergeY;
          const targetX = branchX < k - 1 ? k - mR : branchX > k + 1 ? k + mR : k;

          const bottomPts = [
            [branchX, branchBottomY],
            [branchX, targetY],
            [targetX, targetY],
          ];
          bottomPts.forEach(([px, py]) => this.bounds.addPoint(px, py));
          this.elements.push(SVG.polyline(bottomPts, true, marker));
        });

        const mSize = mR * 2;
        this.bounds.addRect(k - mR, topY + mergeY - mR, mSize, mSize);
        this.elements.push(SVG.umlDiamond(k, topY + mergeY, mSize));
      },
    };
  }

  layoutStatement(stmt) {
    if (!stmt) return null;
    switch (stmt.type) {
      case "input":
      case "output":
      case "process":
      case "return":
        return this.layoutPrimitive(stmt, stmt.type);
      case "if":
        return this.layoutIf(stmt);
      case "while":
        return this.layoutWhile(stmt);
      case "do_while":
        return this.layoutDoWhile(stmt);
      case "for":
        return this.layoutFor(stmt);
      case "switch":
        return this.layoutSwitch(stmt);
      default:
        return this.layoutPrimitive(stmt, "process");
    }
  }

  layoutNodeList(list) {
    const items = list.map((s) => this.layoutStatement(s)).filter(Boolean);
    return this.layoutSeq(items);
  }

  layoutConnector(label = "1") {
    const r = 13;
    const w = r * 2 + 10;
    const h = r * 2;
    return {
      w,
      h,
      cx: w / 2,
      render: (ox, oy) => {
        const cx = ox + w / 2;
        const cy = oy + r;
        this.bounds.addRect(cx - r, cy - r, r * 2, r * 2);
        this.elements.push(SVG.connector(cx, cy, label, r));
      },
    };
  }

  shouldUseTwoColumns(ast) {
    let loopCount = 0;
    for (const stmt of ast) {
      if (stmt.type === "while" || stmt.type === "do_while" || stmt.type === "for") {
        loopCount++;
      }
    }
    return loopCount >= 3;
  }

  splitForTwoColumns(ast) {
    const loopIndices = [];
    ast.forEach((stmt, idx) => {
      if (stmt.type === "while" || stmt.type === "do_while" || stmt.type === "for") {
        loopIndices.push(idx);
      }
    });

    let splitIdx = Math.ceil(ast.length / 2);
    if (loopIndices.length >= 3) {
      // For 4 loops (like 4.1), split after the second loop and its following output
      const secondLoopIdx = loopIndices[1];
      for (let i = secondLoopIdx + 1; i < ast.length; i++) {
        if (ast[i].type === "output") {
          splitIdx = i + 1;
          break;
        }
      }
    }

    return {
      col1: ast.slice(0, splitIdx),
      col2: ast.slice(splitIdx),
    };
  }

  splitAstIntoColumns(ast) {
    const hasExplicitSplit = ast.some((stmt) => stmt.type === "split");
    if (hasExplicitSplit) {
      const cols = [];
      let currentStmts = [];
      let splitCounter = 1;

      for (let i = 0; i < ast.length; i++) {
        const stmt = ast[i];
        if (stmt.type === "split") {
          const label = stmt.label || String(splitCounter++);
          cols.push({
            stmts: currentStmts,
            nextConnectorLabel: label,
          });
          currentStmts = [];
        } else {
          currentStmts.push(stmt);
        }
      }
      cols.push({
        stmts: currentStmts,
        nextConnectorLabel: null,
      });
      return cols.filter((c, idx) => c.stmts.length > 0 || idx === cols.length - 1);
    }

    const isTwoColumns =
      this.options.columns === 2 ||
      (this.options.columns !== 1 && this.shouldUseTwoColumns(ast));

    if (isTwoColumns && ast.length >= 4) {
      const { col1, col2 } = this.splitForTwoColumns(ast);
      return [
        { stmts: col1, nextConnectorLabel: "1" },
        { stmts: col2, nextConnectorLabel: null },
      ];
    }

    return [{ stmts: ast, nextConnectorLabel: null }];
  }

  render() {
    this.elements = [];
    this.bounds = new BoundingBox();

    // Filter main's return 0
    const filteredAst = this.ast.filter((stmt, idx) => {
      if (stmt.type === "return" && stmt.isMainZero && idx === this.ast.length - 1) {
        return false;
      }
      return true;
    });

    const isNonMain = this.ast.functionName && this.ast.functionName !== "main";
    let startNode;
    if (isNonMain) {
      const sig = this.ast.functionSignature || this.ast.functionName;
      startNode = this.layoutPrimitive({ type: "process", text: sig }, "process");
    } else {
      startNode = this.layoutPrimitive(null, "start");
    }
    const endNode = this.layoutPrimitive(null, "end");

    const columns = this.splitAstIntoColumns(filteredAst);

    if (columns.length > 1) {
      const startX = 40;
      const startY = 40;
      const colGap = 70;
      let curX = startX;

      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const isFirst = i === 0;
        const isLast = i === columns.length - 1;
        const bodySeq = this.layoutNodeList(col.stmts);

        const colElements = [];
        if (isFirst) {
          colElements.push(startNode);
        } else {
          const prevConnLabel = columns[i - 1].nextConnectorLabel || String(i);
          colElements.push(this.layoutConnector(prevConnLabel));
        }

        colElements.push(bodySeq);

        if (isLast) {
          colElements.push(endNode);
        } else {
          const nextConnLabel = col.nextConnectorLabel || String(i + 1);
          colElements.push(this.layoutConnector(nextConnLabel));
        }

        const colSeq = this.layoutSeq(colElements);
        colSeq.render(curX, startY);
        curX += colSeq.w + colGap;
      }
    } else {
      const bodySeq = this.layoutNodeList(columns[0].stmts);
      const fullSeq = this.layoutSeq([startNode, bodySeq, endNode]);
      fullSeq.render(40, 40);
    }

    const vb = this.bounds.getViewBox(50, 40);
    const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.width} ${vb.height}" width="${vb.width}" height="${vb.height}">
            ${SVG.createDefs()}
            <g id="uml-layer">
                ${this.elements.join("\n")}
            </g>
        </svg>
    `;

    return {
      svg: svgContent,
      width: vb.width,
      height: vb.height,
    };
  }
}

export { UmlRenderer };
export default UmlRenderer;
