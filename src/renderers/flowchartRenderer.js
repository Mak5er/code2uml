/**
 * Flowchart Generator (Класична університетська блок-схема за ДСТУ/ГОСТ 19.701-90)
 * Strictly conforms to Ukrainian university guidelines (matching uml.pp.ua),
 * using the project's native typography, math expressions, fraction formatting,
 * and GOST 19.701-90 standard shapes and arrow rules.
 */

import { SVG, BoundingBox } from "../utils/svgHelpers.js";
import { toMathExpression, parseFraction } from "../utils/mathFormatter.js";

class FlowchartRenderer {
  constructor(ast, options = {}) {
    this.ast = ast;
    this.options = Object.assign(
      {
        expressionStyle: "original", // 'original' (код) or 'lecture' (вираз_1)
        expressionMode: "cpp", // 'cpp' (C++) or 'math' (математичні формули)
        branchLabels: "plus_minus", // 'plus_minus' (+ / -) or 'yes_no' (Так / Ні)
        arrowRule: "gost", // 'gost' (стрілки за ГОСТ) or 'all' (стрілки на всіх переходах)
        outputShape: "document", // 'document' (wave bottom) or 'parallelogram'
        showDeclarations: false,
        nodeGap: 26,
        startText: null,
      },
      options
    );

    this.elements = [];
    this.bounds = new BoundingBox();
  }

  shouldDrawArrow(dir) {
    if (this.options.arrowRule === "all") return true;
    // GOST 19.701-90: Standard flow is Top->Bottom and Left->Right (NO arrows).
    // Arrows are mandatory when flow is Right->Left ('left'), Bottom->Top ('up'),
    // or entering a line.
    if (dir === "up" || dir === "left") return true;
    return false;
  }

