import React, { useEffect, useRef } from "react";
import { X, Sliders, RotateCcw } from "lucide-react";

export default function SettingsModal({
  isOpen,
  onClose,
  expressionMode,
  onToggleExpressionMode,
  arrowRule,
  onToggleArrowRule,
  columnsMode,
  onToggleColumnsMode,
  ioLabelsMode,
  onToggleIoLabelsMode,
  functionCallStyle = "predefined",
  onToggleFunctionCallStyle,
  onResetDefaults
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="settings-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="settings-modal-header">
          <div className="settings-modal-title" id="settings-title">
            <Sliders size={18} className="text-accent" />
            <span>Налаштування генерації схем</span>
          </div>
          <button
            className="btn-modal-close"
            onClick={onClose}
            aria-label="Закрити налаштування"
          >
            <X size={18} />
          </button>
        </div>

        <div className="settings-modal-body">
          {/* 1. Expression mode */}
          <div className="settings-section">
            <div className="settings-section-header">
              <span className="settings-section-title">
                📐 Формат виразів та формул
              </span>
              <span className="settings-section-desc">
                Відображення математичних операцій у блоках процесу
              </span>
            </div>
            <div className="settings-options-grid">
              <button
                type="button"
                className={`settings-card-btn ${expressionMode === "cpp" ? "active" : ""}`}
                onClick={() => onToggleExpressionMode && onToggleExpressionMode("cpp")}
              >
                <div className="settings-card-title">C++ код</div>
                <div className="settings-card-desc">
                  Оригінальний синтаксис: <code>pow(x, 2)</code>, <code>sqrt</code>, <code>/</code>
                </div>
              </button>
              <button
                type="button"
                className={`settings-card-btn ${expressionMode === "math" ? "active" : ""}`}
                onClick={() => onToggleExpressionMode && onToggleExpressionMode("math")}
              >
                <div className="settings-card-title">∑ Математичний</div>
                <div className="settings-card-desc">
                  Дроби з горизонтальною рискою, степені x², корені √
                </div>
              </button>
            </div>
          </div>

          {/* 2. Arrow rules */}
          <div className="settings-section">
            <div className="settings-section-header">
              <span className="settings-section-title">
                🏹 Стрілочки переходів (Блок-схема)
              </span>
              <span className="settings-section-desc">
                Вимоги стандартів ДСТУ / ГОСТ 19.701-90 для курсових та лаб
              </span>
            </div>
            <div className="settings-options-grid">
              <button
                type="button"
                className={`settings-card-btn ${arrowRule === "gost" ? "active" : ""}`}
                onClick={() => onToggleArrowRule && onToggleArrowRule("gost")}
              >
                <div className="settings-card-title">ГОСТ / ДСТУ</div>
                <div className="settings-card-desc">
                  Стрілки тільки для зворотних переходів (знизу вгору) та злиття
                </div>
              </button>
              <button
                type="button"
                className={`settings-card-btn ${arrowRule === "all" ? "active" : ""}`}
                onClick={() => onToggleArrowRule && onToggleArrowRule("all")}
              >
                <div className="settings-card-title">Всюди</div>
                <div className="settings-card-desc">
                  Стрілочка на кожному переході між елементами алгоритму
                </div>
              </button>
            </div>
          </div>

          {/* 3. Columns */}
          <div className="settings-section">
            <div className="settings-section-header">
              <span className="settings-section-title">
                📑 Розбиття на колонки
              </span>
              <span className="settings-section-desc">
                Розбиття довгих алгоритмів (цикли 4.1) зі з'єднувачами ①
              </span>
            </div>
            <div className="settings-options-grid settings-3-cols">
              <button
                type="button"
                className={`settings-card-btn ${columnsMode === "auto" ? "active" : ""}`}
                onClick={() => onToggleColumnsMode && onToggleColumnsMode("auto")}
              >
                <div className="settings-card-title">Авто-визначення</div>
                <div className="settings-card-desc">
                  2 колонки для великих циклів
                </div>
              </button>
              <button
                type="button"
                className={`settings-card-btn ${columnsMode === 1 ? "active" : ""}`}
                onClick={() => onToggleColumnsMode && onToggleColumnsMode(1)}
              >
                <div className="settings-card-title">1 колонка</div>
                <div className="settings-card-desc">
                  Одна довга схема вниз
                </div>
              </button>
              <button
                type="button"
                className={`settings-card-btn ${columnsMode === 2 ? "active" : ""}`}
                onClick={() => onToggleColumnsMode && onToggleColumnsMode(2)}
              >
                <div className="settings-card-title">2 колонки (1)</div>
                <div className="settings-card-desc">
                  Примусово зі з'єднувачем ①
                </div>
              </button>
            </div>
          </div>

          {/* 4. IO Labels */}
          <div className="settings-section">
            <div className="settings-section-header">
              <span className="settings-section-title">
                🏷️ Підписи блоків вводу та виводу
              </span>
              <span className="settings-section-desc">
                Текст всередині паралелограмів та документів
              </span>
            </div>
            <div className="settings-options-grid">
              <button
                type="button"
                className={`settings-card-btn ${ioLabelsMode === "clean" ? "active" : ""}`}
                onClick={() => onToggleIoLabelsMode && onToggleIoLabelsMode("clean")}
              >
                <div className="settings-card-title">ГОСТ: тільки змінні</div>
                <div className="settings-card-desc">
                  Тільки назви змінних: <code>k, P</code> або <code>x, y</code>
                </div>
              </button>
              <button
                type="button"
                className={`settings-card-btn ${ioLabelsMode === "prefix" ? "active" : ""}`}
                onClick={() => onToggleIoLabelsMode && onToggleIoLabelsMode("prefix")}
              >
                <div className="settings-card-title">Словесний підпис</div>
                <div className="settings-card-desc">
                  Зі словами: <code>ввід k</code>, <code>вивід P</code>
                </div>
              </button>
            </div>
          </div>

          {/* 5. Subroutine call symbol */}
          <div className="settings-section">
            <div className="settings-section-header">
              <span className="settings-section-title">
                🧩 Виклики функцій та підпрограм (Лаб. 5)
              </span>
              <span className="settings-section-desc">
                Оформлення викликів f(k), h(...) та рекурсивних дій
              </span>
            </div>
            <div className="settings-options-grid">
              <button
                type="button"
                className={`settings-card-btn ${functionCallStyle === "predefined" ? "active" : ""}`}
                onClick={() => onToggleFunctionCallStyle && onToggleFunctionCallStyle("predefined")}
              >
                <div className="settings-card-title">Зумовлений процес за ДСТУ</div>
                <div className="settings-card-desc">
                  Прямокутник із подвійними вертикальними лініями
                </div>
              </button>
              <button
                type="button"
                className={`settings-card-btn ${functionCallStyle === "process" ? "active" : ""}`}
                onClick={() => onToggleFunctionCallStyle && onToggleFunctionCallStyle("process")}
              >
                <div className="settings-card-title">Звичайний процес</div>
                <div className="settings-card-desc">
                  Стандартний прямокутник для всіх операцій
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="settings-modal-footer">
          {onResetDefaults && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={onResetDefaults}
              title="Скинути всі налаштування до початкових"
            >
              <RotateCcw size={14} />
              <span>За замовчуванням</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
