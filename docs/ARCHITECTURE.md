# Developer Implementation & Architecture Notes

This document provides a comprehensive technical overview of the **Report2Excel** codebase, including performance optimizations, architectural decisions, and visual design systems.

---

## 1. High-Level Concept & Workflow

The application accepts **any** report or invoice (PDF, JPG, JPEG, PNG) through a single unified upload interface.
Users can select their desired mode or leave it on **🤖 Auto-Detect** (default).

```text
               [User Uploads Document]
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
   [Auto-Detect]                  [Fast Mode / Manual]
         │                                 │
         └────────────────┬────────────────┘
                          ▼
             [Sharp Image Optimization]
        (1024px max, JPEG 80% compression)
        (~75 KB payload, ~600 vision tokens)
                          │
                          ▼
           [Groq / xAI Vision API Engine]
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
  [Handwritten Report]           [Computer-Generated]
    4 Columns Table                12 Columns Table
         │                                 │
         └────────────────┬────────────────┘
                          ▼
            [Interactive Screen Preview]
        (Inline Cell Edit + Add/Delete Row)
                          │
                          ▼
          [Styled Excel Export (.xlsx)]
        (Emerald #1D8A70 Header + Total Row)
```

---

## 2. Core Performance Optimizations

### ⚡ Vision Token & Rate Limit (TPM & OTPM) Mitigation
- **The Problem:** 
  1. Groq Cloud free-tier enforces **7,000 Tokens Per Minute (TPM)** and a strict **1,000 Output Tokens Per Minute (OTPM)** limit for `qwen/qwen3.8-27b`.
  2. Previously, CBT/computer extraction set `max_tokens: 1200` to `1400`. Because 1200 > 1000 OTPM limit, Groq immediately refused requests upfront with HTTP 429 (`Request too large... OTPM: Limit 1000, Requested 1062/1200`).
  3. The server then waited ~22s before automatic retries, causing CBT files to take **~28 seconds**.
- **The Solution:**
  - **OTPM Cap Tuning:** Capped `max_tokens` at `920` for Groq, strictly below the 1,000 ceiling. 920 tokens easily fits 50+ lines of 12-column pipe-separated data (~18 tokens/row).
  - **Image Resizing (960px, JPEG 76):** Reduced payload to ~48 KB and vision tokens to ~550 tokens, eliminating TPM exhaustion even with multiple back-to-back uploads.
  - **Digital PDF Fast-Track:** For native digital PDFs (exported from Tally, Busy, Marg, SAP), the server directly extracts the raw text layer and queries the text API. Takes **~1.5s**, uses 0 vision tokens, and gives 100% character accuracy.
  - **Parallel Multi-Page Processing:** Pages are processed concurrently in batches of 2 with `Promise.all` instead of sequential waits.
  - **Result:** Turnaround dropped from **28 seconds down to 1.4s – 2.6 seconds!**

### ⚡ Lean Prompt Routing
- **Fast Handwritten Mode (`mode: 'fast_handwritten'`):**
  - Uses a focused 4-column prompt without computer report instructions.
  - Automatically parses math equations (`cleanQuantity`: e.g. `96+36=142` → `142`).
  - Resolves ditto marks (`"`, `u`) from preceding rows and strips unit labels (`pcs`, `box`).
- **Auto-Detect Mode (`mode: 'auto'`):**
  - High-speed dual prompt that outputs `TYPE: handwritten` or `TYPE: computer` on line 1, followed by corresponding data rows.

---

## 3. Data Flow Architecture

```text
1. CLIENT BROWSER (public/index.html & script.js)
   - User selects file and mode (Auto-Detect, Fast Handwritten, or Computer).
   - Card enters '.processing' state: triggers laser scan animation and starts live elapsed timer.
   - Posts multipart/form-data to /api/invoices/process.

2. EXPRESS BACKEND (server.js & routes/invoiceRoutes.js)
   - Multer middleware validates MIME type and saves to 'uploads/' directory.
   - invoiceController.processInvoice reads file and extracts request mode.

3. VISION EXTRACTION (services/unifiedInvoiceService.js)
   - If PDF: services/pdfService.js extracts page buffers via pdf-lib and Sharp.
   - Image buffer resized to 1024px max and encoded as JPEG 80.
   - Dispatches payload to Groq Vision API (model: qwen/qwen3.8-27b or xAI grok-2-vision-1212).
   - Robust line/pipe parser parses rows, handles bracket auto-repair, and cleans quantities.
   - Deletes temporary upload file immediately.
   - Returns { success: true, invoiceType, rows, timeSeconds }.

4. BROWSER PREVIEW & LIVE EDITING (public/script.js)
   - Stops live timer, launches celebration confetti.
   - Dynamically renders 4-column or 12-column table with staggered entrance animation (--row-index).
   - Cells are contentEditable: user edits propagate directly to internal 'invoiceRows' array.
   - User can add rows (+ Add Row) or delete rows (× Delete Row).

5. EXCEL EXPORT (services/excelService.js)
   - Posts updated rows and invoiceType to /api/invoices/download.
   - ExcelJS generates styled workbook:
     - Header: Vasu corporate emerald green (#1D8A70), white bold text, height 28.
     - Cells: Center/left/right alignments, light hairline borders (#E2E8E5), auto-calculated column widths.
     - Summary: Appends styled TOTAL row with sum of quantities.
   - Streams file back to browser for download; cleans temporary .xlsx file.
```

---

## 4. UI Animation & Responsive Design System

- **Ambient Background Glows:** Three fixed radial orbs with `@keyframes floatOrb1/2/3` providing organic depth without layout shift.
- **Laser Scanner:** Pure CSS `@keyframes laserSweep` gradient line sweeping across the card during processing.
- **Confetti Particle Engine:** Pure HTML5 Canvas zero-dependency particle physics system triggered upon extraction and download.
- **Mobile Responsive Engine:**
  - Universal box-sizing and `overflow-x: hidden` on `html` and `body` to eliminate horizontal scrollbars.
  - Stacked touch-friendly mode pills on screens `< 540px`.
  - Action buttons (`Add Row` and `Download`) adapt from horizontal flex to vertical stack.
  - Data table scrolls smoothly inside `.table-container` with isolated touch scrolling.

---

## 5. Directory Breakdown

| File / Directory | Purpose |
| :--- | :--- |
| `server.js` | Express app initialization, static middleware, CORS, and port binding. |
| `routes/invoiceRoutes.js` | Route definitions for `/process` (upload) and `/download` (export). |
| `controllers/invoiceController.js` | Request validation, mode routing, error handling, and file cleanup. |
| `middleware/uploadMiddleware.js` | Multer upload configuration with file extension filters. |
| `services/unifiedInvoiceService.js` | Vision AI caller, Sharp preprocessing, prompt router, and line parser. |
| `services/pdfService.js` | Extracts embedded images from PDF pages without native canvas binaries. |
| `services/excelService.js` | Generates branded `.xlsx` spreadsheets for both report types. |
| `services/tempStorage.js` | Resolves temporary storage paths safely. |
| `public/index.html` | UI markup, mode selector, drag-drop zone, and table preview container. |
| `public/style.css` | Comprehensive design system, media queries, and keyframe animations. |
| `public/script.js` | DOM handlers, timer interval, confetti canvas, and inline table editor. |
| `uploads/` | Scratch directory for transient uploads (cleaned after each request). |
