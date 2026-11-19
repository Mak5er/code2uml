import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Header from "./components/Header";
import CodeEditor from "./components/CodeEditor";
import ViewerPanel from "./components/ViewerPanel";
import SettingsModal from "./components/SettingsModal";
import DiagramEditorModal from "./components/DiagramEditorModal";
import Toast from "./components/Toast";
import { parseCppProject } from "./parser/cppParser";
import { FlowchartRenderer } from "./renderers/flowchartRenderer";
import { UmlRenderer } from "./renderers/umlRenderer";
import { StructureChartRenderer } from "./renderers/structureChartRenderer";
import { exportSvg, exportPng } from "./utils/exportUtils";
import { trackEvent, trackTimeToFirstAction } from "./utils/analytics";
import "./App.css";

const STORAGE_FILES_KEY = "code2uml_files";
const STORAGE_ACTIVE_FILE_KEY = "code2uml_activeFileId";

let nextFileCounter = 1;
function makeFileId() {
  return `file_${Date.now()}_${nextFileCounter++}`;
}

function sanitizeFileName(rawName) {
  return String(rawName || "")
    .trim()
    .split(/[/\\]/)
    .pop()
    .trim();
}

const PRESETS = [
  {
    id: "lab9_1",
    label: "ЛР 9.1 — Простори імен та модулі",
    subtitle: "7 файлів: var.h/cpp, dod.h/cpp, sum.h/cpp, Lab_09_1.cpp",
    category: "Багатомодульні проекти (ЛР 9)",
    files: [
      {
        name: "Lab_09_1.cpp",
        content: `// Lab_09_1.cpp
// Лабораторна робота № 9.1
// Простори імен: табулювання функції e^(x^2) за допомогою ряду Тейлора

#include <iostream>
#include <iomanip>
#include <cmath>

#include "dod.h"
#include "sum.h"
#include "var.h"

using namespace std;
using namespace nsDod;
using namespace nsSum;
using namespace nsVar;

int main()
{
    cout << "x_p = ";
    cin >> x_p;
    cout << "x_k = ";
    cin >> x_k;
    cout << "dx  = ";
    cin >> dx;
    cout << "eps = ";
    cin >> e;

    if (dx <= 0 || e <= 0)
    {
        cout << "Error: dx and eps must be positive!" << endl;
        return 1;
    }

    cout << "\\nTaylor series tabulation for f(x) = exp(x^2):" << endl;
    cout << "+----------+--------------+--------------+--------+" << endl;
    cout << "|    x     |   exp(x^2)   |      S       |   n    |" << endl;
    cout << "+----------+--------------+--------------+--------+" << endl;

    cout << fixed;
    x = x_p;
    while (x <= x_k + dx / 2.0)
    {
        sum();

        cout << "| " << setw(8) << setprecision(2) << x << " | "
             << setw(12) << setprecision(5) << exp(x * x) << " | "
             << setw(12) << setprecision(5) << s << " | "
             << setw(6) << n << " |" << endl;

        x += dx;
    }

    cout << "+----------+--------------+--------------+--------+" << endl;
    return 0;
}`,
      },
      {
        name: "var.h",
        content: `// var.h
// Заголовний файл модуля глобальних змінних (простір імен nsVar)

#pragma once

namespace nsVar
{
    extern int n;
    extern double x, x_p, x_k, dx, e, a, s;
}`,
      },
      {
        name: "var.cpp",
        content: `// var.cpp
// Визначення глобальних змінних простору імен nsVar

#include "var.h"

namespace nsVar
{
    int n = 0;
    double x = 0.0, x_p = 0.0, x_k = 0.0;
    double dx = 0.0, e = 0.0, a = 0.0, s = 0.0;
}`,
      },
      {
        name: "dod.h",
        content: `// dod.h
// Заголовний файл модуля обчислення наступного доданку ряду Тейлора

#pragma once

namespace nsDod
{
    void dod();
}`,
      },
      {
        name: "dod.cpp",
        content: `// dod.cpp
// Рекурентне обчислення чергового доданку ряду для e^(x^2)

#include "dod.h"
#include "var.h"

using namespace nsVar;

void nsDod::dod()
{
    a *= (x * x) / n;
}`,
      },
      {
        name: "sum.h",
        content: `// sum.h
// Заголовний файл модуля обчислення суми ряду Тейлора

#pragma once

namespace nsSum
{
    void sum();
}`,
      },
      {
        name: "sum.cpp",
        content: `// sum.cpp
// Обчислення часткової суми ряду Тейлора для e^(x^2) з точністю e

#include <cmath>
#include "dod.h"
#include "sum.h"
#include "var.h"

using namespace nsDod;
using namespace nsVar;

void nsSum::sum()
{
    n = 0;
    a = 1.0;
    s = a;

    do
    {
        n++;
        dod();
        s += a;
    } while (std::fabs(a) > e && n < 100000);
}`,
      },
    ],
  },
  {
    id: "lab9_2_1",
    label: "ЛР 9.2.1 — Директиви препроцесора",
    subtitle: "macros.h + Lab_09_2_1.cpp (#if / #elif / макроси)",
    category: "Багатомодульні проекти (ЛР 9)",
    files: [
      {
        name: "Lab_09_2_1.cpp",
        content: `// Lab_09_2_1.cpp
// Лабораторна робота № 9.2.1
// Директиви препроцесора: умовна компіляція та макроси

#include <iostream>
#include "macros.h"

using namespace std;

double CalcW(double x, double y, double z)
{
#if IN_BRANCH_1(Z)
    return MAX(ABS(x) + ABS(y) + ABS(z), CUBE(x));
#elif IN_BRANCH_2(Z)
    return MIN(2.0 * x + y, SQR(2.0 * y - z));
#else
    #error "Macro Z must satisfy either 1 < Z < 3 or Z > 3"
#endif
}

int main()
{
    double x = 0.0, y = 0.0;
    const double z = static_cast<double>(Z);

#if IN_BRANCH_1(Z)
    PRINT_MSG("Compiled branch 1 (1 < z < 3): w = max(|x| + |y| + |z|, x^3)");
#elif IN_BRANCH_2(Z)
    PRINT_MSG("Compiled branch 2 (z > 3): w = min(2x + y, (2y - z)^2)");
#endif

    cout << "Preprocessor constant z = " << z << endl;
    cout << "Enter x: ";
    cin >> x;
    cout << "Enter y: ";
    cin >> y;

    double w = CalcW(x, y, z);
    PRINTR(w);

    return 0;
}`,
      },
      {
        name: "macros.h",
        content: `// macros.h
// Заголовний файл з макровизначеннями та умовами розгалуження

#pragma once

#include <iostream>
#include <iomanip>

#ifndef Z
#define Z 2
#endif

#ifdef MAX
#undef MAX
#endif
#ifdef MIN
#undef MIN
#endif
#define MAX(a, b) (((a) > (b)) ? (a) : (b))
#define MIN(a, b) (((a) < (b)) ? (a) : (b))
#define ABS(v)    (((v) < 0) ? (-(v)) : (v))
#define SQR(v)    ((v) * (v))
#define CUBE(v)   ((v) * (v) * (v))

#define IN_BRANCH_1(z) (((z) > 1) && ((z) < 3))
#define IN_BRANCH_2(z) ((z) > 3)

#define PRINTR(val) std::cout << #val << " = " << std::fixed << std::setprecision(4) << (val) << std::endl
#define PRINT_MSG(msg) std::cout << (msg) << std::endl`,
      },
    ],
  },
  {
    id: "lab9_2_2",
    label: "ЛР 9.2.2 — Геометричні макроси",
    subtitle: "triangle_macros.h + Lab_09_2_2.cpp",
    category: "Багатомодульні проекти (ЛР 9)",
    files: [
      {
        name: "Lab_09_2_2.cpp",
        content: `// Lab_09_2_2.cpp
// Лабораторна робота № 9.2.2
// Доведення співвідношення 1/H^2 = 1/a^2 + 1/b^2 за допомогою макросів

#include <iostream>
#include <cassert>
#include "triangle_macros.h"

using namespace std;

bool IsValidTriangle(double s1, double s2, double s3)
{
    return IS_TRIANGLE(s1, s2, s3);
}

bool ExtractRightTriangle(double s1, double s2, double s3, double &a, double &b, double &c)
{
    if (!IsValidTriangle(s1, s2, s3))
        return false;

    c = MAX3(s1, s2, s3);
    if (c == s1)
    {
        a = s2;
        b = s3;
    }
    else if (c == s2)
    {
        a = s1;
        b = s3;
    }
    else
    {
        a = s1;
        b = s2;
    }

    return IS_RIGHT_TRIANGLE(a, b, c);
}

double CalcHeight(double a, double b, double c)
{
    assert(a > 0 && b > 0 && c > 0);
    return CALC_HEIGHT(a, b, c);
}

bool ProveRelation(double a, double b, double H, double &lhs, double &rhs)
{
    assert(a > 0 && b > 0 && H > 0);
    lhs = INV_SQR(H);
    rhs = INV_SQR(a) + INV_SQR(b);
    return ABS(lhs - rhs) < EPS;
}

int main()
{
    double s1 = 0.0, s2 = 0.0, s3 = 0.0;
    cout << "Enter triangle sides (s1 s2 s3): ";
    if (!(cin >> s1 >> s2 >> s3))
    {
        cout << "Input error!" << endl;
        return 1;
    }

    LOG_DIAG("Validating triangle existence");
    if (!IsValidTriangle(s1, s2, s3))
    {
        cout << "Triangle does not exist." << endl;
        return 0;
    }

    double a = 0.0, b = 0.0, c = 0.0;
    if (!ExtractRightTriangle(s1, s2, s3, a, b, c))
    {
        cout << "Triangle is NOT right-angled." << endl;
        return 0;
    }

    LOG_DIAG("Right triangle confirmed");
    double H = CalcHeight(a, b, c);
    double lhs = 0.0, rhs = 0.0;
    bool proven = ProveRelation(a, b, H, lhs, rhs);

    PRINT_VAL("H", H);
    PRINT_VAL("1 / H^2", lhs);
    PRINT_VAL("1 / a^2 + 1 / b^2", rhs);

    if (proven)
        cout << "Identity PROVEN." << endl;
    else
        cout << "Identity NOT satisfied." << endl;

    return 0;
}`,
      },
      {
        name: "triangle_macros.h",
        content: `// triangle_macros.h
// Макроси геометричних перевірок та діагностики

#pragma once

#include <iostream>
#include <iomanip>

#define EPS 1e-6

#define SQR(v) ((v) * (v))
#define ABS(v) (((v) < 0) ? (-(v)) : (v))
#define MAX2(a, b) (((a) > (b)) ? (a) : (b))
#define MAX3(a, b, c) MAX2(MAX2(a, b), (c))

#define IS_TRIANGLE(a, b, c) \\
    (((a) > 0) && ((b) > 0) && ((c) > 0) && \\
     (((a) + (b)) > (c)) && (((a) + (c)) > (b)) && (((b) + (c)) > (a)))

#define IS_RIGHT_TRIANGLE(a, b, hyp) (ABS(SQR(a) + SQR(b) - SQR(hyp)) < EPS)
#define CALC_HEIGHT(a, b, hyp) (((a) * (b)) / (hyp))
#define INV_SQR(v) (1.0 / SQR(v))

#define PRINT_VAL(label, val) \\
    std::cout << (label) << " = " << std::fixed << std::setprecision(6) << (val) << std::endl

#ifdef DEBUG_DIAG
#define LOG_DIAG(msg) \\
    std::cout << "[DIAG " << __FILE__ << ":" << __LINE__ << "] " << (msg) << std::endl
#else
#define LOG_DIAG(msg) ((void)0)
#endif`,
      },
    ],
  },
  {
    id: "lab2_1",
    label: "ЛР 2.1 — Лінійні програми (дроби)",
    subtitle: "Математичні функції sin, cos, tan",
    category: "Однофайлові лабораторні (ЛР 2–8)",
    files: [
      {
        name: "Lab_02_1.cpp",
        content: `#include <iostream>
#include <cmath>

using namespace std;

int main()
{
    double a, z1, z2;

    cout << "a = "; cin >> a;

    z1 = (cos(a) + sin(a)) / (cos(a) - sin(a));
    z2 = tan(2 * a) + 1.0 / cos(2 * a);

    cout << "z1 = " << z1 << endl;
    cout << "z2 = " << z2 << endl;

    return 0;
}`,
      },
    ],
  },
  {
    id: "lab3_3",
    label: "ЛР 3.3 — Розгалуження (if-else)",
    subtitle: "Повна та скорочена форма умов",
    category: "Однофайлові лабораторні (ЛР 2–8)",
    files: [
      {
        name: "Lab_03_3.cpp",
        content: `#include <iostream>
#include <cmath>

using namespace std;

int main()
{
    double x, y, A, B;

    cout << "x = "; cin >> x;

    A = 2.5 * x;

    if (x < 0)
        B = sin(x);
    else if (x <= 1)
        B = exp(x);
    else
        B = cos(x);

    y = A + B;

    cout << "y = " << y << endl;
    return 0;
}`,
      },
    ],
  },
  {
    id: "lab4_1",
    label: "ЛР 4.1 — Цикли (4 способи)",
    subtitle: "while, do-while, for++, for--",
    category: "Однофайлові лабораторні (ЛР 2–8)",
    files: [
      {
        name: "Lab_04_1.cpp",
        content: `#include <iostream>
#include <cmath>

using namespace std;

int main()
{
    int k, N, i;
    double S;

    cout << "k = "; cin >> k;
    cout << "N = "; cin >> N;

    // 1) цикл while
    S = 0;
    i = k;
    while (i <= N)
    {
        S += sin(1. * i);
        i++;
    }
    cout << S << endl;

    // 2) цикл do..while
    S = 0;
    i = k;
    do {
        S += sin(1. * i);
        i++;
    } while (i <= N);
    cout << S << endl;

    // 3) цикл for (i++)
    S = 0;
    for (i = k; i <= N; i++)
    {
        S += sin(1. * i);
    }
    cout << S << endl;

    // 4) цикл for (i--)
    S = 0;
    for (i = N; i >= k; i--)
    {
        S += sin(1. * i);
    }
    cout << S << endl;

    return 0;
}`,
      },
    ],
  },
  {
    id: "lab5_1",
    label: "ЛР 5.1 — Функції користувача",
    subtitle: "main() + функція g(a, b)",
    category: "Однофайлові лабораторні (ЛР 2–8)",
    files: [
      {
        name: "Lab_05_1.cpp",
        content: `#include <iostream>
#include <cmath>

using namespace std;

double g(const double a, const double b);

int main()
{
    double s, t;

    cout << "s = ";
    cin >> s;
    cout << "t = ";
    cin >> t;

    double c = (g(2, s) + pow(1 + pow(g(t, 1), 2), 3)) / sqrt(1 + pow(g(s, t), 2));

    cout << "c = " << c << endl;

    return 0;
}

double g(const double a, const double b)
{
    return (a * b) / (a * a + b * b);
}`,
      },
    ],
  },
  {
    id: "lab5_4",
    label: "ЛР 5.4 — Рекурсія (5 способів)",
    subtitle: "Ітерація + рекурсивні підйом і спуск",
    category: "Однофайлові лабораторні (ЛР 2–8)",
    files: [
      {
        name: "Lab_05_4.cpp",
        content: `#include <iostream>
#include <cmath>

using namespace std;

double S0(const int K, const int N);
double S1(const int K, const int N, const int i);
double S2(const int K, const int N, const int i);
double S3(const int K, const int N, const int i, double t);
double S4(const int K, const int N, const int i, double t);

int main()
{
    const int K = 3;
    int N;

    cout << "N = ";
    cin >> N;

    if (N < K)
    {
        cout << "Error: N < K" << endl;
        return 1;
    }

    double s0 = S0(K, N);
    double s1 = S1(K, N, K);
    double s2 = S2(K, N, N);
    double s3 = S3(K, N, K, 0.0);
    double s4 = S4(K, N, N, 0.0);

    cout << s0 << " " << s1 << " " << s2 << " " << s3 << " " << s4 << endl;
    return 0;
}

double S0(const int K, const int N)
{
    double s = 0.0;
    for (int i = K; i <= N; i++)
        s += (cos(i / 2.0) + sin(2.0 * i)) / (1.0 + sin(cos(i)));
    return s;
}

double S1(const int K, const int N, const int i)
{
    if (i > N)
        return 0.0;
    else
        return (cos(i / 2.0) + sin(2.0 * i)) / (1.0 + sin(cos(i))) + S1(K, N, i + 1);
}

double S2(const int K, const int N, const int i)
{
    if (i < K)
        return 0.0;
    else
        return (cos(i / 2.0) + sin(2.0 * i)) / (1.0 + sin(cos(i))) + S2(K, N, i - 1);
}

double S3(const int K, const int N, const int i, double t)
{
    if (i > N)
        return t;
    else
        return S3(K, N, i + 1, t + (cos(i / 2.0) + sin(2.0 * i)) / (1.0 + sin(cos(i))));
}

double S4(const int K, const int N, const int i, double t)
{
    if (i < K)
        return t;
    else
        return S4(K, N, i - 1, t + (cos(i / 2.0) + sin(2.0 * i)) / (1.0 + sin(cos(i))));
}`,
      },
    ],
  },
  {
    id: "lab8_1",
    label: "ЛР 8.1 — Рядки та покажчики (char*)",
    subtitle: "FindThirdComma + Change",
    category: "Однофайлові лабораторні (ЛР 2–8)",
    files: [
      {
        name: "Lab_08_1_it.cpp",
        content: `#include <iostream>
#include <cstring>

using namespace std;

int FindThirdComma(const char *str)
{
    int count = 0;
    for (int i = 0; str[i] != '\\0'; i++)
    {
        if (str[i] == ',')
        {
            count++;
            if (count == 3)
                return i;
        }
    }
    return -1;
}

char *Change(char *str)
{
    size_t len = strlen(str);
    char *tmp = new char[len * 2 + 1];
    char *t = tmp;
    tmp[0] = '\\0';

    size_t i = 0;
    while (i < len && str[i] != '\\0')
    {
        if (str[i] == ',')
        {
            strcat(t, "**");
            t += 2;
            i++;
        }
        else
        {
            *t++ = str[i++];
            *t = '\\0';
        }
    }
    *t = '\\0';
    strcpy(str, tmp);
    return tmp;
}

int main()
{
    char str[201];

    cout << "Enter string:" << endl;
    cin.getline(str, 100);

    int index = FindThirdComma(str);
    if (index != -1)
        cout << "Index of third comma: " << index << endl;
    else
        cout << "Third comma not found" << endl;

    char *dest = Change(str);
    cout << "Modified string: " << dest << endl;

    delete[] dest;
    return 0;
}`,
      },
    ],
  },
];

