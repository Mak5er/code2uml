import React from 'react';
import { Minus, Plus, RotateCcw, Maximize2 } from 'lucide-react';

export default function CanvasControls({
    zoom,
    onZoomChange,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    onFitToScreen
}) {
    const zoomPercent = Math.round(zoom * 100);

    return (
        <div className="canvas-controls">
            <button
                className="icon-btn"
                onClick={onZoomOut}
                title="Зменшити (-)"
            >
                <Minus size={14} strokeWidth={2.5} />
            </button>

            <div className="zoom-slider-container" title="Масштаб (повзунок)">
                <input
                    type="range"
                    className="zoom-slider"
                    min="20"
                    max="250"
                    step="1"
                    value={zoomPercent}
                    onChange={(e) => onZoomChange(Number(e.target.value) / 100)}
                />
            </div>

            <button
                className="icon-btn"
                onClick={onZoomIn}
                title="Збільшити (+)"
            >
                <Plus size={14} strokeWidth={2.5} />
            </button>

            <span
                className="zoom-indicator"
                onClick={onResetZoom}
                title="Поточний масштаб (клікніть для 100%)"
            >
                {zoomPercent}%
            </span>

            <button
                className="icon-btn"
                onClick={onResetZoom}
                title="Скинути масштаб до 100%"
            >
                <RotateCcw size={14} strokeWidth={2} />
            </button>

            {onFitToScreen && (
                <button
                    className="icon-btn"
                    onClick={onFitToScreen}
                    title="Підігнати діаграми під розмір вікна (Zoom to Fit)"
                >
                    <Maximize2 size={13} strokeWidth={2} />
                </button>
            )}
        </div>
    );
}
