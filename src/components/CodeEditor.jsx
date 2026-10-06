import React, { useRef } from 'react';
import { Code2, Heart } from 'lucide-react';
import { LINKS } from '../constants/links.js';
import { trackEvent } from '../utils/analytics.js';

export default function CodeEditor({
    code,
    onChange,
    onClear,
    onGenerate,
    status,
}) {
    const textareaRef = useRef(null);
    const lineNumbersRef = useRef(null);

    const lineCount = code ? code.split('\n').length : 1;
    const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

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
                    <span>
                        Розробив{' '}
                        <a
                            href={LINKS.AUTHOR_WEBSITE}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() =>
                                trackEvent('click_external_link', {
                                    link_name: 'author_website',
                                    url: LINKS.AUTHOR_WEBSITE,
                                })
                            }
                        >
                            Mak5er
                        </a>
                    </span>
                    <span className="credits-dot">•</span>
                    <a
                        href={LINKS.MONOBANK_JAR}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="credits-donate"
                        onClick={() =>
                            trackEvent('click_external_link', {
                                link_name: 'monobank_footer',
                                url: LINKS.MONOBANK_JAR,
                            })
                        }
                    >
                        <Heart size={11} fill="currentColor" /> Донат на mono
                    </a>
                </div>
            </div>
        </section>
    );
}