function loadInitialFiles() {
  try {
    const raw = localStorage.getItem(STORAGE_FILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed
          .filter((f) => f && typeof f.name === "string")
          .map((f, idx) => ({
            id: typeof f.id === "string" && f.id ? f.id : `restored_${idx}_${makeFileId()}`,
            name: sanitizeFileName(f.name) || `file_${idx + 1}.cpp`,
            content: typeof f.content === "string" ? f.content : "",
          }));
        if (valid.length > 0) return valid;
      }
    }
  } catch {}
  return [{ id: makeFileId(), name: "main.cpp", content: "" }];
}

function compileCode(
  files,
  targetFunction,
  expressionMode = "cpp",
  arrowRule = "gost",
  columns = "auto",
  ioLabels = "clean",
  functionCallStyle = "predefined",
  customAst = null,
) {
  const projectFiles = Array.isArray(files)
    ? files.map((f, idx) => ({
        name: sanitizeFileName(f?.name) || `file_${idx + 1}.cpp`,
        content: String(f?.content ?? ""),
      }))
    : [{ name: "main.cpp", content: String(files || "") }];

  const hasContent = projectFiles.some((f) => f.content.trim().length > 0);
  if (!hasContent) {
    return {
      flowchartSvg: "",
      umlSvg: "",
      structureChartSvg: "",
      status: "Введіть код",
      count: 0,
      functions: [],
      activeFunction: "main()",
      isMultiFile: projectFiles.length > 1,
      currentAst: [],
    };
  }

  const baseAst = parseCppProject(projectFiles, { arrowRule, targetFunction });
  const ast = customAst && customAst.length > 0 ? customAst : baseAst;

  // Preserve metadata on customAst
  ast.isMultiFile = baseAst.isMultiFile;
  ast.functionName = baseAst.functionName;
  ast.functionQualifiedName = baseAst.functionQualifiedName;
  ast.functionSignature = baseAst.functionSignature;
  ast.functionFile = baseAst.functionFile;
  ast.functionLabel = baseAst.functionLabel;
  ast.isMain = baseAst.isMain;
  ast.functions = baseAst.functions;
  ast.callGraph = baseAst.callGraph;
  ast.allFunctions = baseAst.allFunctions;
  ast.files = baseAst.files;
  ast.modules = baseAst.modules;
  ast.includes = baseAst.includes;
  ast.macroUsages = baseAst.macroUsages;

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

  const count = ast.length;
  const opWord = count === 1 ? "оператор" : count >= 2 && count <= 4 ? "оператори" : "операторів";

  return {
    flowchartSvg: fcResult.svg,
    umlSvg: umlResult.svg,
    structureChartSvg: scResult.svg,
    status: `✓ ${count} ${opWord}`,
    count: ast.length,
    functions: baseAst.functions || [],
    activeFunction: baseAst.functionLabel || baseAst.functionQualifiedName || baseAst.functionName || "main()",
    isMultiFile: Boolean(baseAst.isMultiFile),
    currentAst: ast,
  };
}

