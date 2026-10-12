import React from "react";
import {
  Zap,
  Moon,
  Sun,
  Heart,
  Settings,
} from "lucide-react";
import { LINKS } from "../constants/links.js";
import { trackEvent } from "../utils/analytics.js";

export default function Header({
  onGenerate,
  isDark,
  onToggleTheme,
  functions = [],
  selectedFunction = "main",
  onSelectFunction,
  expressionMode = "cpp",
  onOpenSettings,
}) {
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
          className="btn btn-primary btn-generate"
          onClick={onGenerate}
          title="Оновити діаграми (Ctrl+Enter / Cmd+Enter)"
        >
          <Zap size={14} strokeWidth={2.5} />
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
          <Settings size={14} strokeWidth={2} />
          <span>Налаштування</span>
          {expressionMode === "math" && (
            <span className="settings-active-badge" title="Математичний режим активний">∑</span>
          )}
        </button>

        <div className="divider-v" />

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
            <Moon size={15} strokeWidth={2} className="theme-icon-active" />
          ) : (
            <Sun size={15} strokeWidth={2} className="theme-icon-active" />
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
          <Heart size={13} className="donate-icon" fill="currentColor" />
          <span>Підтримати</span>
        </a>
      </div>
    </header>
  );
}

