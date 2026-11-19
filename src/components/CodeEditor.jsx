import React, { useRef, useState, useEffect } from 'react';
import {
    Code2,
    Heart,
    Plus,
    X,
    Pencil,
    Check,
    Upload,
    BookOpen,
    ChevronDown,
    FileCode2,
} from 'lucide-react';
import { LINKS } from '../constants/links.js';
import { trackEvent } from '../utils/analytics.js';

const ACCEPTED_CPP_EXT_RE = /\.(cpp|h|hpp|c|cc|cxx|hh)$/i;

function getFileExtClass(filename) {
    const lower = (filename || '').toLowerCase();
    if (lower.endsWith('.h') || lower.endsWith('.hpp') || lower.endsWith('.hh')) {
        return 'ext-header';
    }
    return 'ext-source';
}

function readUploadedFile(file) {
    if (typeof file.text === 'function') {
        return file.text().then((content) => ({
            name: file.name,
            content,
        }));
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, content: String(reader.result || '') });
        reader.onerror = () => reject(reader.error || new Error(`Не вдалося прочитати ${file.name}`));
        reader.readAsText(file);
    });
}

export default function CodeEditor({
    files = [],
    activeFileId,
    onSelectFile,
    onAddFile,
    onRenameFile,
    onDeleteFile,
    onChangeFileContent,
    onUploadFiles,
    presets = [],
    onSelectPreset,
    onClear,
    onGenerate,
    status,
    onToast,
}) {
    const textareaRef = useRef(null);
    const lineNumbersRef = useRef(null);
    const fileInputRef = useRef(null);
    const presetsMenuRef = useRef(null);
    const dragCounterRef = useRef(0);

    const [isAddingFile, setIsAddingFile] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [renamingFileId, setRenamingFileId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [presetsOpen, setPresetsOpen] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    const activeFile = files.find((f) => f.id === activeFileId) || files[0] || {
        id: 'default',
        name: 'main.cpp',
        content: '',
    };
    const code = activeFile.content || '';

    const lineCount = code ? code.split('\n').length : 1;
    const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

    useEffect(() => {
        if (!presetsOpen) return;
        const handleOutsideClick = (e) => {
            if (presetsMenuRef.current && !presetsMenuRef.current.contains(e.target)) {
                setPresetsOpen(false);
            }
        };
        const handleEsc = (e) => {
            if (e.key === 'Escape') setPresetsOpen(false);
        };
        document.addEventListener('mousedown', handleOutsideClick);
        window.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            window.removeEventListener('keydown', handleEsc);
        };
    }, [presetsOpen]);

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
            onChangeFileContent(activeFile.id, newCode);

            setTimeout(() => {
                if (textarea) {
                    textarea.selectionStart = textarea.selectionEnd = start + 4;
                }
            }, 0);
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            trackEvent('keyboard_shortcut_generate', { key_combo: 'ctrl_enter' });
            onGenerate();
        }
    };

    const handlePaste = (e) => {
        const text = e.clipboardData ? e.clipboardData.getData('text') : '';
        if (text && text.trim().length > 5) {
            trackEvent('code_pasted', {
                characters_count: text.length,
                lines_count: text.split('\n').length,
                has_include: text.includes('#include'),
                has_main: text.includes('main'),
                has_split: text.includes('[split]'),
            });
        }
    };

    const handleStartAddFile = () => {
        setRenamingFileId(null);
        setNewFileName('');
        setIsAddingFile(true);
    };

    const handleConfirmAddFile = (e) => {
        if (e) e.preventDefault();
        const trimmed = newFileName.trim();
        if (!trimmed) {
            setIsAddingFile(false);
            return;
        }
        const ok = onAddFile ? onAddFile(trimmed) : true;
        if (ok !== false) {
            setIsAddingFile(false);
            setNewFileName('');
        }
    };

    const handleStartRename = (file, e) => {
        if (e) e.stopPropagation();
        setIsAddingFile(false);
        setRenamingFileId(file.id);
        setRenameValue(file.name);
    };

    const handleConfirmRename = (fileId) => {
        const trimmed = renameValue.trim();
        if (trimmed && onRenameFile) {
            onRenameFile(fileId, trimmed);
        }
        setRenamingFileId(null);
        setRenameValue('');
    };

    const handleLoadedFileList = async (fileList) => {
        const rawFiles = Array.from(fileList || []);
        const validFiles = rawFiles.filter((f) => ACCEPTED_CPP_EXT_RE.test(f.name));
        if (validFiles.length === 0) {
            if (onToast) onToast('Оберіть файли з розширенням .cpp, .h, .hpp або .c');
            return;
        }
        try {
            const loaded = await Promise.all(validFiles.map(readUploadedFile));
            if (onUploadFiles) onUploadFiles(loaded);
        } catch (err) {
            if (onToast) onToast(`Помилка читання файлів: ${err.message}`);
        }
    };

    const handleFileInputChange = async (e) => {
        await handleLoadedFileList(e.target.files);
        e.target.value = '';
    };

    const handleDragEnter = (e) => {
        if (!e.dataTransfer?.types?.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current += 1;
        setIsDragOver(true);
    };

    const handleDragOver = (e) => {
        if (!e.dataTransfer?.types?.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDragLeave = (e) => {
        if (!e.dataTransfer?.types?.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
        if (dragCounterRef.current === 0) {
            setIsDragOver(false);
        }
    };

    const handleDrop = async (e) => {
        if (!e.dataTransfer?.files?.length) return;
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragOver(false);
        await handleLoadedFileList(e.dataTransfer.files);
    };

    // Group presets by category preserving order
    const presetGroups = [];
    const seenCategories = new Map();
    presets.forEach((preset) => {
        const cat = preset.category || 'Приклади';
        if (!seenCategories.has(cat)) {
            const group = { category: cat, items: [] };
            seenCategories.set(cat, group);
            presetGroups.push(group);
        }
        seenCategories.get(cat).items.push(preset);
    });

    return (
        <section
            className={`panel-editor ${isDragOver ? 'drag-over' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="panel-header">
                <div className="panel-title">
                    <Code2 size={15} strokeWidth={2} />
                    <span>C++ Код</span>
                    {files.length > 1 && (
                        <span className="files-count-badge" title={`Відкрито файлів: ${files.length}`}>
                            {files.length} ф.
                        </span>
                    )}
                </div>

                <div className="panel-header-actions">
                    {presets.length > 0 && (
                        <div className="presets-dropdown" ref={presetsMenuRef}>
                            <button
                                type="button"
                                className={`btn btn-outline btn-sm btn-presets ${presetsOpen ? 'active' : ''}`}
                                onClick={() => setPresetsOpen((prev) => !prev)}
                                title="Завантажити готовий приклад лабораторної роботи (ЛР 2–9)"
                            >
                                <BookOpen size={13} strokeWidth={2} />
                                <span>Приклади</span>
                                <ChevronDown size={12} className={`chevron-icon ${presetsOpen ? 'open' : ''}`} />
                            </button>

                            {presetsOpen && (
                                <div className="presets-menu" role="menu">
                                    {presetGroups.map((group) => (
                                        <div key={group.category} className="presets-group">
                                            <div className="presets-group-title">{group.category}</div>
                                            {group.items.map((preset) => {
                                                const fileCount = preset.files ? preset.files.length : 1;
                                                return (
                                                    <button
                                                        key={preset.id}
                                                        type="button"
                                                        className="preset-item"
                                                        role="menuitem"
                                                        onClick={() => {
                                                            setPresetsOpen(false);
                                                            if (onSelectPreset) onSelectPreset(preset);
                                                        }}
                                                    >
                                                        <div className="preset-item-main">
                                                            <span className="preset-item-label">{preset.label}</span>
                                                            {preset.subtitle && (
                                                                <span className="preset-item-sub">{preset.subtitle}</span>
                                                            )}
                                                        </div>
                                                        <span className={`preset-file-pill ${fileCount > 1 ? 'multi' : ''}`}>
                                                            {fileCount} {fileCount === 1 ? 'файл' : fileCount < 5 ? 'файли' : 'файлів'}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".cpp,.h,.hpp,.c,.cc,.cxx,.hh"
                        className="sr-only"
                        onChange={handleFileInputChange}
                    />
                    <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => fileInputRef.current && fileInputRef.current.click()}
                        title="Завантажити один або кілька .cpp / .h файлів"
                    >
                        <Upload size={13} strokeWidth={2} />
                        <span>Файли</span>
                    </button>

                    <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={onClear}
                        title="Очистити робочу область"
                    >
                        Очистити
                    </button>
                </div>
            </div>

            <div className="file-tabs-bar" role="tablist" aria-label="Файли C++ проекту">
                <div className="file-tabs-scroll">
                    {files.map((file) => {
                        const isActive = file.id === activeFile.id;
                        const isRenaming = renamingFileId === file.id;
                        const extClass = getFileExtClass(file.name);

                        return (
                            <div
                                key={file.id}
                                role="tab"
                                aria-selected={isActive}
                                className={`file-tab ${isActive ? 'active' : ''}`}
                                onClick={() => {
                                    if (!isRenaming && onSelectFile) onSelectFile(file.id);
                                }}
                                onDoubleClick={(e) => handleStartRename(file, e)}
                                title={`${file.name} (подвійний клік — перейменувати)`}
                            >
                                <span className={`file-ext-dot ${extClass}`} />
                                {isRenaming ? (
                                    <input
                                        type="text"
                                        className="file-tab-inline-input"
                                        value={renameValue}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleConfirmRename(file.id);
                                            } else if (e.key === 'Escape') {
                                                e.preventDefault();
                                                setRenamingFileId(null);
                                            }
                                        }}
                                        onBlur={() => handleConfirmRename(file.id)}
                                        aria-label="Нова назва файлу"
                                    />
                                ) : (
                                    <span className="file-tab-name">{file.name}</span>
                                )}

                                {!isRenaming && isActive && (
                                    <button
                                        type="button"
                                        className="file-tab-icon-btn"
                                        onClick={(e) => handleStartRename(file, e)}
                                        title={`Перейменувати ${file.name}`}
                                        aria-label={`Перейменувати ${file.name}`}
                                    >
                                        <Pencil size={10} />
                                    </button>
                                )}

                                {files.length > 1 && !isRenaming && (
                                    <button
                                        type="button"
                                        className="file-tab-icon-btn file-tab-close-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onDeleteFile) onDeleteFile(file.id);
                                        }}
                                        title={`Видалити ${file.name}`}
                                        aria-label={`Видалити ${file.name}`}
                                    >
                                        <X size={11} />
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    {isAddingFile ? (
                        <form className="file-tab-add-form" onSubmit={handleConfirmAddFile}>
                            <input
                                type="text"
                                className="file-tab-inline-input"
                                value={newFileName}
                                placeholder="dod.h / sum.cpp"
                                autoFocus
                                onChange={(e) => setNewFileName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        e.preventDefault();
                                        setIsAddingFile(false);
                                        setNewFileName('');
                                    }
                                }}
                                aria-label="Назва нового файлу"
                            />
                            <button
                                type="submit"
                                className="file-tab-icon-btn confirm"
                                title="Створити файл"
                                aria-label="Створити файл"
                            >
                                <Check size={11} />
                            </button>
                            <button
                                type="button"
                                className="file-tab-icon-btn"
                                onClick={() => {
                                    setIsAddingFile(false);
                                    setNewFileName('');
                                }}
                                title="Скасувати"
                                aria-label="Скасувати"
                            >
                                <X size={11} />
                            </button>
                        </form>
                    ) : (
                        <button
                            type="button"
                            className="btn-add-file"
                            onClick={handleStartAddFile}
                            title="Додати новий файл (.h або .cpp)"
                        >
                            <Plus size={12} strokeWidth={2.5} />
                            <span>Додати файл</span>
                        </button>
                    )}
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
                    onChange={(e) => onChangeFileContent(activeFile.id, e.target.value)}
                    onScroll={handleScroll}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    spellCheck="false"
                    placeholder="// Вставте або напишіть C++ код сюди... (розрив на колонки: // [split])"
                />

                {isDragOver && (
                    <div className="editor-drop-overlay">
                        <div className="editor-drop-card">
                            <FileCode2 size={28} strokeWidth={1.8} />
                            <span>Перетягніть .cpp / .h файли сюди</span>
                            <small>Можна додати декілька файлів одночасно</small>
                        </div>
                    </div>
                )}
            </div>

            <div className="panel-footer">
                <div className="panel-footer-info">
                    <span className="code-status-text" title={status}>{status}</span>
                    <span
                        className="supported-text"
                        title="Підтримує: cin, cout, if-else, switch, while, for, do-while, функції, модулі .h/.cpp, namespace, #define, // [split]"
                    >
                        C++: функції, .h/.cpp, цикли
                    </span>
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
