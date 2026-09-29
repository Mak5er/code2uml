import React from 'react';
import { Zap, Download, Image as ImageIcon, Copy, Moon, Sun } from 'lucide-react';

export default function Header({
    onGenerate,
    onExportSvg,
    onExportPng,
    onCopySvg,
    isDark,
    onToggleTheme
}) {
    return (
        <header className="app-header">
            <div className="brand">
                <div className="brand-icon">C++</div>
                <h1>Генератор блок-схем та UML</h1>
            </div>

            <div className="header-controls">
                <button
                    className="btn btn-primary"
                    onClick={onGenerate}
                    title="Згенерувати діаграми (Ctrl+Enter / Cmd+Enter)"
                >
                    <Zap size={15} strokeWidth={2.5} />
                    <span>Згенерувати</span>
                </button>

                <div className="divider-v" />

                <button
                    className="btn btn-outline"
                    onClick={onExportSvg}
                    title="Зберегти як векторний SVG (для Word / звіту)"
                >
                    <Download size={14} strokeWidth={2} />
                    <span>SVG</span>
                </button>

                <button
                    className="btn btn-outline"
                    onClick={onExportPng}
                    title="Зберегти як чітку картинку PNG (2.5x High-DPI)"
                >
                    <ImageIcon size={14} strokeWidth={2} />
                    <span>PNG</span>
                </button>

                <button
                    className="btn btn-outline"
                    onClick={onCopySvg}
                    title="Скопіювати SVG у буфер обміну"
                >
                    <Copy size={14} strokeWidth={2} />
                    <span>Копіювати</span>
                </button>

                <div className="divider-v" />

                <button
                    className="btn btn-outline theme-toggle-btn"
                    onClick={onToggleTheme}
                    title={isDark ? 'Перемкнути на світлу тему' : 'Перемкнути на темну тему'}
                >
                    {isDark ? (
                        <Sun size={14} strokeWidth={2} />
                    ) : (
                        <Moon size={14} strokeWidth={2} />
                    )}
                    <span>{isDark ? 'Світла' : 'Темна'}</span>
                </button>
            </div>
        </header>
    );
}
