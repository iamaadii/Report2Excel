# Developer Implementation & Architecture Notes

This document provides a comprehensive technical overview of the **Report2Excel** codebase, including performance optimizations, architectural decisions, and visual design systems.

---

## 1. High-Level Concept & Workflow

The application accepts **single-page** report documents (PDF, JPG, JPEG, PNG) through a unified upload interface.
Users can select their desired mode or leave it on **🤖 Auto-Detect** (default).

```text
               [User Uploads Single Document]
                           │
             [Client-Side Pre-validation]
      (Single file check, supported extensions)
                           │
          ┌────────────────┴────────────────┐
          ▼                                 ▼
    [Auto-Detect]                  [Fast Mode / Manual]
          │                                 │
          └────────────────┬────────────────┘
                           ▼
              [Server Validation & Sharp]
        - Single-page PDF check via pdf-lib
        - Non-report document rejection
        - Sharp optimization (~50 KB, ~550 tokens)
                           │
                           ▼
            [Groq / xAI Vision API Engine]
              (Multi-key quota rotation)
                           │
          ┌────────────────┴────────────────┐
          ▼                                 ▼
   [Handwritten Report]           [Computer-Generated]
     4 Columns Table                12 Columns Table
          │                                 │
          └────────────────┬────────────────┘
                           ▼
             [Interactive Screen Preview]
     - Inline ContentEditable cell editing
     - Real-time search & filter
     - Dynamic summary statistics bar
     - One-click TSV clipboard copy
                           │
                           ▼
           [Styled Excel Export (.xlsx)]
         (Emerald #1D8A70 Header + Total Row)
```

---

## 2. Core Performance & Reliability Optimizations

### ⚡ Vision Token & Rate Limit (TPM & OTPM) Mitigation
- **The Problem:** 
  1. Groq Cloud free-tier enforces **7,000 Tokens Per Minute (TPM)** and a strict **1,000 Output Tokens Per Minute (OTPM)** limit for `qwen/qwen3.8-27b`.
  2. Previously, large completion tokens exceeded the OTPM limit, causing HTTP 429 (`Request too large... OTPM: Limit 1000`).
- **The Solution:**
  - **OTPM Cap Tuning:** Capped `max_tokens` at `920` for Groq, strictly below the 1,000 ceiling. 920 tokens easily fits 50+ lines of 12-column pipe-separated data (~18 tokens/row).
  - **Image Resizing (960px, JPEG 76):** Reduced payload to ~48 KB and vision tokens to ~550 tokens, eliminating TPM exhaustion even with back-to-back uploads.
  - **Digital PDF Fast-Track:** For native digital PDFs, the server extracts the raw text layer and queries the text API. Takes **~1.5s**, uses 0 vision tokens, and gives 100% character accuracy.
  - **Multi-Key Quota Rotation:** Supports `GROQ_API_KEYS` (comma-separated). When an active key encounters a 429 rate limit or quota exhaustion, it seamlessly rotates to the next available key without failing user requests.

### ⚡ Strict Document Verification & Single-Page Rule
- **Single-Page Enforcement:** `pdf-lib` inspects PDF page count in `reportController.js`. If a user uploads a multi-page PDF, it immediately returns HTTP 400 with actionable tips before sending anything to the AI model, conserving quota.
- **Verification Prompting:** The AI prompt verifies whether the image contains a legitimate handwritten slip or inventory report. If an irrelevant image (selfie, random photo, landscape) is uploaded, the AI outputs `STATUS: INVALID_DOCUMENT`, and the frontend presents a user-friendly guidance card.

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
   - Generates instant client-side thumbnail preview (images) or document chip (PDF).
   - Card enters '.processing' state: triggers laser scan animation and starts live elapsed timer.
   - Posts multipart/form-data to /api/reports/process.

2. EXPRESS BACKEND (server.js & routes/reportRoutes.js)
   - Multer middleware validates single file MIME type and stages in 'uploads/' directory.
   - reportController.processReport validates single-page count and extracts request mode.

3. VISION EXTRACTION (services/reportExtractionService.js)
   - If PDF: services/pdfService.js checks page count and converts single page to buffer.
   - Image buffer resized to 960px max and encoded as JPEG 76.
   - Dispatches payload to Groq Vision API (model: qwen/qwen3.8-27b or xAI grok-2-vision-1212).
   - Robust line/pipe parser parses rows, handles bracket auto-repair, and cleans quantities.
   - Temporary upload files are deleted safely with Windows retry unlocking.
   - Returns { success: true, reportType, rows, timeSeconds }.

4. BROWSER PREVIEW & LIVE EDITING (public/script.js)
   - Stops live timer, launches celebratory confetti particles.
   - Dynamically renders 4-column or 12-column table with staggered entrance animation.
   - Real-time search filter hides non-matching rows on input.
   - Summary statistics bar dynamically recalculates total rows and sum of quantities.
   - One-click "Copy Data" puts clean TSV into clipboard for Google Sheets/Excel.
   - User can add rows (+ Add Row) or delete rows (× Delete Row).

