import React, { useState, useRef, useEffect } from 'react';
import { Zap, Download, ChevronDown, FileCode, Image as ImageIcon, Copy, Moon, Sun } from 'lucide-react';

export default function Header({
    onGenerate,
    onExportSvg,
    onExportPng,
    onCopySvg,
    isDark,
    onToggleTheme,
    activeTab
}) {
    const [downloadOpen, setDownloadOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDownloadOpen(false);
            }
        };
        if (downloadOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [downloadOpen]);

    const isBoth = activeTab === 'side-by-side';

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

                {/* Single Download button with Dropdown (SVG or PNG) */}
                <div className="download-dropdown" ref={dropdownRef}>
                    <button
                        className="btn btn-outline"
                        onClick={() => setDownloadOpen((prev) => !prev)}
                        title="Завантажити діаграми (вибір SVG або PNG)"
                        aria-expanded={downloadOpen}
                    >
                        <Download size={14} strokeWidth={2} />
                        <span>Завантажити</span>
                        <ChevronDown
                            size={12}
                            strokeWidth={2}
                            className={`chevron-icon ${downloadOpen ? 'open' : ''}`}
                        />
                    </button>

                    {downloadOpen && (
                        <div className="dropdown-menu">
                            <button
                                className="dropdown-item"
                                onClick={() => {
                                    setDownloadOpen(false);
                                    onExportSvg();
                                }}
                            >
                                <div className="dropdown-item-icon">
                                    <FileCode size={16} strokeWidth={2} />
                                </div>
                                <div className="dropdown-item-text">
                                    <span className="dropdown-item-title">
                                        Векторний SVG {isBoth ? '(2 файли)' : '(.svg)'}
                                    </span>
                                    <span className="dropdown-item-desc">
                                        {isBoth
                                            ? 'Завантажити блок-схему та UML як .svg'
                                            : 'Для звіту / Word без втрати якості'}
                                    </span>
                                </div>
                            </button>

                            <button
                                className="dropdown-item"
                                onClick={() => {
                                    setDownloadOpen(false);
                                    onExportPng();
                                }}
                            >
                                <div className="dropdown-item-icon">
                                    <ImageIcon size={16} strokeWidth={2} />
                                </div>
                                <div className="dropdown-item-text">
                                    <span className="dropdown-item-title">
                                        Зображення PNG {isBoth ? '(2 файли)' : '(.png)'}
                                    </span>
                                    <span className="dropdown-item-desc">
                                        {isBoth
                                            ? 'Завантажити блок-схему та UML (2.5x High-DPI)'
                                            : 'Чітка картинка 2.5x High-DPI'}
                                    </span>
                                </div>
                            </button>
                        </div>
                    )}
                </div>

                <button
                    className="btn btn-outline"
                    onClick={onCopySvg}
                    title="Скопіювати SVG у буфер обміну"
                >
                    <Copy size={14} strokeWidth={2} />
                    <span>Копіювати</span>
                </button>

                <div className="divider-v" />

                {/* Pure icon theme button reflecting current theme */}
                <button
                    className="btn btn-outline btn-icon"
                    onClick={onToggleTheme}
                    title={isDark ? 'Поточна тема: Темна (клікніть для світлої)' : 'Поточна тема: Світла (клікніть для темної)'}
                    aria-label="Перемкнути тему"
                >
                    {isDark ? (
                        <Moon size={16} strokeWidth={2} className="theme-icon-active" />
                    ) : (
                        <Sun size={16} strokeWidth={2} className="theme-icon-active" />
                    )}
                </button>
            </div>
        </header>
    );
}
