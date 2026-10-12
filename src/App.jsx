import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Header from "./components/Header";
import CodeEditor from "./components/CodeEditor";
import ViewerPanel from "./components/ViewerPanel";
import SettingsModal from "./components/SettingsModal";
import DiagramEditorModal from "./components/DiagramEditorModal";
import Toast from "./components/Toast";
import { parseCppCode } from "./parser/cppParser";
import { FlowchartRenderer } from "./renderers/flowchartRenderer";
import { UmlRenderer } from "./renderers/umlRenderer";
import { StructureChartRenderer } from "./renderers/structureChartRenderer";
import { exportSvg, exportPng } from "./utils/exportUtils";
import { trackEvent } from "./utils/analytics";
import "./App.css";

function compileCode(
  sourceCode,
  targetFunction,
  expressionMode = "cpp",
  arrowRule = "gost",
  columns = "auto",
  ioLabels = "clean",
  functionCallStyle = "predefined",
  customAst = null,
) {
  const trimmed = (sourceCode || "").trim();
  if (!trimmed) {
    return {
      flowchartSvg: "",
      umlSvg: "",
      structureChartSvg: "",
      status: "Поле коду порожнє",
      count: 0,
      functions: [],
      activeFunction: "main",
      ast: [],
    };
  }

  const baseAst = parseCppCode(trimmed, { arrowRule, targetFunction });
  const ast = (customAst && customAst.length > 0) ? customAst : baseAst;

  // Preserve metadata on customAst
  ast.functionName = baseAst.functionName;
  ast.functionSignature = baseAst.functionSignature;
  ast.isMain = baseAst.isMain;
  ast.functions = baseAst.functions;
  ast.callGraph = baseAst.callGraph;
  ast.allFunctions = baseAst.allFunctions;

  const fcRenderer = new FlowchartRenderer(ast, {
    arrowRule,
    expressionMode,
    columns,
    ioLabels,
    functionCallStyle,
  });
  const fcResult = fcRenderer.render();

  const umlRenderer = new UmlRenderer(ast, {
    expressionMode,
    columns,
    functionCallStyle,
  });
  const umlResult = umlRenderer.render();

  const scRenderer = new StructureChartRenderer(baseAst);
  const scResult = scRenderer.render();

  const funcLabel =
    baseAst.functions && baseAst.functions.length > 1
      ? ` (${baseAst.functionName})`
      : "";

  return {
    flowchartSvg: fcResult.svg,
    umlSvg: umlResult.svg,
    structureChartSvg: scResult.svg,
    status: `✓ ${ast.length} опер.${funcLabel}`,
    count: ast.length,
    functions: baseAst.functions || [],
    activeFunction: baseAst.functionName || "main",
    currentAst: ast,
  };
}

