import React, { useState, useEffect, useRef, useCallback } from "react";
import Header from "./components/Header";
import CodeEditor from "./components/CodeEditor";
import ViewerPanel from "./components/ViewerPanel";
import Toast from "./components/Toast";
import { parseCppCode } from "./parser/cppParser";
import { FlowchartRenderer } from "./renderers/flowchartRenderer";
import { UmlRenderer } from "./renderers/umlRenderer";
import { exportSvg, exportPng } from "./utils/exportUtils";
import "./App.css";

function compileCode(
  sourceCode,
  targetFunction,
  expressionMode = "cpp",
  arrowRule = "gost",
) {
  const trimmed = (sourceCode || "").trim();
  if (!trimmed) {
    return {
      flowchartSvg: "",
      umlSvg: "",
      status: "Поле коду порожнє",
      count: 0,
      functions: [],
      activeFunction: "main",
    };
  }
  const ast = parseCppCode(trimmed, { arrowRule, targetFunction });
  const fcRenderer = new FlowchartRenderer(ast, { arrowRule, expressionMode });
  const fcResult = fcRenderer.render();
  const umlRenderer = new UmlRenderer(ast, { expressionMode });
  const umlResult = umlRenderer.render();
  const funcLabel =
    ast.functions && ast.functions.length > 1
      ? ` (функція ${ast.functionName})`
      : "";
  return {
    flowchartSvg: fcResult.svg,
    umlSvg: umlResult.svg,
    status: `✓ Готово: розібрано ${ast.length} операторів${funcLabel}`,
    count: ast.length,
    functions: ast.functions || [],
    activeFunction: ast.functionName || "main",
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

  const [status, setStatus] = useState("Поле коду порожнє");
  const [flowchartSvg, setFlowchartSvg] = useState("");
  const [umlSvg, setUmlSvg] = useState("");
  const [activeTab, setActiveTab] = useState("side-by-side");
  const [toast, setToast] = useState({ message: "", isVisible: false });
  const [functions, setFunctions] = useState([]);
  const [selectedFunction, setSelectedFunction] = useState("main");

  // Theme state (checks localStorage and system preference)
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

  const flowchartRef = useRef(null);
  const umlRef = useRef(null);
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
    setIsDark((prev) => !prev);
  };

  // Diagram compilation
  const generateDiagrams = useCallback(
    (
      sourceCode,
      targetFunc = null,
      silent = false,
      modeToUse = null,
      ruleToUse = null,
    ) => {
      const trimmed = (sourceCode || "").trim();
      if (!trimmed) {
        setFlowchartSvg("");
        setUmlSvg("");
        setStatus("Поле коду порожнє");
        setFunctions([]);
        if (!silent) showToast("Введіть або вставте C++ код");
        return;
      }

      try {
        const funcToUse = targetFunc || selectedFunction;
        const expMode = modeToUse || expressionMode;
        const arrRule = ruleToUse || arrowRule;
        const res = compileCode(trimmed, funcToUse, expMode, arrRule);
        setFlowchartSvg(res.flowchartSvg);
        setUmlSvg(res.umlSvg);
        setStatus(res.status);
        setFunctions(res.functions);
        if (res.activeFunction) {
          setSelectedFunction(res.activeFunction);
        }
        if (!silent) {
          showToast("✓ Діаграми успішно згенеровано!");
        }
      } catch (err) {
        console.warn("Parsing error:", err);
        setStatus(`⚠️ Помилка C++: ${err.message}`);
        if (!silent) {
          showToast(`Помилка: ${err.message}`);
        }
      }
    },
    [selectedFunction, expressionMode, arrowRule, showToast],
  );

  const handleToggleExpressionMode = (mode) => {
    setExpressionMode(mode);
    try {
      localStorage.setItem("expressionMode", mode);
    } catch {}
    generateDiagrams(code, selectedFunction, false, mode, arrowRule);
    showToast(
      mode === "math"
        ? "Вирази: Математичний вигляд (дроби, степені)"
        : "Вирази: Вигляд C++",
    );
  };

  const handleToggleArrowRule = (rule) => {
    setArrowRule(rule);
    try {
      localStorage.setItem("arrowRule", rule);
    } catch {}
    generateDiagrams(code, selectedFunction, false, expressionMode, rule);
    showToast(
      rule === "gost"
        ? "Стрілки: По ГОСТу (ДСТУ 19.701-90)"
        : "Стрілки: Всюди (на всіх переходах)",
    );
  };

  const handleSelectFunction = (funcName) => {
    setSelectedFunction(funcName);
    generateDiagrams(code, funcName, false, expressionMode, arrowRule);
  };

  // Debounced compilation when typing
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      generateDiagrams(newCode, null, true);
    }, 350);
  };

  const handleClearCode = () => {
    setCode("");
    setFlowchartSvg("");
    setUmlSvg("");
    setFunctions([]);
    setStatus("Поле коду очищено");
    showToast("Поле коду очищено");
  };

  // Export Helpers
  const getActiveSvgElement = () => {
    if (activeTab === "uml") {
      return umlRef.current?.querySelector("svg") || null;
    }
    return flowchartRef.current?.querySelector("svg") || null;
  };

  const handleExportSvg = () => {
    if (activeTab === "side-by-side") {
      const fcEl = flowchartRef.current?.querySelector("svg");
      const umlEl = umlRef.current?.querySelector("svg");
      if (!fcEl && !umlEl) {
        showToast("Спочатку згенеруйте діаграми");
        return;
      }
      if (fcEl) {
        exportSvg(fcEl, "flowchart.svg");
      }
      if (umlEl) {
        setTimeout(() => {
          exportSvg(umlEl, "uml_activity.svg");
        }, 150);
      }
      showToast(
        "✓ Завантажено обидва файли: flowchart.svg та uml_activity.svg",
      );
    } else {
      const svgEl = getActiveSvgElement();
      if (!svgEl) {
        showToast("Спочатку згенеруйте діаграму");
        return;
      }
      const filename =
        activeTab === "uml" ? "uml_activity.svg" : "flowchart.svg";
      exportSvg(svgEl, filename);
      showToast(`✓ Завантажено ${filename}`);
    }
  };

  const handleExportPng = async () => {
    if (activeTab === "side-by-side") {
      const fcEl = flowchartRef.current?.querySelector("svg");
      const umlEl = umlRef.current?.querySelector("svg");
      if (!fcEl && !umlEl) {
        showToast("Спочатку згенеруйте діаграми");
        return;
      }
      try {
        if (fcEl) {
          await exportPng(fcEl, "flowchart.png", 2.5);
        }
        if (umlEl) {
          await new Promise((r) => setTimeout(r, 150));
          await exportPng(umlEl, "uml_activity.png", 2.5);
        }
        showToast(
          "✓ Завантажено обидва файли: flowchart.png та uml_activity.png",
        );
      } catch {
        showToast("Не вдалося експортувати PNG");
      }
    } else {
      const svgEl = getActiveSvgElement();
      if (!svgEl) {
        showToast("Спочатку згенеруйте діаграму");
        return;
      }
      const filename =
        activeTab === "uml" ? "uml_activity.png" : "flowchart.png";
      try {
        await exportPng(svgEl, filename, 2.5);
        showToast(`✓ Завантажено ${filename}`);
      } catch {
        showToast("Не вдалося експортувати PNG");
      }
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
        onGenerate={() => generateDiagrams(code, null, false)}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        activeTab={activeTab}
        functions={functions}
        selectedFunction={selectedFunction}
        onSelectFunction={handleSelectFunction}
        expressionMode={expressionMode}
        onToggleExpressionMode={handleToggleExpressionMode}
        arrowRule={arrowRule}
        onToggleArrowRule={handleToggleArrowRule}
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
          arrowRule={arrowRule}
          onToggleArrowRule={handleToggleArrowRule}
          onDownloadFcSvg={(el) => handleDownloadCardSvg(el, "flowchart")}
          onDownloadFcPng={(el) => handleDownloadCardPng(el, "flowchart")}
          onDownloadUmlSvg={(el) => handleDownloadCardSvg(el, "uml_activity")}
          onDownloadUmlPng={(el) => handleDownloadCardPng(el, "uml_activity")}
        />
      </main>

      <Toast message={toast.message} isVisible={toast.isVisible} />
    </div>
  );
}
