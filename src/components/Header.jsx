import React, { useState, useRef, useEffect } from "react";
import {
  Zap,
  Download,
  FileCode,
  Image as ImageIcon,
  Moon,
  Sun,
  Heart,
} from "lucide-react";
import { LINKS } from "../constants/links.js";

export default function Header({
  onGenerate,
  onExportSvg,
  onExportPng,
  isDark,
  onToggleTheme,
  activeTab,
  functions = [],
  selectedFunction = "main",
  onSelectFunction,
  expressionMode = "cpp",
  onToggleExpressionMode,
  arrowRule = "gost",
  onToggleArrowRule,
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
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [downloadOpen]);

  const isBoth = activeTab === "side-by-side";

  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-icon">C++</div>
        <div className="brand-titles">
          <h1>Code2UML</h1>
          <span className="brand-subtitle">Генератор схем та UML</span>
        </div>
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

        {functions && functions.length > 1 && (
          <div className="function-selector-wrapper">
            <span className="func-select-label">Функція:</span>
            <select
              className="func-select"
              value={selectedFunction}
              onChange={(e) =>
                onSelectFunction && onSelectFunction(e.target.value)
              }
              title="Виберіть функцію для побудови діаграми"
            >
              {functions.map((fn) => (
                <option key={fn.name} value={fn.name}>
                  {fn.name}() {fn.isMain ? "(головна)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="divider-v" />

        {/* Expression mode switcher: C++ vs Mathematical format */}
        <div
          className="expression-mode-switcher"
          role="group"
          aria-label="Формат виразів"
        >
          <button
            type="button"
            className={`mode-toggle-btn ${expressionMode === "cpp" ? "active" : ""}`}
            onClick={() =>
              onToggleExpressionMode && onToggleExpressionMode("cpp")
            }
            title="Формат виразів як у C++ коді (наприклад pow(x, 2), /)"
          >
            C++
          </button>
          <button
            type="button"
            className={`mode-toggle-btn ${expressionMode === "math" ? "active" : ""}`}
            onClick={() =>
              onToggleExpressionMode && onToggleExpressionMode("math")
            }
            title="Математичний формат формул (дроби з горизонтальною рискою, степені x², корені √)"
          >
            <span className="math-sigma-symbol">∑</span> Математика
          </button>
        </div>

        <div className="divider-v" />

        {/* Arrow rule switcher: Everywhere vs GOST standard */}
        <div
          className="expression-mode-switcher arrow-rule-switcher"
          role="group"
          aria-label="Стрілочки блок-схеми"
        >
          <button
            type="button"
            className={`mode-toggle-btn ${arrowRule === "all" ? "active" : ""}`}
            onClick={() => onToggleArrowRule && onToggleArrowRule("all")}
            title="Стрілочки на всіх переходах між блоками блок-схеми"
          >
            Стрілочки всюди
          </button>
          <button
            type="button"
            className={`mode-toggle-btn ${arrowRule === "gost" ? "active" : ""}`}
            onClick={() => onToggleArrowRule && onToggleArrowRule("gost")}
            title="За стандартом ГОСТ / ДСТУ 19.701-90 (стрілки тільки для ліній знизу вгору та злиття)"
          >
            По ГОСТу
          </button>
        </div>

        <div className="divider-v" />

        {/* Icon-only Download button with Dropdown menu (SVG or PNG) */}
        <div className="download-dropdown" ref={dropdownRef}>
          <button
            className="btn btn-outline btn-icon"
            onClick={() => setDownloadOpen((prev) => !prev)}
            title="Завантажити діаграми (вибір SVG або PNG)"
            aria-expanded={downloadOpen}
            aria-label="Завантажити діаграми"
          >
            <Download size={16} strokeWidth={2} />
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
                    Векторний SVG {isBoth ? "(2 файли)" : "(.svg)"}
                  </span>
                  <span className="dropdown-item-desc">
                    {isBoth
                      ? "Завантажити блок-схему та UML як .svg"
                      : "Для звіту / Word без втрати якості"}
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
                    Зображення PNG {isBoth ? "(2 файли)" : "(.png)"}
                  </span>
                  <span className="dropdown-item-desc">
                    {isBoth
                      ? "Завантажити блок-схему та UML (2.5x High-DPI)"
                      : "Чітка картинка 2.5x High-DPI"}
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Pure icon theme button reflecting current theme */}
        <button
          className="btn btn-outline btn-icon"
          onClick={onToggleTheme}
          title={
            isDark
              ? "Поточна тема: Темна (клікніть для світлої)"
              : "Поточна тема: Світла (клікніть для темної)"
          }
          aria-label="Перемкнути тему"
        >
          {isDark ? (
            <Moon size={16} strokeWidth={2} className="theme-icon-active" />
          ) : (
            <Sun size={16} strokeWidth={2} className="theme-icon-active" />
          )}
        </button>

        <div className="header-divider" />

        {/* Monobank donate button */}
        <a
          href={LINKS.MONOBANK_JAR}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-donate"
          title="Підтримати проект через monobank"
        >
          <Heart size={14} className="donate-icon" fill="currentColor" />
          <span>Донат</span>
        </a>
      </div>
    </header>
  );
}