  getNodeText(node) {
    if (!node) return "";
    if (this.options.expressionStyle === "lecture" && node.simplifiedText) {
      return node.simplifiedText;
    }
    let txt = "";
    if (node.type === "output") {
      txt = this.options.ioLabels === "prefix" ? (node.umlText || `вивід ${node.text || "y"}`) : (node.text || "y");
    } else if (node.type === "input") {
      txt = this.options.ioLabels === "prefix" ? (node.umlText || `ввід ${node.text || "x"}`) : (node.text || "x");
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

  calcActionDimensions(node, isIO = false, maxChars = 34) {
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
    const w = Math.max(isIO ? 100 : 120, maxL * 8.5 + (isIO ? 44 : 28));
    const h = Math.max(36, lines.length * 18 + 14);
    return { isFraction: false, lines, w, h };
  }

  calcRhombusDimensions(conditionText) {
    const text = this.getConditionText(conditionText);
    const lines = SVG.splitText(text, 26);
    const maxL = Math.max(...lines.map((l) => l.length), 0);
    const w = Math.max(110, maxL * 8.8 + 48);
    const h = Math.max(50, lines.length * 20 + 26);
    return { lines, w, h };
  }

  layoutPrimitive(node, type) {
    if (type === "start") {
      const w = 110;
      const h = 42;
      const text = this.options.startText || "початок";
      return {
        w,
        h,
        cx: w / 2,
        render: (x, y) => {
          this.bounds.addRect(x, y, w, h);
          this.elements.push(SVG.stadium(x + w / 2, y + h / 2, w, h, text));
        },
      };
    }
    if (type === "end") {
      const w = 110;
      const h = 42;
      return {
        w,
        h,
        cx: w / 2,
        render: (x, y) => {
          this.bounds.addRect(x, y, w, h);
          this.elements.push(SVG.stadium(x + w / 2, y + h / 2, w, h, "кінець"));
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
                isUml: false,
                prefix: dim.frac.prefix,
                suffix: dim.frac.suffix,
              }
            )
          );
        } else if (type === "input") {
          this.elements.push(SVG.parallelogram(cx, cy, dim.w, dim.h, dim.lines));
        } else if (type === "output") {
          if (this.options.outputShape === "parallelogram") {
            this.elements.push(SVG.parallelogram(cx, cy, dim.w, dim.h, dim.lines));
          } else {
            this.elements.push(SVG.document(cx, cy, dim.w, dim.h, dim.lines));
          }
        } else {
          this.elements.push(SVG.rectangle(cx, cy, dim.w, dim.h, dim.lines));
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
              SVG.line(
                axisX,
                itemY + item.h,
                axisX,
                nextItemY,
                this.shouldDrawArrow("down"),
                "arrow-flow"
              )
            );
          }
        }
      },
    };
  }

  flattenIfChain(node) {
    const conditions = [];
    let cur = node;
    while (cur && cur.type === "if") {
      conditions.push({
        condition: cur.condition,
        thenBranch: cur.thenBranch || [],
      });
      if (
        cur.elseBranch &&
        cur.elseBranch.length === 1 &&
        cur.elseBranch[0].type === "if"
      ) {
        cur = cur.elseBranch[0];
      } else {
        return {
          conditions,
          elseBranch: cur.elseBranch || [],
        };
      }
    }
    return {
      conditions,
      elseBranch: [],
    };
  }

  layoutIf(node) {
    const chain = this.flattenIfChain(node);
    if (chain.conditions.length > 1) {
      return this.layoutChainedIf(chain);
    }
    return this.layoutSingleIf(node);
  }

  layoutSingleIf(node) {
    const condText = node.condition;
    const rhDim = this.calcRhombusDimensions(condText);
    const dw = rhDim.w;
    const dh = rhDim.h;

    const thenLayout = this.layoutNodeList(node.thenBranch || []);
    const hasElse = node.elseBranch && node.elseBranch.length > 0;
    const elseLayout = hasElse
      ? this.layoutNodeList(node.elseBranch)
      : { w: 0, h: 0, cx: 0, render: () => {} };

    const plusLabel = this.options.branchLabels === "yes_no" ? "Так" : "+";
    const minusLabel = this.options.branchLabels === "yes_no" ? "Ні" : "−";

    const branches = [
      {
        label: minusLabel,
        layout: elseLayout,
      },
      {
        label: plusLabel,
        layout: thenLayout,
      },
    ];

    const gap = this.options.nodeGap;
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
    const mergeY = topGap + maxBranchH + gap;
    const totalH = mergeY;
    const totalCx = diamondX + vShift;

    return {
      w: totalW,
      h: totalH,
      cx: totalCx,
      render: (ox, oy) => {
        const k = ox + totalCx;
        const topY = oy;
        const tt = topY + dh / 2;
        const marker = "arrow-flow";

        // Condition Rhombus
        this.bounds.addRect(k - dw / 2, topY, dw, dh);
        this.elements.push(SVG.rhombus(k, tt, dw, dh, rhDim.lines));

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
          this.elements.push(
            SVG.polyline(branchPts, this.shouldDrawArrow("down"), marker)
          );

          // Branch label (+ / -) near rhombus exit
          const labelX = k + (S === 1 ? dw / 2 + 10 : -dw / 2 - 10);
          const labelAnchor = S === 1 ? "start" : "end";
          this.bounds.addText(labelX, tt - 7, branch.label, { anchor: labelAnchor, size: 14 });
          this.elements.push(
            SVG.label(labelX, tt - 7, branch.label, {
              anchor: labelAnchor,
              size: 14,
              weight: "bold",
            })
          );

          // Render branch content
          if (branch.layout.w > 0 || branch.layout.h > 0) {
            branch.layout.render(ox + vShift + iOffsets[S], branchTopY);
          }

          // Bottom join line to (k, topY + mergeY)
          const branchBottomY = branchTopY + branch.layout.h;
          const targetY = topY + mergeY;

          if (Math.abs(branchX - k) < 1) {
            this.bounds.addPoint(branchX, branchBottomY);
            this.bounds.addPoint(k, targetY);
            this.elements.push(
              SVG.line(branchX, branchBottomY, k, targetY, false, marker)
            );
          } else {
            const bottomPts = [
              [branchX, branchBottomY],
              [branchX, targetY],
              [k, targetY],
            ];
            bottomPts.forEach(([px, py]) => this.bounds.addPoint(px, py));
            this.elements.push(
              SVG.polyline(bottomPts, false, marker)
            );
          }
        });
      },
    };
  }

  layoutChainedIf(chain) {
    const numConds = chain.conditions.length;
    const gap = this.options.nodeGap;
    const plusLabel = this.options.branchLabels === "yes_no" ? "Так" : "+";
    const minusLabel = this.options.branchLabels === "yes_no" ? "Ні" : "−";

    const rhDims = chain.conditions.map((c) => this.calcRhombusDimensions(c.condition));
    const thenLayouts = chain.conditions.map((c) => this.layoutNodeList(c.thenBranch || []));
    const hasElse = chain.elseBranch && chain.elseBranch.length > 0;
    const elseLayout = hasElse
      ? this.layoutNodeList(chain.elseBranch)
      : { w: 0, h: 0, cx: 0, render: () => {} };

    const colSpacing = 36;
    const elseW = hasElse ? elseLayout.w : 40;
    const elseCx = hasElse ? elseLayout.cx : 20;

    const actionXs = [];
    const actionLeftXs = [];
    const rhXs = [];

    const elseLeftX = 0;
    const elseCenterX = elseCx;
    let curX = elseW + colSpacing;

    const dIdx = numConds - 1;
    const dRhW = rhDims[dIdx].w;
    const dRhX = Math.max(elseCenterX + dRhW / 2 + 20, elseW + 16);
    rhXs[dIdx] = dRhX;

    const dActW = thenLayouts[dIdx].w;
    const dActCx = thenLayouts[dIdx].cx;
    actionLeftXs[dIdx] = Math.max(curX, dRhX + dRhW / 2 + 24);
    actionXs[dIdx] = actionLeftXs[dIdx] + dActCx;
    curX = actionLeftXs[dIdx] + dActW + colSpacing;

    for (let i = dIdx - 1; i >= 0; i--) {
      const rhW = rhDims[i].w;
      rhXs[i] = rhXs[i + 1] + Math.max(rhDims[i + 1].w / 2, rhW / 2) + 36;
      const actW = thenLayouts[i].w;
      const actCx = thenLayouts[i].cx;
      actionLeftXs[i] = Math.max(curX, rhXs[i] + rhW / 2 + 24);
      actionXs[i] = actionLeftXs[i] + actCx;
      curX = actionLeftXs[i] + actW + colSpacing;
    }

    const rhYs = [];
    const rhHeights = rhDims.map((d) => d.h);
    const actTopYs = [];
    const actBottomYs = [];

    let curY = 0;
    for (let i = 0; i < numConds; i++) {
      const rhH = rhHeights[i];
      rhYs[i] = curY + rhH / 2;
      actTopYs[i] = curY + rhH + gap;
      actBottomYs[i] = actTopYs[i] + thenLayouts[i].h;
      curY += rhH + gap + 10;
    }
    const elseTopY = rhYs[dIdx] + rhHeights[dIdx] / 2 + gap;
    const elseBottomY = elseTopY + (hasElse ? elseLayout.h : 0);

    // Single common horizontal merge level without any stepped staircase merges!
    const mergeY = Math.max(...actBottomYs, elseBottomY) + 24;
    const totalH = mergeY;
    const totalW = curX;
    const axisCx = rhXs[0];

    return {
      w: totalW,
      h: totalH,
      cx: axisCx,
      render: (ox, oy) => {
        const marker = "arrow-flow";

        for (let i = 0; i < numConds; i++) {
          const rx = ox + rhXs[i];
          const ry = oy + rhYs[i];
          const rw = rhDims[i].w;
          const rh = rhDims[i].h;

          // Rhombus
          this.bounds.addRect(rx - rw / 2, ry - rh / 2, rw, rh);
          this.elements.push(SVG.rhombus(rx, ry, rw, rh, rhDims[i].lines));

          // '+' branch: goes right to action i
          const actX = ox + actionXs[i];
          const actTopY = oy + actTopYs[i];
          const plusPts = [
            [rx + rw / 2, ry],
            [actX, ry],
            [actX, actTopY],
          ];
          plusPts.forEach(([px, py]) => this.bounds.addPoint(px, py));
          this.elements.push(
            SVG.polyline(plusPts, this.shouldDrawArrow("down"), marker)
          );

          this.bounds.addText(rx + rw / 2 + 10, ry - 7, plusLabel, { anchor: "start", size: 14 });
          this.elements.push(
            SVG.label(rx + rw / 2 + 10, ry - 7, plusLabel, { anchor: "start", size: 14, weight: "bold" })
          );

          thenLayouts[i].render(ox + actionLeftXs[i], actTopY);

          // '-' branch
          if (i < numConds - 1) {
            const nextRx = ox + rhXs[i + 1];
            const nextRy = oy + rhYs[i + 1];
            const nextRhH = rhDims[i + 1].h;
            const minusPts = [
              [rx - rw / 2, ry],
              [nextRx, ry],
              [nextRx, nextRy - nextRhH / 2],
            ];
            minusPts.forEach(([px, py]) => this.bounds.addPoint(px, py));
            this.elements.push(
              SVG.polyline(minusPts, this.shouldDrawArrow("down"), marker)
            );

            this.bounds.addText(rx - rw / 2 - 10, ry - 7, minusLabel, { anchor: "end", size: 14 });
            this.elements.push(
              SVG.label(rx - rw / 2 - 10, ry - 7, minusLabel, { anchor: "end", size: 14, weight: "bold" })
            );
          } else {
            const eX = ox + elseCenterX;
            const eTopY = oy + elseTopY;
            const minusPts = [
              [rx - rw / 2, ry],
              [eX, ry],
              [eX, eTopY],
            ];
            minusPts.forEach(([px, py]) => this.bounds.addPoint(px, py));
            this.elements.push(
              SVG.polyline(minusPts, this.shouldDrawArrow("down"), marker)
            );

            this.bounds.addText(rx - rw / 2 - 10, ry - 7, minusLabel, { anchor: "end", size: 14 });
            this.elements.push(
              SVG.label(rx - rw / 2 - 10, ry - 7, minusLabel, { anchor: "end", size: 14, weight: "bold" })
            );

            if (hasElse) {
              elseLayout.render(ox + elseLeftX, eTopY);
            }
          }
        }

        // ONE SINGLE HORIZONTAL COLLECTOR LINE AT mergeLineY
        const mergeLineY = oy + mergeY;

        for (let i = 0; i < numConds; i++) {
          const ax = ox + actionXs[i];
          const by = oy + actBottomYs[i];
          this.bounds.addPoint(ax, by);
          this.bounds.addPoint(ax, mergeLineY);
          this.elements.push(SVG.line(ax, by, ax, mergeLineY, false, marker));
        }

        const ex = ox + elseCenterX;
        const eby = oy + elseBottomY;
        this.bounds.addPoint(ex, eby);
        this.bounds.addPoint(ex, mergeLineY);
        this.elements.push(SVG.line(ex, eby, ex, mergeLineY, false, marker));

        const allXs = [
          ...Array.from({ length: numConds }, (_, i) => ox + actionXs[i]),
          ex,
        ];
        const minMergeX = Math.min(...allXs);
        const maxMergeX = Math.max(...allXs);

        // One continuous horizontal collector line without any arrowhead in the middle
        this.bounds.addPoint(minMergeX, mergeLineY);
        this.bounds.addPoint(maxMergeX, mergeLineY);
        this.elements.push(
          SVG.line(minMergeX, mergeLineY, maxMergeX, mergeLineY, false, marker)
        );
      },
    };
  }

  layoutWhile(stmt) {
    const condText = stmt.condition;
    const rhDim = this.calcRhombusDimensions(condText);
    const dw = rhDim.w;
    const dh = rhDim.h;

    const bodyItems = (stmt.body || []).slice();
    if (stmt.step) {
      bodyItems.push({ type: "process", text: stmt.step });
    }
    const bodyLayout = this.layoutNodeList(bodyItems);
    const gap = this.options.nodeGap;

    const plusLabel = this.options.branchLabels === "yes_no" ? "Так" : "+";
    const minusLabel = this.options.branchLabels === "yes_no" ? "Ні" : "−";

    const exitMarginLeft = 32;
    const axisX = exitMarginLeft + dw / 2;
    const branchSpacing = 36;
    const bodyCx = axisX + dw / 2 + branchSpacing + bodyLayout.cx;
    const loopRightMargin = 28;
    const totalW = bodyCx + (bodyLayout.w - bodyLayout.cx) + loopRightMargin;

    const decCy = dh / 2 + 10;
    const bodyTopY = decCy + 14;
    const bodyBottomY = bodyTopY + bodyLayout.h;
    const totalH = Math.max(bodyBottomY + 14, decCy + dh / 2 + 20) + gap;

    return {
      w: totalW,
      h: totalH,
      cx: axisX,
      render: (ox, oy) => {
        const k = ox + axisX;
        const marker = "arrow-flow";

        // Vertical line from (k, oy) into top vertex of Rhombus
        this.bounds.addPoint(k, oy);
        this.bounds.addPoint(k, oy + decCy - dh / 2);
        this.elements.push(
          SVG.line(k, oy, k, oy + decCy - dh / 2, this.shouldDrawArrow("down"), marker)
        );

        // Decision Rhombus
        this.bounds.addRect(k - dw / 2, oy + decCy - dh / 2, dw, dh);
        this.elements.push(SVG.rhombus(k, oy + decCy, dw, dh, rhDim.lines));

        // '+' branch exits RIGHT vertex, turns down into top of body
        const bodyX = ox + bodyCx;
        const bodyY = oy + bodyTopY;

        this.bounds.addText(k + dw / 2 + 8, oy + decCy - 6, plusLabel, { anchor: "start", size: 14 });
        this.elements.push(SVG.label(k + dw / 2 + 8, oy + decCy - 6, plusLabel, { anchor: "start", size: 14, weight: "bold" }));

        const plusPts = [
          [k + dw / 2, oy + decCy],
          [bodyX, oy + decCy],
          [bodyX, bodyY],
        ];
        plusPts.forEach(([px, py]) => this.bounds.addPoint(px, py));
        this.elements.push(SVG.polyline(plusPts, this.shouldDrawArrow("down"), marker));

        // Render body
        bodyLayout.render(bodyX - bodyLayout.cx, bodyY);

        // Loopback line from bottom of body around RIGHT, up to oy, then left into k
        const loopRightX = ox + totalW - 8;
        const loopPts = [
          [bodyX, oy + bodyBottomY],
          [bodyX, oy + bodyBottomY + 12],
          [loopRightX, oy + bodyBottomY + 12],
          [loopRightX, oy],
          [k, oy],
        ];
        loopPts.forEach(([px, py]) => this.bounds.addPoint(px, py));
        this.elements.push(SVG.polyline(loopPts, true, marker));

        // '-' branch exits LEFT vertex, goes left to exitLeftX, down to totalH, then right to k
        const exitLeftX = ox + 8;
        this.bounds.addText(k - dw / 2 - 8, oy + decCy - 6, minusLabel, { anchor: "end", size: 14 });
        this.elements.push(SVG.label(k - dw / 2 - 8, oy + decCy - 6, minusLabel, { anchor: "end", size: 14, weight: "bold" }));

        const exitPts = [
          [k - dw / 2, oy + decCy],
          [exitLeftX, oy + decCy],
          [exitLeftX, oy + totalH],
          [k, oy + totalH],
        ];
        exitPts.forEach(([px, py]) => this.bounds.addPoint(px, py));
        this.elements.push(SVG.polyline(exitPts, false, marker));
      },
    };
  }

  layoutDoWhile(stmt) {
    const condText = stmt.condition;
    const rhDim = this.calcRhombusDimensions(condText);
    const dw = rhDim.w;
    const dh = rhDim.h;

    const bodyLayout = this.layoutNodeList(stmt.body || []);
    const gap = this.options.nodeGap;

    const plusLabel = this.options.branchLabels === "yes_no" ? "Так" : "+";
    const minusLabel = this.options.branchLabels === "yes_no" ? "Ні" : "−";

    const exitMarginLeft = 32;
    const innerLeft = Math.max(dw / 2, bodyLayout.cx);
    const innerRight = Math.max(dw / 2, bodyLayout.w - bodyLayout.cx);
    const loopMarginRight = 32;
    const totalW = exitMarginLeft + innerLeft + innerRight + loopMarginRight;
    const axisX = exitMarginLeft + innerLeft;

    const bodyTopY = gap;
    const bodyBottomY = bodyTopY + bodyLayout.h;
    const decCy = bodyBottomY + gap + dh / 2;
    const totalH = decCy + dh / 2 + gap;

    return {
      w: totalW,
      h: totalH,
      cx: axisX,
      render: (ox, oy) => {
        const k = ox + axisX;
        const marker = "arrow-flow";

        // Line to body from (k, oy)
        this.bounds.addPoint(k, oy);
        this.bounds.addPoint(k, oy + bodyTopY);
        this.elements.push(
          SVG.line(k, oy, k, oy + bodyTopY, this.shouldDrawArrow("down"), marker)
        );

        // Render body
        bodyLayout.render(k - bodyLayout.cx, oy + bodyTopY);

        // Line from body to decision rhombus
        this.bounds.addPoint(k, oy + bodyBottomY);
        this.bounds.addPoint(k, oy + decCy - dh / 2);
        this.elements.push(
          SVG.line(
            k,
            oy + bodyBottomY,
            k,
            oy + decCy - dh / 2,
            this.shouldDrawArrow("down"),
            marker
          )
        );

        // Decision Rhombus
        this.bounds.addRect(k - dw / 2, oy + decCy - dh / 2, dw, dh);
        this.elements.push(SVG.rhombus(k, oy + decCy, dw, dh, rhDim.lines));

        // Loopback around RIGHT to top (+)
        const loopRightX = ox + totalW - 8;
        const labelX = k + dw / 2 + 8;
        this.bounds.addText(labelX, oy + decCy - 6, plusLabel, { anchor: "start", size: 14 });
        this.elements.push(SVG.label(labelX, oy + decCy - 6, plusLabel, { anchor: "start", size: 14, weight: "bold" }));

        const loopPts = [
          [k + dw / 2, oy + decCy],
          [loopRightX, oy + decCy],
          [loopRightX, oy],
          [k, oy],
        ];
        loopPts.forEach(([px, py]) => this.bounds.addPoint(px, py));
        this.elements.push(SVG.polyline(loopPts, true, marker));

        // False branch (-) exits left, down, and rejoins at totalH
        const exitLeftX = ox + 8;
        const exitLabelX = k - dw / 2 - 8;
        this.bounds.addText(exitLabelX, oy + decCy - 6, minusLabel, { anchor: "end", size: 14 });
        this.elements.push(SVG.label(exitLabelX, oy + decCy - 6, minusLabel, { anchor: "end", size: 14, weight: "bold" }));

        const exitPts = [
          [k - dw / 2, oy + decCy],
          [exitLeftX, oy + decCy],
          [exitLeftX, oy + totalH],
          [k, oy + totalH],
        ];
        exitPts.forEach(([px, py]) => this.bounds.addPoint(px, py));
        this.elements.push(SVG.polyline(exitPts, false, marker));
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
    const rhDim = this.calcRhombusDimensions(stmt.condition || "switch");
    const dw = rhDim.w;
    const dh = rhDim.h;

    const caseBranches = cases.map((c) => ({
      label: c.labels ? c.labels.join(", ") : c.label || "?",
      layout: this.layoutNodeList(c.body || []),
    }));

    if (!caseBranches.length) {
      return {
        w: dw,
        h: dh,
        cx: dw / 2,
        render: (ox, oy) => {
          this.bounds.addRect(ox, oy, dw, dh);
          this.elements.push(SVG.rhombus(ox + dw / 2, oy + dh / 2, dw, dh, rhDim.lines));
        },
      };
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
    const mergeY = topGap + maxBranchH + gap;
    const totalH = mergeY;
    const totalCx = diamondX + vShift;

    return {
      w: totalW,
      h: totalH,
      cx: totalCx,
      render: (ox, oy) => {
        const k = ox + totalCx;
        const topY = oy;
        const tt = topY + dh / 2;
        const marker = "arrow-flow";

        this.bounds.addRect(k - dw / 2, topY, dw, dh);
        this.elements.push(SVG.rhombus(k, tt, dw, dh, rhDim.lines));

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
          this.elements.push(
            SVG.polyline(branchPts, this.shouldDrawArrow("down"), marker)
          );

          this.bounds.addText(branchX + 6, branchTopY - 6, branch.label, { anchor: "start", size: 11 });
          this.elements.push(SVG.label(branchX + 6, branchTopY - 6, branch.label, { anchor: "start", size: 11, weight: "bold" }));

          if (branch.layout.w > 0 || branch.layout.h > 0) {
            branch.layout.render(ox + vShift + iOffsets[S], branchTopY);
          }

          const branchBottomY = branchTopY + branch.layout.h;
          const targetY = topY + mergeY;

          this.bounds.addPoint(branchX, branchBottomY);
          this.bounds.addPoint(branchX, targetY);
          this.elements.push(
            SVG.line(branchX, branchBottomY, branchX, targetY, false, marker)
          );
        });

        const targetY = topY + mergeY;
        const branchXs = caseBranches.map((_, S) => ox + vShift + centers[S]);
        const minX = Math.min(...branchXs, k);
        const maxX = Math.max(...branchXs, k);
        this.bounds.addPoint(minX, targetY);
        this.bounds.addPoint(maxX, targetY);
        this.elements.push(
          SVG.line(minX, targetY, maxX, targetY, false, marker)
        );
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

    const startNode = this.layoutPrimitive(null, "start");
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
            <g id="flowchart-layer">
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

export { FlowchartRenderer };
export default FlowchartRenderer;
