/**
 * SVG Helper utilities for Flowcharts and UML Activity Diagrams
 * Produces crisp, publication-quality vector diagrams matching academic standards.
 */

const SVG = {
    createDefs() {
        return `
        <defs>
            <!-- Crisp Engineering Arrow Head -->
            <marker id="arrow-flow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 1 2 L 10 6 L 1 10 z" fill="#1e293b" />
            </marker>
            <marker id="arrow-uml" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                <path d="M 1 2 L 10 6 L 1 10 z" fill="#1e293b" />
            </marker>
            <!-- Drop shadow for diagram cards -->
            <filter id="soft-shadow" x="-5%" y="-5%" width="110%" height="110%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.04"/>
            </filter>
        </defs>
        `;
    },

    splitText(str, maxChars = 38) {
        if (!str) return [''];
        if (Array.isArray(str)) return str;
        const raw = String(str).trim();
        if (raw.length <= maxChars) return [raw];

        const parts = [];
        let remaining = raw;

        while (remaining.length > maxChars) {
            const searchSub = remaining.slice(0, maxChars + 12);
            let splitIdx = -1;

            // 1. Logical operators: && or ||
            const opMatch = searchSub.match(/^(.*?)(\s*(?:&&|\|\|)\s*)/);
            if (opMatch && opMatch[1].length >= 6 && (opMatch[1].length + opMatch[2].length) <= maxChars + 12) {
                splitIdx = opMatch[1].length + opMatch[2].length;
            } else {
                // 2. Space separator (natural word break)
                const lastSpace = searchSub.slice(0, maxChars + 2).lastIndexOf(' ');
                if (lastSpace >= Math.floor(maxChars * 0.45)) {
                    splitIdx = lastSpace + 1;
                } else {
                    // 3. Comma or semicolon
                    const scMatch = searchSub.match(/^(.*?[;,]\s*)/);
                    if (scMatch && scMatch[1].length >= 6) {
                        splitIdx = scMatch[1].length;
                    } else {
                        // 4. Binary or assignment operators
                        const binMatch = searchSub.match(/^(.*?)([+\-*/=]\s*)/);
                        if (binMatch && binMatch[1].length >= 6) {
                            splitIdx = binMatch[1].length + binMatch[2].length;
                        } else {
                            splitIdx = maxChars;
                        }
                    }
                }
            }

            parts.push(remaining.slice(0, splitIdx).trim());
            remaining = remaining.slice(splitIdx).trim();
        }

        if (remaining.length > 0) {
            parts.push(remaining);
        }
        return parts;
    },

    renderTextLines(cx, cy, text, options = {}) {
        const lines = Array.isArray(text) ? text : this.splitText(text, options.maxChars || 30);
        const fontSize = options.size || 13;
        const lineHeight = options.lineHeight || 17;
        const textColor = options.textColor || '#0f172a';
        const weight = options.weight || '500';
        const family = options.family || "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
        const letterSpacing = options.letterSpacing ? ` letter-spacing="${options.letterSpacing}"` : '';

        if (!lines || lines.length <= 1) {
            const txt = (lines && lines.length === 1) ? lines[0] : '';
            return `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
                fill="${textColor}" font-family="${family}" font-size="${fontSize}" font-weight="${weight}"${letterSpacing}>${this.escapeXml(txt)}</text>`;
        }

        const startY = cy - ((lines.length - 1) * lineHeight) / 2;
        const tspans = lines.map((line, idx) => {
            const y = startY + idx * lineHeight;
            return `<tspan x="${cx}" y="${y}">${this.escapeXml(line)}</tspan>`;
        }).join('\n            ');

        return `<text x="${cx}" y="${startY}" text-anchor="middle" dominant-baseline="central"
            fill="${textColor}" font-family="${family}" font-size="${fontSize}" font-weight="${weight}"${letterSpacing}>
            ${tspans}
        </text>`;
    },

    // 1. Stadium (Start / End: "початок", "кінець")
    stadium(cx, cy, width, height, text, options = {}) {
        const x = cx - width / 2;
        const y = cy - height / 2;
        const r = height / 2;
        const strokeColor = options.stroke || '#1e293b';
        const fillColor = options.fill || '#ffffff';
        const textSvg = this.renderTextLines(cx, cy, text, {
            textColor: options.textColor || '#0f172a',
            weight: '600',
            size: 13.5,
            letterSpacing: '0.2px'
        });

        return `
        <g class="diagram-node stadium-node">
            <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${r}" ry="${r}"
                fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.8" filter="url(#soft-shadow)"/>
            ${textSvg}
        </g>
        `;
    },

    // 2. Parallelogram (Input: cin >> x)
    parallelogram(cx, cy, width, height, text, options = {}) {
        const slant = 16;
        const x1 = cx - width / 2 + slant;
        const y1 = cy - height / 2;
        const x2 = cx + width / 2;
        const y2 = y1;
        const x3 = cx + width / 2 - slant;
        const y3 = cy + height / 2;
        const x4 = cx - width / 2;
        const y4 = y3;

        const strokeColor = options.stroke || '#1e293b';
        const fillColor = options.fill || '#ffffff';
        const textSvg = this.renderTextLines(cx, cy, text, {
            textColor: options.textColor || '#0f172a',
            size: 13.5
        });

        const points = `${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`;
        return `
        <g class="diagram-node input-node">
            <polygon points="${points}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.8" stroke-linejoin="round" filter="url(#soft-shadow)"/>
            ${textSvg}
        </g>
        `;
    },

    // 3. Rectangle (Process / Assignment: A = x*x)
    rectangle(cx, cy, width, height, text, options = {}) {
        const x = cx - width / 2;
        const y = cy - height / 2;
        const strokeColor = options.stroke || '#1e293b';
        const fillColor = options.fill || '#ffffff';
        const textSvg = this.renderTextLines(cx, cy, text, {
            textColor: options.textColor || '#0f172a',
            size: 13.5
        });

        return `
        <g class="diagram-node process-node">
            <rect x="${x}" y="${y}" width="${width}" height="${height}"
                fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.8" stroke-linejoin="miter" filter="url(#soft-shadow)"/>
            ${textSvg}
        </g>
        `;
    },

    // 3b. Fraction Rectangle (Mathematical fraction: A = num / den)
    fractionRectangle(cx, cy, width, height, target, numText, denText, options = {}) {
        const x = cx - width / 2;
        const y = cy - height / 2;
        const strokeColor = options.stroke || '#1e293b';
        const fillColor = options.fill || '#ffffff';
        const textColor = options.textColor || '#0f172a';

        const charW = 8.2;
        const prefix = options.prefix || '';
        const suffix = options.suffix || '';
        const leftText = target ? `${target} = ${prefix}` : prefix;
        const leftW = leftText ? leftText.length * charW : 0;
        const rightW = suffix ? suffix.length * charW : 0;
        const numW = numText.length * 8.0;
        const denW = denText.length * 8.0;
        const barW = Math.max(numW, denW) + 16;
        const totalW = leftW + (leftW > 0 ? 6 : 0) + barW + (rightW > 0 ? 6 : 0) + rightW;

        const startX = cx - totalW / 2;
        const leftX = startX + leftW / 2;
        const fracCenterX = startX + leftW + (leftW > 0 ? 6 : 0) + barW / 2;
        const barX1 = fracCenterX - barW / 2;
        const barX2 = fracCenterX + barW / 2;
        const rightX = fracCenterX + barW / 2 + (rightW > 0 ? 6 : 0) + rightW / 2;

        let contentSvg = '';
        if (leftText) {
            contentSvg += `<text x="${leftX}" y="${cy}" text-anchor="middle" dominant-baseline="central"
                font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="13.5" font-weight="500" fill="${textColor}">${this.escapeXml(leftText)}</text>`;
        }
        contentSvg += `<text x="${fracCenterX}" y="${cy - 11}" text-anchor="middle" dominant-baseline="central"
            font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="${textColor}">${this.escapeXml(numText)}</text>`;
        contentSvg += `<line x1="${barX1}" y1="${cy}" x2="${barX2}" y2="${cy}" stroke="${strokeColor}" stroke-width="1.6" stroke-linecap="round" />`;
        contentSvg += `<text x="${fracCenterX}" y="${cy + 12}" text-anchor="middle" dominant-baseline="central"
            font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="${textColor}">${this.escapeXml(denText)}</text>`;
        if (suffix) {
            contentSvg += `<text x="${rightX}" y="${cy}" text-anchor="middle" dominant-baseline="central"
                font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="13.5" font-weight="500" fill="${textColor}">${this.escapeXml(suffix)}</text>`;
        }

        const isUml = options.isUml;
        const rx = isUml ? 15 : 0;
        const ry = isUml ? 15 : 0;

        return `
        <g class="diagram-node process-node fraction-node">
            <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" ry="${ry}"
                fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.8" filter="url(#soft-shadow)"/>
            ${contentSvg}
        </g>
        `;
    },

    // 4. Rhombus / Diamond (Decision: x < 0)
    rhombus(cx, cy, width, height, text, options = {}) {
        const pTop = `${cx},${cy - height / 2}`;
        const pRight = `${cx + width / 2},${cy}`;
        const pBottom = `${cx},${cy + height / 2}`;
        const pLeft = `${cx - width / 2},${cy}`;

        const strokeColor = options.stroke || '#1e293b';
        const fillColor = options.fill || '#ffffff';
        const textSvg = this.renderTextLines(cx, cy, text, {
            textColor: options.textColor || '#0f172a',
            size: 13,
            maxChars: 26
        });

        return `
        <g class="diagram-node condition-node">
            <polygon points="${pTop} ${pRight} ${pBottom} ${pLeft}"
                fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.8" stroke-linejoin="miter" filter="url(#soft-shadow)"/>
            ${textSvg}
        </g>
        `;
    },

    // 5. Document Symbol (Output: cout << y)
    // Smooth S-curve at bottom matching Slide 2 & 7
    document(cx, cy, width, height, text, options = {}) {
        const x = cx - width / 2;
        const y = cy - height / 2;
        const w = width;
        const h = height;
        const waveH = 7;

        // Path: Top left -> Top right -> Bottom right -> Smooth wave to bottom left -> Close
        const d = `
            M ${x},${y}
            L ${x + w},${y}
            L ${x + w},${y + h - waveH}
            C ${x + w * 0.72},${y + h + waveH * 0.9} ${x + w * 0.28},${y + h - waveH * 2.1} ${x},${y + h - waveH}
            Z
        `.trim();

        const strokeColor = options.stroke || '#1e293b';
        const fillColor = options.fill || '#ffffff';
        const textSvg = this.renderTextLines(cx, cy - 3, text, {
            textColor: options.textColor || '#0f172a',
            size: 13.5
        });

        return `
        <g class="diagram-node document-node">
            <path d="${d}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.8" stroke-linejoin="round" filter="url(#soft-shadow)"/>
            ${textSvg}
        </g>
        `;
    },

    // 6. UML Initial Node (Filled circle)
    umlInitialNode(cx, cy, r = 11) {
        return `
        <g class="diagram-node uml-initial-node">
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="#0f172a" />
        </g>
        `;
    },

    // 7. UML Final Node (Bullseye: outer stroke + inner solid)
    umlFinalNode(cx, cy, r = 13) {
        return `
        <g class="diagram-node uml-final-node">
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="#0f172a" stroke-width="1.8"/>
            <circle cx="${cx}" cy="${cy}" r="${r * 0.58}" fill="#0f172a" />
        </g>
        `;
    },

    // 8. UML Action Node (Rounded rectangle, rx=15)
    umlAction(cx, cy, width, height, text, options = {}) {
        const x = cx - width / 2;
        const y = cy - height / 2;
        const rx = 15;
        const strokeColor = options.stroke || '#1e293b';
        const fillColor = options.fill || '#ffffff';
        // In Slide 7, input and output have blue text
        const textColor = options.textColor || (options.isIO ? '#1d4ed8' : '#0f172a');
        const textSvg = this.renderTextLines(cx, cy, text, {
            textColor,
            weight: options.isIO ? '600' : '500',
            size: 13.5,
            maxChars: 32
        });

        return `
        <g class="diagram-node uml-action-node">
            <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" ry="${rx}"
                fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.8" filter="url(#soft-shadow)"/>
            ${textSvg}
        </g>
        `;
    },

    // 9. UML Small Diamond (Decision or Merge)
    umlDiamond(cx, cy, size = 20) {
        const hs = size / 2;
        const points = `${cx},${cy - hs} ${cx + hs},${cy} ${cx},${cy + hs} ${cx - hs},${cy}`;
        return `
        <g class="diagram-node uml-diamond-node">
            <polygon points="${points}" fill="#ffffff" stroke="#1e293b" stroke-width="1.8" stroke-linejoin="miter" filter="url(#soft-shadow)"/>
        </g>
        `;
    },

    // Straight line
    line(x1, y1, x2, y2, hasArrow = false, markerType = 'arrow-flow') {
        const marker = hasArrow ? `marker-end="url(#${markerType})"` : '';
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1e293b" stroke-width="1.6" ${marker}/>`;
    },

    // Orthogonal polyline
    polyline(points, hasArrow = false, markerType = 'arrow-flow') {
        const ptsStr = points.map(p => `${p[0]},${p[1]}`).join(' ');
        const marker = hasArrow ? `marker-end="url(#${markerType})"` : '';
        return `<polyline points="${ptsStr}" fill="none" stroke="#1e293b" stroke-width="1.6" stroke-linejoin="miter" ${marker}/>`;
    },

    // Text label (e.g. '+', '-', '[ x<0 ]')
    label(x, y, text, options = {}) {
        const anchor = options.anchor || 'middle';
        const color = options.color || '#0f172a';
        const weight = options.weight || 'bold';
        const size = options.size || 13;
        return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central"
            fill="${color}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            font-size="${size}" font-weight="${weight}" user-select="none">${this.escapeXml(text)}</text>`;
    },

    escapeXml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
};

