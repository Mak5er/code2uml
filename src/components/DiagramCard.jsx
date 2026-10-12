import React, { useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyPngToClipboard } from '../utils/exportUtils.js';

export default function DiagramCard({
    id,
    title,
    badge,
    svgContent,
    emptyMessage,
    onDownloadSvg,
    onDownloadPng,
    innerRef,
    extraActions,
    onEdit,
    onToast
}) {
    const localContentRef = useRef(null);
    const contentRef = innerRef || localContentRef;
    const [copied, setCopied] = useState(false);

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

    const handleCopy = async () => {
        const svgEl = contentRef.current ? contentRef.current.querySelector('svg') : null;
        if (!svgEl) return;
        try {
            await copyPngToClipboard(svgEl);
            setCopied(true);
            if (onToast) onToast('Діаграму скопійовано в буфер! Вставте у Word (Ctrl+V)');
            setTimeout(() => setCopied(false), 2200);
        } catch (err) {
            console.error('Copy PNG failed:', err);
            if (onToast) onToast('Не вдалося скопіювати в буфер (потрібен HTTPS/сучасний браузер)');
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
                    {extraActions}
                    {onEdit && (
                        <button
                            className="btn-card-action btn-card-edit"
                            onClick={onEdit}
                            title={`Редагувати блоки схеми (${title})`}
                        >
                            ✏️ Редагувати
                        </button>
                    )}
                    <button
                        className={`btn-card-action btn-card-copy ${copied ? 'copied' : ''}`}
                        onClick={handleCopy}
                        title={`Скопіювати зображення (${title}) у буфер обміну для Word / Docs (Ctrl+V)`}
                    >
                        {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                        <span>{copied ? 'Скопійовано!' : 'Буфер'}</span>
                    </button>
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
