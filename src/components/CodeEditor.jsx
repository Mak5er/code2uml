import React, { useRef } from 'react';
import { Code2, Heart, BookOpen } from 'lucide-react';
import { LINKS } from '../constants/links.js';

export default function CodeEditor({
    code,
    onChange,
    onClear,
    onGenerate,
    status,
    presets = [],
    selectedPreset = '',
    onSelectPreset
}) {
    const textareaRef = useRef(null);
    const lineNumbersRef = useRef(null);

    const lineCount = code ? code.split('\n').length : 1;
    const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);
    const categories = Array.from(new Set(presets.map(p => p.category)));

    const handleScroll = () => {
        if (textareaRef.current && lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const textarea = textareaRef.current;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newCode = code.substring(0, start) + '    ' + code.substring(end);
            onChange(newCode);

            // Maintain cursor position after Tab
            setTimeout(() => {
                if (textarea) {
                    textarea.selectionStart = textarea.selectionEnd = start + 4;
                }
            }, 0);
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            onGenerate();
        }
    };

    return (
        <section className="panel-editor">
            <div className="panel-header">
                <div className="panel-title">
                    <Code2 size={15} strokeWidth={2} />
                    <span>C++ Код</span>
                </div>
                <div className="panel-header-actions">
                    {presets && presets.length > 0 && (
                        <div className="preset-selector-container">
                            <BookOpen size={13} className="preset-icon" />
                            <select
                                className="preset-select"
                                value={selectedPreset || ''}
                                onChange={(e) => onSelectPreset && onSelectPreset(e.target.value)}
                                title="Виберіть зразок лабораторної роботи (4.1–4.7)"
                            >
                                <option value="" disabled>Шаблони ЛР</option>
                                {categories.map((cat) => (
                                    <optgroup key={cat} label={cat}>
                                        {presets.filter(p => p.category === cat).map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                    )}
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={onClear}
                        title="Очистити поле коду"
                    >
                        Очистити
                    </button>
                </div>
            </div>

            <div className="code-wrapper">
                <div ref={lineNumbersRef} className="line-numbers">
                    {lineNumbers.map((num) => (
                        <div key={num}>{num}</div>
                    ))}
                </div>
                <textarea
                    ref={textareaRef}
                    className="code-textarea"
                    value={code}
                    onChange={(e) => onChange(e.target.value)}
                    onScroll={handleScroll}
                    onKeyDown={handleKeyDown}
                    spellCheck="false"
                    placeholder="// Вставте або напишіть C++ код сюди... (розрив на колонки: // [split])"
                />
            </div>

            <div className="panel-footer">
                <div className="panel-footer-info">
                    <span className="code-status-text">{status}</span>
                    <span className="supported-text">Підтримує: cin, cout, if-else, switch, while, for, do-while, функції, розрив // [split]</span>
                </div>
                <div className="panel-credits">
                    <span>Розробив <a href={LINKS.AUTHOR_WEBSITE} target="_blank" rel="noopener noreferrer">Mak5er</a></span>
                    <span className="credits-dot">•</span>
                    <a href={LINKS.MONOBANK_JAR} target="_blank" rel="noopener noreferrer" className="credits-donate">
                        <Heart size={11} fill="currentColor" /> Донат на mono
                    </a>
                </div>
            </div>
        </section>
    );
}
