/**
 * Utility functions for exporting diagrams as SVG or High-DPI PNG, and copying to clipboard.
 */

function parseSvgDimensions(svgData, svgElement = null) {
    let vbX = 0;
    let vbY = 0;
    let w = 0;
    let h = 0;

    if (svgElement && typeof svgElement !== 'string') {
        const vb = svgElement.viewBox?.baseVal;
        if (vb && vb.width > 0 && vb.height > 0) {
            vbX = vb.x;
            vbY = vb.y;
            w = vb.width;
            h = vb.height;
        }
        if (!w || !h) {
            w = parseFloat(svgElement.getAttribute?.('width')) || svgElement.clientWidth || 0;
            h = parseFloat(svgElement.getAttribute?.('height')) || svgElement.clientHeight || 0;
        }
    }

    const vbMatch = svgData.match(/viewBox\s*=\s*["']\s*([-0-9.]+)\s+([-0-9.]+)\s+([-0-9.]+)\s+([-0-9.]+)\s*["']/i);
    if (vbMatch) {
        vbX = parseFloat(vbMatch[1]) || 0;
        vbY = parseFloat(vbMatch[2]) || 0;
        if (!w || !h) {
            w = parseFloat(vbMatch[3]) || 800;
            h = parseFloat(vbMatch[4]) || 600;
        }
    }

    if (!w || !h) {
        const wMatch = svgData.match(/\bwidth\s*=\s*["']\s*([0-9.]+)/i);
        const hMatch = svgData.match(/\bheight\s*=\s*["']\s*([0-9.]+)/i);
        w = (wMatch && parseFloat(wMatch[1])) || 800;
        h = (hMatch && parseFloat(hMatch[1])) || 600;
    }

    return { vbX, vbY, width: Math.ceil(w), height: Math.ceil(h) };
}

function prepareSvgString(svgElementOrString) {
    let svgData = typeof svgElementOrString === 'string'
        ? svgElementOrString
        : new XMLSerializer().serializeToString(svgElementOrString);

    if (!svgData.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgData = svgData.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const dims = parseSvgDimensions(svgData, svgElementOrString);

    // Ensure explicit width/height attributes matching viewBox for standalone PNG rasterizers
    const openTagMatch = svgData.match(/<svg\b[^>]*>/i);
    if (openTagMatch) {
        let openTag = openTagMatch[0];
        if (!/\bwidth\s*=/.test(openTag)) {
            openTag = openTag.replace(/>$/, ` width="${dims.width}">`);
        }
        if (!/\bheight\s*=/.test(openTag)) {
            openTag = openTag.replace(/>$/, ` height="${dims.height}">`);
        }
        if (!/\bviewBox\s*=/.test(openTag)) {
            openTag = openTag.replace(/>$/, ` viewBox="${dims.vbX} ${dims.vbY} ${dims.width} ${dims.height}">`);
        }
        svgData = svgData.replace(openTagMatch[0], openTag);
    }

    // Ensure solid pure white #FFFFFF background rect inside standalone exported SVGs
    if (!svgData.includes('data-role="svg-background"')) {
        const bgRect = `<rect x="${dims.vbX}" y="${dims.vbY}" width="${dims.width}" height="${dims.height}" fill="#FFFFFF" data-role="svg-background"/>`;
        if (svgData.includes('</defs>')) {
            svgData = svgData.replace('</defs>', `</defs>\n${bgRect}`);
        } else {
            svgData = svgData.replace(/<svg\b[^>]*>/i, (m) => `${m}\n${bgRect}`);
        }
    }

    return { svgData, ...dims };
}

export function exportSvg(svgElementOrString, filename = 'diagram.svg') {
    if (!svgElementOrString) {
        throw new Error('Немає діаграми для експорту');
    }

    const { svgData } = prepareSvgString(svgElementOrString);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function renderSvgToCanvas(svgElementOrString, scale = 2.5) {
    return new Promise((resolve, reject) => {
        const { svgData, width, height } = prepareSvgString(svgElementOrString);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(width * scale));
                canvas.height = Math.max(1, Math.round(height * scale));

                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                URL.revokeObjectURL(url);
                resolve(canvas);
            } catch (err) {
                URL.revokeObjectURL(url);
                reject(err);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Помилка завантаження SVG для PNG рендерингу'));
        };
        img.src = url;
    });
}

export async function exportPng(svgElementOrString, filename = 'diagram.png', scale = 2.5) {
    if (!svgElementOrString) {
        throw new Error('Немає діаграми для експорту');
    }

    const canvas = await renderSvgToCanvas(svgElementOrString, scale);
    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

export async function copySvgToClipboard(svgElementOrString) {
    if (!svgElementOrString) {
        throw new Error('Немає діаграми для копіювання');
    }

    const { svgData } = prepareSvgString(svgElementOrString);
    await navigator.clipboard.writeText(svgData);
}

export async function copyPngToClipboard(svgElementOrString, scale = 2.5) {
    if (!svgElementOrString) {
        throw new Error('Немає діаграми для копіювання');
    }

    const canvas = await renderSvgToCanvas(svgElementOrString, scale);
    const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!pngBlob) {
        throw new Error('Не вдалося створити PNG для буфера');
    }
    if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob })
        ]);
    } else {
        throw new Error('Браузер не підтримує копіювання зображень у буфер');
    }
}