/**
 * Robust Bounding Box Tracker
 * Guarantees that no diagram element, label, or wire is ever clipped or outside viewBox.
 */
class BoundingBox {
    constructor() {
        this.minX = Infinity;
        this.minY = Infinity;
        this.maxX = -Infinity;
        this.maxY = -Infinity;
    }

    addPoint(x, y) {
        if (x < this.minX) this.minX = x;
        if (y < this.minY) this.minY = y;
        if (x > this.maxX) this.maxX = x;
        if (y > this.maxY) this.maxY = y;
    }

    addRect(x, y, w, h) {
        this.addPoint(x, y);
        this.addPoint(x + w, y + h);
    }

    addCircle(cx, cy, r) {
        this.addPoint(cx - r, cy - r);
        this.addPoint(cx + r, cy + r);
    }

    addText(x, y, text, options = {}) {
        const size = options.size || 13;
        const lines = Array.isArray(text) ? text : String(text || '').split('\n');
        const maxLen = Math.max(...lines.map(l => (l ? String(l).length : 0)), 0);
        const len = maxLen * (size * 0.7);
        const anchor = options.anchor || 'middle';
        let left = x;
        if (anchor === 'middle') left = x - len / 2;
        else if (anchor === 'end') left = x - len;
        const totalHeight = Math.max(size * 1.5, lines.length * (size * 1.3));
        this.addPoint(left, y - totalHeight / 2);
        this.addPoint(left + len, y + totalHeight / 2);
    }

    getViewBox(padX = 45, padY = 35) {
        if (this.minX === Infinity) {
            return { x: 0, y: 0, width: 400, height: 400 };
        }
        const x = Math.floor(this.minX - padX);
        const y = Math.floor(this.minY - padY);
        const width = Math.ceil(this.maxX - this.minX + padX * 2);
        const height = Math.ceil(this.maxY - this.minY + padY * 2);
        return { x, y, width, height };
    }
}

export { SVG, BoundingBox };
export default SVG;
