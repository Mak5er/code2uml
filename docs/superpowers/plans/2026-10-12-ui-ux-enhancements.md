# UI/UX Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the UI/UX of Code2UML into a modern, friction-free developer experience by adding instant clipboard image copying, zoom-to-fit auto-framing, resizable & collapsible split panes, layout switching (horizontal/vertical), and decluttering header controls.

**Architecture:** 
- Modular React component enhancements across `DiagramCard`, `CanvasControls`, `ViewerPanel`, `CodeEditor`, and `Header`.
- Zero backend dependencies; pure browser Canvas API (`ClipboardItem`) and CSS Flexbox/DOM math.
- Settings and layout preferences persisted gracefully in `localStorage`.

**Tech Stack:** React 19, Lucide Icons, Vite, Tailwind-compatible CSS Variables, Web Clipboard API.

---

### Task 1: Direct "Copy to Clipboard as PNG" on Diagram Cards

**Files:**
- Modify: `src/utils/exportUtils.js`
- Modify: `src/components/DiagramCard.jsx`
- Modify: `src/App.css`
- Modify: `src/App.jsx`

- [x] **Step 1: Implement `copyPngToClipboard(svgElement, scale = 2.5)` in `src/utils/exportUtils.js`**
  Renders SVG to HTML5 Canvas at 2.5x High-DPI and writes PNG Blob directly to system clipboard via `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`.

- [x] **Step 2: Add "Буфер" (Copy to Clipboard) button in `src/components/DiagramCard.jsx`**
  Add button with `Copy` icon and title "Скопіювати зображення діаграми в буфер обміну (для Word / Docs)".
  Provide feedback via toast notification: "Діаграму скопійовано в буфер! Вставте у Word (Ctrl+V)".

- [x] **Step 3: Test and Verify Task 1**
  Run `npm run lint` and `npm run build`.

---

### Task 2: "Zoom to Fit" (Auto-framing) for Diagram Canvas

**Files:**
- Modify: `src/components/CanvasControls.jsx`
- Modify: `src/components/ViewerPanel.jsx`
- Modify: `src/App.css`

- [x] **Step 1: Add `handleFitToScreen` in `src/components/ViewerPanel.jsx`**
  Calculates the total bounding box of visible diagram cards inside `.diagram-viewport` and computes optimal `zoom` and `pan` to fit centered inside `.diagram-workspace` with 32px margins.

- [x] **Step 2: Add `Maximize2` button in `src/components/CanvasControls.jsx`**
  Add a dedicated button with `Maximize2` icon: "Підігнати діаграми під розмір екрана".

- [x] **Step 3: Test and Verify Task 2**
  Run `npm run lint` and `npm run build`.

---

### Task 3: Resizable & Collapsible Code Editor Split Pane

**Files:**
- Modify: `src/components/CodeEditor.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [x] **Step 1: Add resizer handle and collapse toggle to `.app-container` in `src/App.jsx`**
  - Implement drag handler (`onMouseDown` / `onMouseMove` / `onMouseUp`) allowing smooth resizing between 280px and 720px.
  - Persist `editorWidth` in `localStorage`.
  - Add collapse toggle button (`<|` / `|>`) allowing 1-click full-screen canvas view.

- [x] **Step 2: Style resizer divider in `src/App.css`**
  Clean splitter bar (`width: 5px`, `cursor: col-resize`, subtle hover highlight `#3b82f6`).

- [x] **Step 3: Test and Verify Task 3**
  Run `npm run lint` and `npm run build`.

---

### Task 4: Card Layout Switcher in "Всі" View (Horizontal vs Vertical Stack)

**Files:**
- Modify: `src/components/ViewerPanel.jsx`
- Modify: `src/App.css`

- [x] **Step 1: Add layout toggle state in `ViewerPanel.jsx`**
  Add toggle button: "Поруч (колонки)" vs "Один під одним (вертикально)".
  Save preference `diagramsLayout` (`horizontal` | `vertical`) in `localStorage`.

- [x] **Step 2: Add `.layout-vertical` CSS rules in `src/App.css`**
  Allow `.diagram-viewport` to flow vertically when vertical layout is active.

- [x] **Step 3: Test and Verify Task 4**
  Run `npm run lint` and `npm run build`.

---

### Task 5: Header Simplification & Decluttering

**Files:**
- Modify: `src/components/Header.jsx`
- Modify: `src/App.css`

- [x] **Step 1: Refactor "Згенерувати" button**
  Transform the large attention-grabbing primary button into a clean action button with an active indicator ("⚡ Оновлено").

- [x] **Step 2: Remove redundant multi-file download dropdown from header**
  Cards already provide precise single-click SVG/PNG and Clipboard actions without triggering browser multi-download blocks.

- [x] **Step 3: Compact Donate button**
  Make the header donate button neat (`Heart` icon + "Підтримати") so the top bar feels like a focused, modern workstation.

- [x] **Step 4: Full verification**
  Run `npm run lint`, `npm run build`, and `node scripts/test_diagram_graph.mjs`.