export default function App() {
  const [code, setCode] = useState("");

  const [expressionMode, setExpressionMode] = useState(() => {
    try {
      return localStorage.getItem("expressionMode") || "cpp";
    } catch {
      return "cpp";
    }
  });

  const [arrowRule, setArrowRule] = useState(() => {
    try {
      return localStorage.getItem("arrowRule") || "gost";
    } catch {
      return "gost";
    }
  });

  const [columnsMode, setColumnsMode] = useState(() => {
    try {
      const saved = localStorage.getItem("columnsMode");
      if (saved === "1") return 1;
      if (saved === "2") return 2;
      return saved || "auto";
    } catch {
      return "auto";
    }
  });

  const [ioLabelsMode, setIoLabelsMode] = useState(() => {
    try {
      return localStorage.getItem("ioLabelsMode") || "clean";
    } catch {
      return "clean";
    }
  });

  const [functionCallStyle, setFunctionCallStyle] = useState(() => {
    try {
      return localStorage.getItem("functionCallStyle") || "predefined";
    } catch {
      return "predefined";
    }
  });

  const [status, setStatus] = useState("Поле коду порожнє");
  const [flowchartSvg, setFlowchartSvg] = useState("");
  const [umlSvg, setUmlSvg] = useState("");
  const [structureChartSvg, setStructureChartSvg] = useState("");
  const [activeTab, setActiveTab] = useState("side-by-side");
  const [toast, setToast] = useState({ message: "", isVisible: false });
  const [functions, setFunctions] = useState([]);
  const [selectedFunction, setSelectedFunction] = useState("main");

  // Modals state
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editorDiagramType, setEditorDiagramType] = useState("flowchart");

  // Custom diagram SVG overrides (saved from visual editor)
  const [customSvgByTab, setCustomSvgByTab] = useState({});

  // Theme state
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved) return saved === "dark";
      return Boolean(
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches,
      );
    } catch {
      return false;
    }
  });

  // Resizable & Collapsible code editor panel state
  const [editorWidth, setEditorWidth] = useState(() => {
    try {
      const saved = localStorage.getItem("editorWidth");
      return saved ? Number(saved) : 440;
    } catch {
      return 440;
    }
  });

  const [isEditorCollapsed, setIsEditorCollapsed] = useState(() => {
    try {
      return localStorage.getItem("isEditorCollapsed") === "true";
    } catch {
      return false;
    }
  });

  const isResizingRef = useRef(false);

  const handleResizerMouseDown = (e) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.min(Math.max(260, moveEvent.clientX), 750);
      setEditorWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      setEditorWidth((w) => {
        try {
          localStorage.setItem("editorWidth", String(w));
        } catch {}
        return w;
      });
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleToggleCollapseEditor = () => {
    setIsEditorCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("isEditorCollapsed", String(next));
      } catch {}
      return next;
    });
  };

  const flowchartRef = useRef(null);
  const umlRef = useRef(null);
  const structureChartRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Apply theme class to <html>
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {}
  }, [isDark]);

  const showToast = useCallback((message) => {
    setToast({ message, isVisible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, isVisible: false }));
    }, 3000);
  }, []);

  const toggleTheme = () => {
    const nextTheme = isDark ? "light" : "dark";
    trackEvent("toggle_theme", { theme: nextTheme });
    setIsDark((prev) => !prev);
  };

  const handleTabChange = (newTab) => {
    trackEvent("change_tab", { tab: newTab });
    setActiveTab(newTab);
  };

  // Diagram compilation
  const generateDiagrams = useCallback(
    (
      sourceCode,
      targetFunc = null,
      silent = false,
      modeToUse = null,
      ruleToUse = null,
      colsToUse = null,
      ioToUse = null,
      callStyleToUse = null,
      customAstOverride = null,
    ) => {
      const trimmed = (sourceCode || "").trim();
      if (!trimmed) {
        setFlowchartSvg("");
        setUmlSvg("");
        setStructureChartSvg("");
        setStatus("Поле коду порожнє");
        setFunctions([]);
        setCurrentAst([]);
        if (!silent) showToast("Введіть або вставте C++ код");
        return;
      }

      try {
        const funcToUse = targetFunc || selectedFunction;
        const expMode = modeToUse || expressionMode;
        const arrRule = ruleToUse || arrowRule;
        const cols = colsToUse !== null && colsToUse !== undefined ? colsToUse : columnsMode;
        const ioLabels = ioToUse || ioLabelsMode;
        const callStyle = callStyleToUse || functionCallStyle;
        const customAst = customAstOverride !== null ? customAstOverride : null;

        const res = compileCode(
          trimmed,
          funcToUse,
          expMode,
          arrRule,
          cols,
          ioLabels,
          callStyle,
          customAst,
        );

        setFlowchartSvg(res.flowchartSvg);
        setUmlSvg(res.umlSvg);
        setStructureChartSvg(res.structureChartSvg);
        setStatus(res.status);
        setFunctions(res.functions);

        if (res.activeFunction) {
          setSelectedFunction(res.activeFunction);
        }
        if (!silent) {
          trackEvent("generate_diagrams", {
            code_length: trimmed.length,
            lines_count: trimmed.split("\n").length,
            expression_mode: expMode,
            arrow_rule: arrRule,
            columns_mode: String(cols),
            io_labels_mode: ioLabels,
            functions_count: res.functions ? res.functions.length : 1,
            active_function: res.activeFunction || "main",
          });
          showToast("✓ Діаграми успішно згенеровано!");
        }
      } catch (err) {
        console.warn("Parsing error:", err);
        setStatus(`⚠️ Помилка C++: ${err.message}`);
        if (!silent) {
          trackEvent("generate_diagrams_error", {
            error_message: err.message,
          });
          showToast(`Помилка: ${err.message}`);
        }
      }
    },
    [selectedFunction, expressionMode, arrowRule, columnsMode, ioLabelsMode, functionCallStyle, showToast],
  );

  const handleToggleExpressionMode = (mode) => {
    trackEvent("toggle_expression_mode", { mode });
    setExpressionMode(mode);
    try {
      localStorage.setItem("expressionMode", mode);
    } catch {}
    generateDiagrams(code, selectedFunction, false, mode, arrowRule, columnsMode, ioLabelsMode, functionCallStyle);
    showToast(
      mode === "math"
        ? "Вирази: Математичний вигляд (дроби, степені)"
        : "Вирази: Вигляд C++",
    );
  };

  const handleToggleArrowRule = (rule) => {
    trackEvent("toggle_arrow_rule", { rule });
    setArrowRule(rule);
    try {
      localStorage.setItem("arrowRule", rule);
    } catch {}
    generateDiagrams(code, selectedFunction, false, expressionMode, rule, columnsMode, ioLabelsMode, functionCallStyle);
    showToast(
      rule === "gost"
        ? "Стрілки: По ГОСТу (ДСТУ 19.701-90)"
        : "Стрілки: Всюди (на всіх переходах)",
    );
  };

  const handleToggleColumnsMode = (mode) => {
    trackEvent("toggle_columns_mode", { mode: String(mode) });
    setColumnsMode(mode);
    try {
      localStorage.setItem("columnsMode", String(mode));
    } catch {}
    generateDiagrams(code, selectedFunction, false, expressionMode, arrowRule, mode, ioLabelsMode, functionCallStyle);
    showToast(
      mode === "auto"
        ? "Колонки: Авто (2 колонки для великих циклів)"
        : mode === 2
          ? "Колонки: 2 колонки (з'єднувач 1)"
          : "Колонки: 1 колонка",
    );
  };

  const handleToggleIoLabelsMode = (mode) => {
    trackEvent("toggle_io_labels_mode", { mode });
    setIoLabelsMode(mode);
    try {
      localStorage.setItem("ioLabelsMode", mode);
    } catch {}
    generateDiagrams(code, selectedFunction, false, expressionMode, arrowRule, columnsMode, mode, functionCallStyle);
    showToast(
      mode === "prefix"
        ? "Ввід/Вивід: Зі словами (ввід N / вивід P)"
        : "Ввід/Вивід: Тільки змінні за ГОСТ (N / P)",
    );
  };

  const handleToggleFunctionCallStyle = (style) => {
    trackEvent("toggle_function_call_style", { style });
    setFunctionCallStyle(style);
    try {
      localStorage.setItem("functionCallStyle", style);
    } catch {}
    generateDiagrams(code, selectedFunction, false, expressionMode, arrowRule, columnsMode, ioLabelsMode, style);
    showToast(
      style === "predefined"
        ? "Виклики функцій: Зумовлений процес за ДСТУ"
        : "Виклики функцій: Звичайний процес",
    );
  };

  const handleResetSettings = () => {
    setExpressionMode("cpp");
    setArrowRule("gost");
    setColumnsMode("auto");
    setIoLabelsMode("clean");
    setFunctionCallStyle("predefined");
    try {
      localStorage.setItem("expressionMode", "cpp");
      localStorage.setItem("arrowRule", "gost");
      localStorage.setItem("columnsMode", "auto");
      localStorage.setItem("ioLabelsMode", "clean");
      localStorage.setItem("functionCallStyle", "predefined");
    } catch {}
    generateDiagrams(code, selectedFunction, false, "cpp", "gost", "auto", "clean", "predefined");
    showToast("✓ Налаштування скинуто до початкових");
  };

  const handleSelectFunction = (funcName) => {
    trackEvent("select_function", { function_name: funcName });
    setSelectedFunction(funcName);
    generateDiagrams(code, funcName, false, expressionMode, arrowRule, columnsMode, ioLabelsMode, functionCallStyle);
  };



  // Debounced compilation when typing
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    setCustomSvgByTab({});
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      generateDiagrams(newCode, null, true);
    }, 350);
  };

  const handleClearCode = () => {
    trackEvent("clear_code");
    setCode("");
    setFlowchartSvg("");
    setUmlSvg("");
    setStructureChartSvg("");
    setFunctions([]);
    setCustomSvgByTab({});
    setStatus("Поле коду очищено");
    showToast("Поле коду очищено");
  };

  // Visual Editor handlers
  const handleOpenEditor = (type) => {
    setEditorDiagramType(type || "flowchart");
    setEditorModalOpen(true);
  };

  const handleSaveCustomSvg = (newSvg, type) => {
    setCustomSvgByTab((prev) => ({
      ...prev,
      [type]: newSvg,
    }));
    showToast("✓ Зміни на діаграмі успішно збережено!");
  };

  const handleResetCustomSvg = (type) => {
    setCustomSvgByTab((prev) => ({
      ...prev,
      [type]: null,
    }));
    showToast("✓ Діаграму відновлено з C++ коду");
  };

  const handleDownloadCardSvg = (svgEl, name) => {
    if (!svgEl) return;
    trackEvent("export_diagram", {
      format: "svg",
      diagram_type: name,
      trigger: "card_button",
    });
    exportSvg(svgEl, `${name}.svg`);
    showToast(`✓ Завантажено ${name}.svg`);
  };

  const handleDownloadCardPng = async (svgEl, name) => {
    if (!svgEl) return;
    trackEvent("export_diagram", {
      format: "png",
      diagram_type: name,
      trigger: "card_button",
    });
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
        onGenerate={() => generateDiagrams(code, null, false)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        functions={functions}
        selectedFunction={selectedFunction}
        onSelectFunction={handleSelectFunction}
        expressionMode={expressionMode}
        onOpenSettings={() => setSettingsModalOpen(true)}
      />

      <main className="app-container">
        {!isEditorCollapsed && (
          <div
            className="editor-resizable-wrapper"
            style={{ width: `${editorWidth}px` }}
          >
            <CodeEditor
              code={code}
              onChange={handleCodeChange}
              onClear={handleClearCode}
              onGenerate={() => generateDiagrams(code, false)}
              status={status}
              onCollapse={handleToggleCollapseEditor}
            />
          </div>
        )}

        <div
          className={`app-pane-resizer ${isEditorCollapsed ? "collapsed" : ""}`}
          onMouseDown={!isEditorCollapsed ? handleResizerMouseDown : undefined}
          title={isEditorCollapsed ? "Розгорнути панель коду" : "Потягніть для зміни ширини або клікніть для згортання"}
        >
          <button
            type="button"
            className="pane-collapse-btn"
            onClick={handleToggleCollapseEditor}
            title={isEditorCollapsed ? "Розгорнути панель коду" : "Згорнути панель коду"}
            aria-label={isEditorCollapsed ? "Розгорнути панель коду" : "Згорнути панель коду"}
          >
            {isEditorCollapsed ? (
              <ChevronRight size={13} strokeWidth={2.5} />
            ) : (
              <ChevronLeft size={13} strokeWidth={2.5} />
            )}
          </button>
        </div>

        <ViewerPanel
          activeTab={activeTab}
          onTabChange={handleTabChange}
          flowchartSvg={customSvgByTab.flowchart || flowchartSvg}
          umlSvg={customSvgByTab.uml || umlSvg}
          structureChartSvg={customSvgByTab["structure-chart"] || structureChartSvg}
          flowchartRef={flowchartRef}
          umlRef={umlRef}
          structureChartRef={structureChartRef}
          onDownloadFcSvg={(el) => handleDownloadCardSvg(el, "flowchart")}
          onDownloadFcPng={(el) => handleDownloadCardPng(el, "flowchart")}
          onDownloadUmlSvg={(el) => handleDownloadCardSvg(el, "uml_activity")}
          onDownloadUmlPng={(el) => handleDownloadCardPng(el, "uml_activity")}
          onDownloadScSvg={(el) => handleDownloadCardSvg(el, "structure_chart")}
          onDownloadScPng={(el) => handleDownloadCardPng(el, "structure_chart")}
          onEditDiagram={handleOpenEditor}
          isCustomized={{
            flowchart: Boolean(customSvgByTab.flowchart),
            uml: Boolean(customSvgByTab.uml),
            "structure-chart": Boolean(customSvgByTab["structure-chart"]),
          }}
          onToast={showToast}
        />
      </main>

      {/* Settings Modal (consolidated options) */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        expressionMode={expressionMode}
        onToggleExpressionMode={handleToggleExpressionMode}
        arrowRule={arrowRule}
        onToggleArrowRule={handleToggleArrowRule}
        columnsMode={columnsMode}
        onToggleColumnsMode={handleToggleColumnsMode}
        ioLabelsMode={ioLabelsMode}
        onToggleIoLabelsMode={handleToggleIoLabelsMode}
        functionCallStyle={functionCallStyle}
        onToggleFunctionCallStyle={handleToggleFunctionCallStyle}
        onResetDefaults={handleResetSettings}
      />

      {/* Diagram Interactive Visual Editor Modal */}
      {editorModalOpen && (
        <DiagramEditorModal
          key={`${editorDiagramType}_${selectedFunction}`}
          isOpen={editorModalOpen}
          onClose={() => setEditorModalOpen(false)}
          diagramType={editorDiagramType}
          diagramTitle={
            editorDiagramType === "uml"
              ? "UML-activity діаграма"
              : editorDiagramType === "structure-chart"
                ? "Структурна схема програми"
                : "Блок-схема алгоритму"
          }
          svgContent={
            editorDiagramType === "uml"
              ? (customSvgByTab.uml || umlSvg)
              : editorDiagramType === "structure-chart"
                ? (customSvgByTab["structure-chart"] || structureChartSvg)
                : (customSvgByTab.flowchart || flowchartSvg)
          }
          onSave={handleSaveCustomSvg}
          onResetToCode={() => handleResetCustomSvg(editorDiagramType)}
          isCustomized={Boolean(customSvgByTab[editorDiagramType])}
          isDark={isDark}
        />
      )}

      <Toast message={toast.message} isVisible={toast.isVisible} />
    </div>
  );
}