export default function App() {
  const [initialWorkspace] = useState(() => {
    const initialFiles = loadInitialFiles();
    let initialActiveId = initialFiles[0]?.id || "";
    try {
      const savedId = localStorage.getItem(STORAGE_ACTIVE_FILE_KEY);
      if (savedId && initialFiles.some((f) => f.id === savedId)) {
        initialActiveId = savedId;
      }
    } catch {}

    let expMode = "cpp";
    let arrRule = "gost";
    let colsMode = "auto";
    let ioMode = "clean";
    let callStyle = "predefined";
    try {
      expMode = localStorage.getItem("expressionMode") || "cpp";
      arrRule = localStorage.getItem("arrowRule") || "gost";
      const savedCols = localStorage.getItem("columnsMode");
      colsMode = savedCols === "1" ? 1 : savedCols === "2" ? 2 : (savedCols || "auto");
      ioMode = localStorage.getItem("ioLabelsMode") || "clean";
      callStyle = localStorage.getItem("functionCallStyle") || "predefined";
    } catch {}

    let compiled = null;
    if (initialFiles.some((f) => (f?.content || "").trim().length > 0)) {
      try {
        compiled = compileCode(
          initialFiles,
          "main",
          expMode,
          arrRule,
          colsMode,
          ioMode,
          callStyle,
        );
      } catch {
        compiled = null;
      }
    }

    return {
      initialFiles,
      initialActiveId,
      expMode,
      arrRule,
      colsMode,
      ioMode,
      callStyle,
      compiled,
    };
  });

  const [files, setFiles] = useState(initialWorkspace.initialFiles);
  const [activeFileId, setActiveFileId] = useState(initialWorkspace.initialActiveId);

  const [expressionMode, setExpressionMode] = useState(initialWorkspace.expMode);
  const [arrowRule, setArrowRule] = useState(initialWorkspace.arrRule);
  const [columnsMode, setColumnsMode] = useState(initialWorkspace.colsMode);
  const [ioLabelsMode, setIoLabelsMode] = useState(initialWorkspace.ioMode);
  const [functionCallStyle, setFunctionCallStyle] = useState(initialWorkspace.callStyle);

  const [status, setStatus] = useState(initialWorkspace.compiled?.status || "Введіть код");
  const [flowchartSvg, setFlowchartSvg] = useState(initialWorkspace.compiled?.flowchartSvg || "");
  const [umlSvg, setUmlSvg] = useState(initialWorkspace.compiled?.umlSvg || "");
  const [structureChartSvg, setStructureChartSvg] = useState(initialWorkspace.compiled?.structureChartSvg || "");
  const [activeTab, setActiveTab] = useState("side-by-side");
  const [toast, setToast] = useState({ message: "", isVisible: false });
  const [functions, setFunctions] = useState(initialWorkspace.compiled?.functions || []);
  const [selectedFunction, setSelectedFunction] = useState(initialWorkspace.compiled?.activeFunction || "main()");
  const [isMultiFileProject, setIsMultiFileProject] = useState(
    initialWorkspace.compiled?.isMultiFile ?? initialWorkspace.initialFiles.length > 1,
  );

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
        trackEvent("resize_editor_pane", { width_px: w });
        return w;
      });
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleToggleCollapseEditor = () => {
    setIsEditorCollapsed((prev) => {
      const next = !prev;
      trackEvent("toggle_editor_collapse", { collapsed: next });
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
  const toastTimerRef = useRef(null);

  // Persist files & activeFileId
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FILES_KEY, JSON.stringify(files));
    } catch {}
  }, [files]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ACTIVE_FILE_KEY, activeFileId);
    } catch {}
  }, [activeFileId]);

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
    trackEvent("toast_shown", { message_snippet: message.substring(0, 50) });
    clearTimeout(toastTimerRef.current);
    setToast({ message, isVisible: true });
    toastTimerRef.current = setTimeout(() => {
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
      projectFiles,
      targetFunc = null,
      silent = false,
      modeToUse = null,
      ruleToUse = null,
      colsToUse = null,
      ioToUse = null,
      callStyleToUse = null,
      customAstOverride = null,
    ) => {
      const normalizedFiles = Array.isArray(projectFiles)
        ? projectFiles
        : [{ name: "main.cpp", content: String(projectFiles || "") }];
      const hasContent = normalizedFiles.some((f) => (f?.content || "").trim().length > 0);

      if (!hasContent) {
        setFlowchartSvg("");
        setUmlSvg("");
        setStructureChartSvg("");
        setStatus("Введіть код");
        setFunctions([]);
        setIsMultiFileProject(normalizedFiles.length > 1);
        if (!silent) showToast("Введіть або вставте C++ код");
        return;
      }

      const tStart = performance.now();
      try {
        const funcToUse = targetFunc || selectedFunction;
        const expMode = modeToUse || expressionMode;
        const arrRule = ruleToUse || arrowRule;
        const cols = colsToUse !== null && colsToUse !== undefined ? colsToUse : columnsMode;
        const ioLabels = ioToUse || ioLabelsMode;
        const callStyle = callStyleToUse || functionCallStyle;
        const customAst = customAstOverride !== null ? customAstOverride : null;

        const res = compileCode(
          normalizedFiles,
          funcToUse,
          expMode,
          arrRule,
          cols,
          ioLabels,
          callStyle,
          customAst,
        );

        const durationMs = Math.round(performance.now() - tStart);
        const totalChars = normalizedFiles.reduce((acc, f) => acc + (f.content || "").length, 0);
        const totalLines = normalizedFiles.reduce((acc, f) => acc + (f.content || "").split("\n").length, 0);

        setFlowchartSvg(res.flowchartSvg);
        setUmlSvg(res.umlSvg);
        setStructureChartSvg(res.structureChartSvg);
        setStatus(res.status);
        setFunctions(res.functions);
        setIsMultiFileProject(res.isMultiFile);

        if (res.activeFunction) {
          setSelectedFunction(res.activeFunction);
        }
        if (!silent) {
          trackTimeToFirstAction("time_to_first_diagram");
          trackEvent("generate_diagrams", {
            code_length: totalChars,
            lines_count: totalLines,
            files_count: normalizedFiles.length,
            duration_ms: durationMs,
            expression_mode: expMode,
            arrow_rule: arrRule,
            columns_mode: String(cols),
            io_labels_mode: ioLabels,
            functions_count: res.functions ? res.functions.length : 1,
            active_function: res.activeFunction || "main()",
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
    generateDiagrams(files, selectedFunction, false, mode, arrowRule, columnsMode, ioLabelsMode, functionCallStyle);
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
    generateDiagrams(files, selectedFunction, false, expressionMode, rule, columnsMode, ioLabelsMode, functionCallStyle);
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
    generateDiagrams(files, selectedFunction, false, expressionMode, arrowRule, mode, ioLabelsMode, functionCallStyle);
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
    generateDiagrams(files, selectedFunction, false, expressionMode, arrowRule, columnsMode, mode, functionCallStyle);
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
    generateDiagrams(files, selectedFunction, false, expressionMode, arrowRule, columnsMode, ioLabelsMode, style);
    showToast(
      style === "predefined"
        ? "Виклики функцій: Зумовлений процес за ДСТУ"
        : "Виклики функцій: Звичайний процес",
    );
  };

  const handleResetSettings = () => {
    trackEvent("reset_settings_defaults");
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
    generateDiagrams(files, selectedFunction, false, "cpp", "gost", "auto", "clean", "predefined");
    showToast("✓ Налаштування скинуто до початкових");
  };

  const handleSelectFunction = (funcIdentifier) => {
    trackEvent("select_function", { function_name: funcIdentifier });
    clearTimeout(debounceTimerRef.current);
    setSelectedFunction(funcIdentifier);
    setCustomSvgByTab({});
    generateDiagrams(files, funcIdentifier, false, expressionMode, arrowRule, columnsMode, ioLabelsMode, functionCallStyle);
  };

  // Multi-file handlers
  const handleSelectFile = (fileId) => {
    setActiveFileId(fileId);
    const targetFile = files.find((f) => f.id === fileId);
    if (!targetFile) return;

    // If switched to a source file that defines functions and current selection is elsewhere, preview its function
    const fileFn = functions.find((fn) => fn.file === targetFile.name);
    if (fileFn) {
      const nextTarget = fileFn.label || fileFn.qualifiedSignature || fileFn.name;
      if (nextTarget && nextTarget !== selectedFunction) {
        clearTimeout(debounceTimerRef.current);
        setSelectedFunction(nextTarget);
        setCustomSvgByTab({});
        generateDiagrams(files, nextTarget, true);
      }
    }
  };

  const handleChangeFileContent = (fileId, newContent) => {
    const nextFiles = files.map((f) =>
      f.id === fileId ? { ...f, content: newContent } : f,
    );
    setFiles(nextFiles);
    setCustomSvgByTab({});
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      generateDiagrams(nextFiles, selectedFunction, true);
    }, 350);
  };

  const handleAddFile = (rawName) => {
    const cleanName = sanitizeFileName(rawName);
    if (!cleanName) return false;
    const duplicate = files.find((f) => f.name.toLowerCase() === cleanName.toLowerCase());
    if (duplicate) {
      setActiveFileId(duplicate.id);
      showToast(`Файл ${duplicate.name} вже існує`);
      return false;
    }
    const newFile = { id: makeFileId(), name: cleanName, content: "" };
    const nextFiles = [...files, newFile];
    setFiles(nextFiles);
    setActiveFileId(newFile.id);
    setIsMultiFileProject(nextFiles.length > 1);
    showToast(`✓ Додано файл ${cleanName}`);
    return true;
  };

  const handleRenameFile = (fileId, rawNewName) => {
    const cleanName = sanitizeFileName(rawNewName);
    const existing = files.find((f) => f.id === fileId);
    if (!existing || !cleanName || cleanName === existing.name) return;

    const conflict = files.find(
      (f) => f.id !== fileId && f.name.toLowerCase() === cleanName.toLowerCase(),
    );
    if (conflict) {
      showToast(`Файл ${conflict.name} вже існує`);
      return;
    }

    const nextFiles = files.map((f) =>
      f.id === fileId ? { ...f, name: cleanName } : f,
    );
    const nextTarget =
      selectedFunction && selectedFunction.startsWith(`${existing.name} :: `)
        ? `${cleanName} :: ${selectedFunction.slice(`${existing.name} :: `.length)}`
        : selectedFunction;
    setFiles(nextFiles);
    setCustomSvgByTab({});
    clearTimeout(debounceTimerRef.current);
    generateDiagrams(nextFiles, nextTarget, true);
    showToast(`✓ Перейменовано у ${cleanName}`);
  };

  const handleDeleteFile = (fileId) => {
    if (files.length <= 1) {
      showToast("Не можна видалити останній файл у проекті");
      return;
    }
    const idx = files.findIndex((f) => f.id === fileId);
    if (idx === -1) return;
    const removed = files[idx];
    const nextFiles = files.filter((f) => f.id !== fileId);
    setFiles(nextFiles);
    if (activeFileId === fileId) {
      const nextActive = nextFiles[Math.max(0, idx - 1)] || nextFiles[0];
      if (nextActive) setActiveFileId(nextActive.id);
    }
    setCustomSvgByTab({});
    clearTimeout(debounceTimerRef.current);
    generateDiagrams(nextFiles, selectedFunction, true);
    showToast(`Видалено файл ${removed.name}`);
  };

  const handleUploadFiles = (loadedFiles) => {
    if (!Array.isArray(loadedFiles) || loadedFiles.length === 0) return;

    const normalizedLoaded = loadedFiles.map((lf) => ({
      name: sanitizeFileName(lf.name) || "code.cpp",
      content: String(lf.content ?? ""),
    }));

    const isDefaultEmptyWorkspace =
      files.length === 1 && (files[0].content || "").trim() === "";

    let nextFiles;
    const addedIds = [];
    if (isDefaultEmptyWorkspace) {
      nextFiles = normalizedLoaded.map((lf) => {
        const id = makeFileId();
        addedIds.push({ id, ...lf });
        return { id, ...lf };
      });
    } else {
      const merged = files.map((f) => ({ ...f }));
      for (const lf of normalizedLoaded) {
        const existingIdx = merged.findIndex(
          (f) => f.name.toLowerCase() === lf.name.toLowerCase(),
        );
        if (existingIdx !== -1) {
          merged[existingIdx] = { ...merged[existingIdx], name: lf.name, content: lf.content };
          addedIds.push(merged[existingIdx]);
        } else {
          const id = makeFileId();
          const created = { id, name: lf.name, content: lf.content };
          merged.push(created);
          addedIds.push(created);
        }
      }
      nextFiles = merged;
    }

    const preferredActive =
      addedIds.find((f) => /\bmain\s*\(/.test(f.content)) ||
      addedIds.find((f) => /\.(cpp|c|cc|cxx)$/i.test(f.name)) ||
      addedIds[0] ||
      nextFiles[0];

    clearTimeout(debounceTimerRef.current);
    setFiles(nextFiles);
    if (preferredActive) setActiveFileId(preferredActive.id);
    setCustomSvgByTab({});
    generateDiagrams(nextFiles, "main", false);
    showToast(`✓ Завантажено файлів: ${normalizedLoaded.length}`);
  };

  const handleSelectPreset = (preset) => {
    if (!preset) return;
    trackEvent("select_preset", { preset_id: preset.id });
    const nextFiles = (preset.files || []).map((f) => ({
      id: makeFileId(),
      name: f.name,
      content: f.content,
    }));
    if (nextFiles.length === 0) return;

    const mainFile =
      nextFiles.find((f) => /\bmain\s*\(/.test(f.content)) || nextFiles[0];

    clearTimeout(debounceTimerRef.current);
    setFiles(nextFiles);
    setActiveFileId(mainFile.id);
    setCustomSvgByTab({});
    generateDiagrams(nextFiles, "main", false);
    showToast(`✓ Завантажено приклад: ${preset.label}`);
  };

  const handleClearCode = () => {
    trackEvent("clear_code");
    clearTimeout(debounceTimerRef.current);
    const blankFile = { id: makeFileId(), name: "main.cpp", content: "" };
    setFiles([blankFile]);
    setActiveFileId(blankFile.id);
    setFlowchartSvg("");
    setUmlSvg("");
    setStructureChartSvg("");
    setFunctions([]);
    setSelectedFunction("main()");
    setIsMultiFileProject(false);
    setCustomSvgByTab({});
    setStatus("Поле коду очищено");
    showToast("Робочу область очищено");
  };

  // Visual Editor handlers
  const handleOpenEditor = (type) => {
    const diagType = type || "flowchart";
    trackEvent("open_editor", { diagram_type: diagType });
    setEditorDiagramType(diagType);
    setEditorModalOpen(true);
  };

  const handleSaveCustomSvg = (newSvg, type) => {
    trackEvent("save_editor", { diagram_type: type });
    setCustomSvgByTab((prev) => ({
      ...prev,
      [type]: newSvg,
    }));
    showToast("✓ Зміни на діаграмі успішно збережено!");
  };

  const handleResetCustomSvg = (type) => {
    trackEvent("reset_editor_to_code", { diagram_type: type });
    setCustomSvgByTab((prev) => ({
      ...prev,
      [type]: null,
    }));
    showToast("✓ Діаграму відновлено з C++ коду");
  };

  const handleDownloadCardSvg = (svgEl, name) => {
    if (!svgEl) return;
    trackTimeToFirstAction("time_to_first_export", { format: "svg" });
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
    trackTimeToFirstAction("time_to_first_export", { format: "png" });
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
        onGenerate={() => generateDiagrams(files, selectedFunction, false)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        functions={functions}
        selectedFunction={selectedFunction}
        onSelectFunction={handleSelectFunction}
        isMultiFile={isMultiFileProject}
        expressionMode={expressionMode}
        onOpenSettings={() => {
          trackEvent("open_settings_modal");
          setSettingsModalOpen(true);
        }}
      />

      <main className="app-container">
        {!isEditorCollapsed && (
          <div
            className="editor-resizable-wrapper"
            style={{ width: `${editorWidth}px` }}
          >
            <CodeEditor
              files={files}
              activeFileId={activeFileId}
              onSelectFile={handleSelectFile}
              onAddFile={handleAddFile}
              onRenameFile={handleRenameFile}
              onDeleteFile={handleDeleteFile}
              onChangeFileContent={handleChangeFileContent}
              onUploadFiles={handleUploadFiles}
              presets={PRESETS}
              onSelectPreset={handleSelectPreset}
              onClear={handleClearCode}
              onGenerate={() => generateDiagrams(files, selectedFunction, false)}
              status={status}
              onToast={showToast}
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
        onClose={() => {
          trackEvent("close_settings_modal");
          setSettingsModalOpen(false);
        }}
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
          onClose={() => {
            trackEvent("close_editor", { diagram_type: editorDiagramType });
            setEditorModalOpen(false);
          }}
          diagramType={editorDiagramType}
          diagramTitle={
            editorDiagramType === "uml"
              ? "UML Діаграма діяльності"
              : editorDiagramType === "structure-chart"
                ? "Структурна схема (ДСТУ ГОСТ 19.701-90)"
                : "Блок-схема (ДСТУ ГОСТ 19.701-90)"
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
