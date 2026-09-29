import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import CodeEditor from './components/CodeEditor';
import ViewerPanel from './components/ViewerPanel';
import Toast from './components/Toast';
import { DEFAULT_CODE } from './constants/defaultCode';
import { parseCppCode } from './parser/cppParser';
import { FlowchartRenderer } from './renderers/flowchartRenderer';
import { UmlRenderer } from './renderers/umlRenderer';
import { exportSvg, exportPng, copySvgToClipboard } from './utils/exportUtils';
import './App.css';

function compileCode(sourceCode) {
    const trimmed = (sourceCode || '').trim();
    if (!trimmed) {
        return {
            flowchartSvg: '',
            umlSvg: '',
            status: 'Поле коду порожнє',
            count: 0
        };
    }
    const ast = parseCppCode(trimmed, { arrowRule: 'all' });
    const fcRenderer = new FlowchartRenderer(ast, { arrowRule: 'all' });
    const fcResult = fcRenderer.render();
    const umlRenderer = new UmlRenderer(ast);
    const umlResult = umlRenderer.render();
    return {
        flowchartSvg: fcResult.svg,
        umlSvg: umlResult.svg,
        status: `✓ Готово: розібрано ${ast.length} операторів`,
        count: ast.length
    };
}

export default function App() {
    const [code, setCode] = useState(DEFAULT_CODE);

    // Initial diagrams rendered synchronously before first paint
    const [initialState] = useState(() => {
        try {
            return compileCode(DEFAULT_CODE);
        } catch {
            return { flowchartSvg: '', umlSvg: '', status: 'Готово до аналізу', count: 0 };
        }
    });

    const [status, setStatus] = useState(initialState.status);
    const [flowchartSvg, setFlowchartSvg] = useState(initialState.flowchartSvg);
    const [umlSvg, setUmlSvg] = useState(initialState.umlSvg);
    const [activeTab, setActiveTab] = useState('side-by-side');
    const [toast, setToast] = useState({ message: '', isVisible: false });

    // Theme state (checks localStorage and system preference)
    const [isDark, setIsDark] = useState(() => {
        try {
            const saved = localStorage.getItem('theme');
            if (saved) return saved === 'dark';
            return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        } catch {
            return false;
        }
    });

    const flowchartRef = useRef(null);
    const umlRef = useRef(null);
    const debounceTimerRef = useRef(null);

    // Apply theme class to <html>
    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        try {
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        } catch {}
    }, [isDark]);

    const showToast = useCallback((message) => {
        setToast({ message, isVisible: true });
        setTimeout(() => {
            setToast((prev) => ({ ...prev, isVisible: false }));
        }, 3000);
    }, []);

    const toggleTheme = () => {
        setIsDark((prev) => {
            const next = !prev;
            showToast(next ? 'Увімкнено темну тему' : 'Увімкнено світлу тему');
            return next;
        });
    };

    // Diagram compilation
    const generateDiagrams = useCallback((sourceCode, silent = false) => {
        const trimmed = (sourceCode || '').trim();
        if (!trimmed) {
            setFlowchartSvg('');
            setUmlSvg('');
            setStatus('Поле коду порожнє');
            if (!silent) showToast('Введіть або вставте C++ код');
            return;
        }

        try {
            const res = compileCode(trimmed);
            setFlowchartSvg(res.flowchartSvg);
            setUmlSvg(res.umlSvg);
            setStatus(res.status);
            if (!silent) {
                showToast('✓ Діаграми успішно згенеровано!');
            }
        } catch (err) {
            console.warn('Parsing error:', err);
            setStatus(`⚠️ Помилка C++: ${err.message}`);
            if (!silent) {
                showToast(`Помилка: ${err.message}`);
            }
        }
    }, [showToast]);

    // Debounced compilation when typing
    const handleCodeChange = (newCode) => {
        setCode(newCode);
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            generateDiagrams(newCode, true);
        }, 350);
    };

    const handleClearCode = () => {
        setCode('');
        setFlowchartSvg('');
        setUmlSvg('');
        setStatus('Поле коду очищено');
        showToast('Поле коду очищено');
    };

    // Export Helpers
    const getActiveSvgElement = () => {
        if (activeTab === 'uml') {
            return umlRef.current?.querySelector('svg') || null;
        }
        return flowchartRef.current?.querySelector('svg') || null;
    };

    const handleExportSvg = () => {
        const svgEl = getActiveSvgElement();
        if (!svgEl) {
            showToast('Спочатку згенеруйте діаграму');
            return;
        }
        const filename = activeTab === 'uml' ? 'uml_activity.svg' : 'flowchart.svg';
        exportSvg(svgEl, filename);
        showToast(`✓ Завантажено ${filename}`);
    };

    const handleExportPng = async () => {
        const svgEl = getActiveSvgElement();
        if (!svgEl) {
            showToast('Спочатку згенеруйте діаграму');
            return;
        }
        const filename = activeTab === 'uml' ? 'uml_activity.png' : 'flowchart.png';
        try {
            await exportPng(svgEl, filename, 2.5);
            showToast(`✓ Завантажено ${filename}`);
        } catch {
            showToast('Не вдалося експортувати PNG');
        }
    };

    const handleCopySvg = async () => {
        const svgEl = getActiveSvgElement();
        if (!svgEl) {
            showToast('Спочатку згенеруйте діаграму');
            return;
        }
        try {
            await copySvgToClipboard(svgEl);
            showToast('✓ SVG скопійовано в буфер обміну!');
        } catch {
            showToast('Не вдалося скопіювати в буфер');
        }
    };

    const handleDownloadCardSvg = (svgEl, name) => {
        if (!svgEl) return;
        exportSvg(svgEl, `${name}.svg`);
        showToast(`✓ Завантажено ${name}.svg`);
    };

    const handleDownloadCardPng = async (svgEl, name) => {
        if (!svgEl) return;
        try {
            await exportPng(svgEl, `${name}.png`, 2.5);
            showToast(`✓ Завантажено ${name}.png`);
        } catch {
            showToast(`Не вдалося експортувати ${name}.png`);
        }
    };

    return (
        <div className="app-root">
            <Header
                onGenerate={() => generateDiagrams(code, false)}
                onExportSvg={handleExportSvg}
                onExportPng={handleExportPng}
                onCopySvg={handleCopySvg}
                isDark={isDark}
                onToggleTheme={toggleTheme}
            />

            <main className="app-container">
                <CodeEditor
                    code={code}
                    onChange={handleCodeChange}
                    onClear={handleClearCode}
                    onGenerate={() => generateDiagrams(code, false)}
                    status={status}
                />

                <ViewerPanel
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    flowchartSvg={flowchartSvg}
                    umlSvg={umlSvg}
                    flowchartRef={flowchartRef}
                    umlRef={umlRef}
                    onDownloadFcSvg={(el) => handleDownloadCardSvg(el, 'flowchart')}
                    onDownloadFcPng={(el) => handleDownloadCardPng(el, 'flowchart')}
                    onDownloadUmlSvg={(el) => handleDownloadCardSvg(el, 'uml_activity')}
                    onDownloadUmlPng={(el) => handleDownloadCardPng(el, 'uml_activity')}
                />
            </main>

            <Toast message={toast.message} isVisible={toast.isVisible} />
        </div>
    );
}
