import React, { useState, useRef, useEffect } from "react";
import {
  Zap,
  Download,
  FileCode,
  Image as ImageIcon,
  Moon,
  Sun,
  Heart,
  Settings,
} from "lucide-react";
import { LINKS } from "../constants/links.js";
import { trackEvent } from "../utils/analytics.js";

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
  onOpenSettings,
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

        <button
          className="btn btn-outline btn-settings-trigger"
          onClick={onOpenSettings}
          title="Налаштування генерації діаграм (вирази, ГОСТ, колонки, ввід/вивід, символи викликів)"
        >
          <Settings size={15} strokeWidth={2} />
          <span>Налаштування</span>
          {expressionMode === "math" && (
            <span className="settings-active-badge" title="Математичний режим активний">∑</span>
          )}
        </button>

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
          onClick={() =>
            trackEvent("click_external_link", {
              link_name: "monobank_header",
              url: LINKS.MONOBANK_JAR,
            })
          }
        >
          <Heart size={14} className="donate-icon" fill="currentColor" />
          <span>Донат</span>
        </a>
      </div>
    </header>
  );
}