5. EXCEL EXPORT (services/excelService.js)
   - Posts updated rows and reportType to /api/reports/download.
   - ExcelJS generates styled workbook:
     - Header: Vasu corporate emerald green (#1D8A70), white bold text, height 28.
     - Cells: Center/left/right alignments, light hairline borders (#E2E8E5), auto-calculated column widths.
     - Summary: Appends styled TOTAL row with sum of quantities.
   - Streams file back to browser for download; cleans temporary .xlsx file.
```

---

## 4. UI Design System & Theming

- **Dark / Light Mode System:**
  - Full theme switching with automatic detection of OS system preferences (`prefers-color-scheme`).
  - Saved to `localStorage` for cross-session persistence.
  - In dark mode, the Vasu brand logo is nested in a sleek translucent glass badge to maintain 100% brand integrity without unnatural color inversion.
  - High-contrast column colors tailored for dark surfaces (crisp white item descriptions, luminous mint quantities, soft silver secondary metadata).
- **Ambient Background Glows:** Three fixed radial orbs with `@keyframes floatOrb1/2/3` providing organic depth without layout shift.
- **Laser Scanner:** Pure CSS `@keyframes laserSweep` gradient line sweeping across the card during processing.
- **Confetti Particle Engine:** Pure HTML5 Canvas zero-dependency particle physics system triggered upon extraction and download.
- **Mobile Responsive Engine:**
  - Responsive breakpoints across all screen sizes (1536px, 1200px, 900px, 680px, 480px, and 360px).
  - Single-row parallel navigation for logo and theme toggle on mobile.
  - Isolated touch scrolling for wide tables (`-webkit-overflow-scrolling: touch`).
  - Prevention of reload scroll jumping via `history.scrollRestoration = 'manual'`.

---

## 5. Environment Variables & Configuration

The application requires at least one Vision API key configured in `sourceCode/.env`:

| Variable | Required? | Default | Description |
| :--- | :--- | :--- | :--- |
| `GROK_API_KEY` / `GROQ_API_KEY` | **Yes** | — | API key for Groq Cloud (`gsk_...`) or xAI (`xai-...`). |
| `GROQ_API_KEYS` | No | — | Optional comma-separated list of secondary Groq keys for automatic 429 quota failover. |
| `GROK_BASE_URL` / `GROQ_BASE_URL` | No | Auto-detected | `https://api.groq.com/openai/v1` or `https://api.x.ai/v1`. |
| `GROK_MODEL` / `GROQ_MODEL` | No | Auto-detected | Defaults to `qwen/qwen3.8-27b` (Groq) or `grok-2-vision-1212` (xAI). |
| `GROK_MAX_TOKENS` | No | `920` (Groq) | Max completion tokens. Keep ≤ 950 on Groq free-tier to prevent OTPM 429. |
| `PORT` | No | `5000` | Express HTTP server port for local development. |

---

## 6. API Reference (Backend Endpoints)

### `POST /api/reports/process`
Uploads and extracts report rows from a single-page document.
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `report`: Binary file (single-page PDF, JPG, JPEG, PNG, max 10MB).
  - `mode`: `"auto"` (default), `"fast_handwritten"`, or `"computer"`.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "invoiceType": "handwritten",
    "rows": [
      { "srNo": 1, "itemName": "BTONIC", "packSize": "200ML", "quantity": 142 }
    ],
    "timeSeconds": 2.1
  }
  ```
- **Response `400 Bad Request` (Invalid Document / Multi-Page):**
  ```json
  {
    "success": false,
    "message": "Only single-page PDF reports are supported (Uploaded document has 3 pages).",
    "tip": "Please upload only page 1 or split your PDF into a single-page document.",
    "category": "multi_page"
  }
  ```

### `POST /api/reports/download`
Generates a styled Excel `.xlsx` file from the client table.
- **Content-Type:** `application/json`
- **Body:**
  ```json
  {
    "reportType": "handwritten",
    "rows": [ /* array of edited row objects */ ]
  }
  ```
- **Response `200 OK`:** Binary `.xlsx` file stream (`Content-Disposition: attachment`).

---

## 7. Directory Breakdown

| File / Directory | Purpose |
| :--- | :--- |
| `server.js` | Express app initialization, static middleware, CORS, canvas polyfills, and port binding. |
| `routes/reportRoutes.js` | Route definitions for `/process` (upload) and `/download` (export). |
| `controllers/reportController.js` | Request validation, single-page verification, mode routing, error tips, and file cleanup. |
| `middleware/uploadMiddleware.js` | Multer upload configuration with file extension filters and size limits. |
| `services/reportExtractionService.js` | Vision AI caller, Sharp preprocessing, prompt router, multi-key rotation, and line parser. |
| `services/pdfService.js` | Extracts embedded images, digital text, and validates single-page count. |
| `services/excelService.js` | Generates branded `.xlsx` spreadsheets with emerald header, formulas, and totals. |
| `services/tempStorage.js` | Resolves temporary storage paths safely between local (`uploads/`) and Vercel (`/tmp`). |
| `public/index.html` | UI markup, theme switcher, drag-drop zone, search filter, and table preview container. |
| `public/style.css` | Comprehensive design system, media queries, dark mode theme system, and keyframe animations. |
| `public/script.js` | DOM handlers, theme management, live search, TSV clipboard export, summary metrics, and inline table editor. |
| `uploads/` | Scratch directory for transient uploads (cleaned after each request). |
