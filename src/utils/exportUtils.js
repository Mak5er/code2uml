/**
 * Utility functions for exporting diagrams as SVG or High-DPI PNG, and copying to clipboard.
 */

export function exportSvg(svgElementOrString, filename = 'diagram.svg') {
    if (!svgElementOrString) {
        throw new Error('Немає діаграми для експорту');
    }

    let svgData;
    if (typeof svgElementOrString === 'string') {
        svgData = svgElementOrString;
    } else {
        svgData = new XMLSerializer().serializeToString(svgElementOrString);
    }

    if (!svgData.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgData = svgData.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    }

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

export function exportPng(svgElement, filename = 'diagram.png', scale = 2.5) {
    return new Promise((resolve, reject) => {
        if (!svgElement) {
            return reject(new Error('Немає діаграми для експорту'));
        }

        const svgData = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const viewBox = svgElement.viewBox?.baseVal;
                const w = (viewBox && viewBox.width) || svgElement.clientWidth || 800;
                const h = (viewBox && viewBox.height) || svgElement.clientHeight || 1000;

                canvas.width = w * scale;
                canvas.height = h * scale;

                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const pngUrl = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = pngUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                resolve();
            } catch (err) {
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

export async function copySvgToClipboard(svgElementOrString) {
    if (!svgElementOrString) {
        throw new Error('Немає діаграми для копіювання');
    }

    let svgData;
    if (typeof svgElementOrString === 'string') {
        svgData = svgElementOrString;
    } else {
        svgData = new XMLSerializer().serializeToString(svgElementOrString);
    }

    await navigator.clipboard.writeText(svgData);
}
