import React, { useRef } from 'react';

export default function DiagramCard({
    id,
    title,
    badge,
    svgContent,
    emptyMessage,
    onDownloadSvg,
    onDownloadPng,
    innerRef
}) {
    const localContentRef = useRef(null);
    const contentRef = innerRef || localContentRef;

    const handleSvgDownload = () => {
        const svgEl = contentRef.current ? contentRef.current.querySelector('svg') : null;
        if (svgEl) {
            onDownloadSvg(svgEl);
        }
    };

    const handlePngDownload = () => {
        const svgEl = contentRef.current ? contentRef.current.querySelector('svg') : null;
        if (svgEl) {
            onDownloadPng(svgEl);
        }
    };

    return (
        <div id={id} className="diagram-card">
            <div className="diagram-card-header">
                <div className="diagram-card-title">
                    <span>{title}</span>
                    {badge && <span className="badge">{badge}</span>}
                </div>
                <div className="card-actions">
                    <button
                        className="btn-card-action"
                        onClick={handleSvgDownload}
                        title={`Завантажити SVG (${title})`}
                    >
                        SVG
                    </button>
                    <button
                        className="btn-card-action"
                        onClick={handlePngDownload}
                        title={`Завантажити PNG (${title})`}
                    >
                        PNG
                    </button>
                </div>
            </div>

            <div ref={contentRef} className="diagram-card-content">
                {svgContent ? (
                    <div
                        className="svg-container"
                        dangerouslySetInnerHTML={{ __html: svgContent }}
                    />
                ) : (
                    <div className="empty-state">
                        {emptyMessage || 'Введіть C++ код для генерації діаграми'}
                    </div>
                )}
            </div>
        </div>
    );
}
