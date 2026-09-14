# Developer Notes: Complete Internal Guide to Report2Excel

> **Why this file exists:**  
> Read this file whenever you come back to this project after months or years. It explains the **internal implementation**, the **exact role of every single file**, and **how the pieces fit together**, all written in plain, simple English.

---

## 1. The Big Picture

This app converts **printed reports** and **handwritten notes** (images or PDFs) into clean **Excel sheets (`.xlsx`)**.

```text
Upload File (Image/PDF)
         │
         ▼
Check: Is it Printed or Handwritten?
         │
    ┌────┴───────────────────────────┐
    ▼                                ▼
[Computer-Generated]           [Handwritten]
Read with PDF text / OCR       Read with Gemini AI
(100% offline)                 (With 100% offline local backup)
    │                                │
    ▼                                ▼
12 Columns Table               4 Columns Table
    │                                │
    └────────────────┬───────────────┘
                     ▼
             Preview on Screen
           (Edit cells if needed)
                     │
                     ▼
            Download Excel File
```

---

## 2. Architecture & Data Flow

Here is how data travels inside the app from the moment you select a file to the moment an Excel file downloads:

```text
USER BROWSER (public/index.html & script.js)
  │
  │  1. User selects a file and clicks "Process Report"
  │     (Frontend clears any previous report data to avoid collisions)
  ▼
EXPRESS BACKEND (server.js & routes/invoiceRoutes.js)
  │
  │  2. File goes through Multer (middleware/uploadMiddleware.js)
  │     Saved temporarily in 'uploads/' folder
  ▼
CONTROLLER (controllers/invoiceController.js)
  │
  │  3. Controller decides which engine to run:
  │
  ├─── IF "computer":
  │      ├─ Is it a PDF?
  │      │    └─ services/pdfService.js checks for digital text.
  │      │         ├─ Text found? -> services/rowParser.js splits text into 12 columns.
  │      │         └─ Scanned PDF? -> Extracts page images -> services/ocrService.js runs OCR.
  │      └─ Is it an Image?
  │           └─ services/imageService.js enhances it -> services/ocrService.js reads it -> services/rowParser.js parses it.
  │
  └─── IF "handwritten":
         └─ services/handwrittenInvoiceService.js
              ├─ Has GEMINI_API_KEY in .env?
              │    └─ YES: Calls Google Gemini 3.6 Flash AI with prompt and gets clean JSON.
              │    └─ Quota reached / error? -> Automatically goes to offline fallback.
              └─ NO API key / Offline?
                   └─ services/localHandwrittenParser.js (100% Offline Local Engine)
                        ├─ Checks rotation (0°, 90°, 180°, 270°) and turns photo upright.
                        ├─ Runs multi-pass image contrast to make faint ink readable.
                        ├─ Groups words into table rows by Y-coordinates.
                        └─ Assigns words to Sr.No, Item Name, Pack Size, Quantity.
  │
  ▼
BROWSER PREVIEW (public/script.js)
  │  4. Rows return to browser as JSON.
  │  5. Table renders cleanly on screen.
  │  6. User can click any cell to fix typos.
  │
  │  7. User clicks "Download Excel"
  ▼
EXCEL BUILDER (services/excelService.js)
  │  8. Uses ExcelJS to style green headers, set column widths, and save .xlsx.
  ▼
USER DOWNLOADS EXCEL FILE
```

---

## 3. Role of Each File (Internal Implementation)

### A. The Server & Routing Files

#### 1. `sourceCode/server.js`
* **What it does:** The main door to the backend. It starts the Node.js Express server on port 5000.
* **Key details:**
  * Loads variables from `.env` using `dotenv`.
  * Enables CORS so the frontend can talk to the backend without permission errors.
  * Serves frontend files from the `public/` folder (`index.html`, `style.css`, `script.js`).
  * Mounts the invoice routes at `/api/invoices`.

#### 2. `sourceCode/routes/invoiceRoutes.js`
* **What it does:** Defines the two main API paths:
  * `POST /api/invoices/process`: Receives uploaded files and extracts table rows.
  * `POST /api/invoices/download`: Takes the table rows and creates the downloadable Excel file.

#### 3. `sourceCode/middleware/uploadMiddleware.js`
* **What it does:** Uses `multer` to handle file uploads.
* **Key details:**
  * Checks file types: only allows `.pdf`, `.jpg`, `.jpeg`, `.png`.
  * Sets file size limit to 10MB.
  * Saves files temporarily into the `uploads/` folder with unique timestamps (e.g. `invoice-1789372132853.jpeg`).

#### 4. `sourceCode/controllers/invoiceController.js`
* **What it does:** The brain of the backend. It receives requests from routes, orchestrates the services, and returns responses.
* **Key functions inside:**
  * `processInvoice(req, res)`:
    * Checks if a file was actually uploaded.
    * Checks `req.body.invoiceType` (`computer` vs `handwritten`).
    * **Mismatch check:** If a user puts a computer PDF in the handwritten section, it catches it and tells the user to switch sections.
    * Routes to `extractHandwrittenInvoice()` for handwritten, or `processComputerPdf()` / `performOCR()` for computer reports.
    * Automatically deletes temporary files when done so your hard disk doesn't fill up.
  * `downloadExcel(req, res)`:
    * Receives the verified table rows from the frontend.
    * Calls `createExcelFile()` for computer format (12 columns) or `createHandwrittenExcelFile()` for handwritten format (4 columns).
    * Sends the `.xlsx` file stream to the browser to trigger the download.

---

### B. Handwritten Processing Services

#### 5. `sourceCode/services/handwrittenInvoiceService.js`
* **What it does:** Manages handwritten report extraction. It tries Google Gemini AI first, and if that is not available, it calls the offline local parser.
* **Key functions & logic:**
  * `extractHandwrittenInvoice(inputPath)`:
    1. Reads `process.env.GEMINI_API_KEY`.
    2. If no key, it logs: *"No valid GEMINI_API_KEY found. Performing local extraction..."* and calls `parseHandwrittenLocally()`.
    3. If a key is present, it connects to Google Gemini using model **`gemini-3.6-flash`**.
    4. Sends the image/PDF as a base64 buffer with prompt rules:
       * Any product name is valid (shampoo, oil, tablets, etc.).
       * Ignore dealer phone numbers, GST numbers, and signatures.
       * Strip horizontal dashes (e.g. `Item ----- 100ml ----- 10 Pcs`).
       * Evaluate math equations (e.g. `96 + 36` becomes `132`).
       * Expand ditto marks (`u`, `"`) to repeat the item name from the row above.
    5. **Try / Catch Fallback:** If Gemini returns an error (such as quota exceeded `429`, model issue `404`, or no internet), it catches the error and automatically runs `parseHandwrittenLocally(inputPath)` so the user still gets their data.

#### 6. `sourceCode/services/localHandwrittenParser.js`
* **What it does:** The **100% offline, zero-API fallback engine** for handwritten reports. It can extract data from images and PDFs without any internet connection.
* **How it works internally:**
  1. **Document Orientation Detection (`detectBestOrientation`):**
     * Photos taken with mobile phones are often rotated sideways (90° or 270°).
     * It tests rotations (0°, 90°, 270°) with quick sample OCR checks and picks the angle where words read normally.
  2. **Multi-Pass Image Contrast (`processImageAdaptive`):**
     * Handwritten ink is often faint, or paper has blue ruling lines or shadows.
     * It runs 4 different contrast passes:
       * *Pass A (Linear Contrast):* Darkens faint ink strokes.
       * *Pass B (Thresholding):* Turns paper background pure white.
       * *Pass C (Normalize):* Balances uneven lighting across the page.
       * *Pass D (Dilation):* Thickens thin pen lines.
     * It scores each pass and picks the one that produces the most valid table rows.
  3. **Spatial Tabular Clustering (`parseSpatialTsv`):**
     * Normal OCR scrambles handwritten text into a single messy paragraph.
     * This service gets word coordinates (`left`, `top`, `width`, `height`) from Tesseract TSV data.
     * Words with similar `top` coordinates are grouped into the same horizontal line (row).
     * Words are then sorted by horizontal `left` position into 4 columns:
       * Column 1 (`0% - 15%` of width): `Sr. No`
       * Column 2 (`15% - 58%` of width): `Item Name`
       * Column 3 (`58% - 82%` of width): `Pack Size`
       * Column 4 (`82% - 100%` of width): `Quantity`
  4. **Text Cleanup (`cleanDigit`, `cleanPackSize`, `resolveItemName`):**
     * Fixes OCR confusion: turns `lo` into `10`, `I` or `l` into `1`, `O` into `0`.
     * Fixes pack sizes: turns `2oec` into `200g`, `m1` or `mt` into `ml`.
     * If an item name matches known catalogs, it corrects minor spelling mistakes.

---

### C. Computer-Generated Processing Services

#### 7. `sourceCode/services/pdfService.js`
* **What it does:** Handles everything related to PDF files (single-page or multi-page).
* **Key functions:**
  * `extractTextFromPdf(filePath)`: Reads the invisible digital text layer inside vector PDFs using `pdfjs-dist`.
  * `extractImagesFromPdf(filePath)`: If the PDF is a scanned document (no text layer), it inspects the internal PDF objects and extracts the raw scanned image streams (supporting `DCTDecode` for JPEGs and `FlateDecode` for PNG/TIFF streams, in RGB and CMYK color spaces).
  * `processComputerPdf(filePath)`: Tries digital text first. If empty, extracts page images and passes them to OCR.

#### 8. `sourceCode/services/ocrService.js`
* **What it does:** Wraps `tesseract.js` for reading text from images.
* **Key details:**
  * Initializes a reusable Tesseract worker pool to avoid reloading the language files on every single image.
  * Uses local `eng.traineddata` so it never needs to download OCR models from the web.
  * Returns both raw `text` and structured bounding-box `tsv` data.

#### 9. `sourceCode/services/imageService.js`
* **What it does:** Preprocesses images before OCR using the `sharp` library.
* **Key details:**
  * Resizes very large or very small images to standard width (around 1800px).
  * Converts images to grayscale (black and white).
  * Normalizes contrast and sharpens edges to make printed numbers sharp and clear.

#### 10. `sourceCode/services/rowParser.js`
* **What it does:** Takes raw printed text from OCR and parses it into the **12 columns** required for computer-generated reports.
* **Columns parsed:**
  1. `itemDescription` (Product name)
  2. `packSize` (e.g. 100ML, 200ML, 10X10)
  3. `openingQty`
  4. `openingValue`
  5. `receiptQty`
  6. `receiptValue`
  7. `issueQty`
  8. `issueValue`
  9. `closingQty`
  10. `closingValue`
  11. `dumpQty`
  12. `mExp` (Expiry date in MM/YY)

#### 11. `sourceCode/services/documentClassificationService.js`
* **What it does:** Tells whether a document is a computer-printed report or a handwritten report without calling any external AI API.
* **How:** Checks for common printed keywords like `OPENING VALUE`, `CLOSING VALUE`, `RECEIPT QTY`, `BATCH NO`, `GSTIN`. If 2 or more match, it is classified as a computer report.

---

### D. Excel Generation Service

#### 12. `sourceCode/services/excelService.js`
* **What it does:** Turns rows of JavaScript data into an actual `.xlsx` Excel spreadsheet using `exceljs`.
* **Two formats created:**
  1. `createExcelFile(rows)`:
     * Creates a 12-column worksheet.
     * Freezes row 1 (the header) so headers stay visible when scrolling down.
     * Styles headers with dark teal background and bold white text.
  2. `createHandwrittenExcelFile(rows)`:
     * Creates a clean 4-column worksheet: `SR.NO`, `ITEM NAME`, `PACK SIZE`, `QUANTITY`.
     * Centers numbers and serial numbers for clean reading.

---

### E. Frontend Files (`public/`)

#### 13. `sourceCode/public/index.html`
* **What it does:** The visual page structure.
* **Contains:**
  * **Header:** Logo and title.
  * **Workflow indicator:** Steps `01 Upload` → `02 Review` → `03 Export`.
  * **Two upload cards:** One for *Computer-Generated Report* and one for *Handwritten Report*.
  * **Preview section:** Table container with `<tbody id="tableBody">` and the green **Download Excel** button.

#### 14. `sourceCode/public/script.js`
* **What it does:** Controls everything that happens in the browser.
* **Key functions & features:**
  * `enableDropZone()`: Adds drag-and-drop support so users can drop files directly onto the cards.
  * `clearComputerSection()` & `clearHandwrittenSection()`: Clears the other card whenever you start working on one.
  * `clearPreviewSection()`: Empties previous rows, reset table styles, and hides the preview before new data arrives.
  * `renderComputerTable(rows)`: Builds the 12-column table with horizontal scrolling (`min-width: 1200px`).
  * `renderHandwrittenTable(rows)`: Builds the 4-column table (`width: 100%; table-layout: fixed`).
  * `contenteditable="true"`: Makes table cells directly editable by clicking on them.
  * `downloadBtn` event listener: Sends the current (edited) table rows back to `/api/invoices/download` to get the `.xlsx` file.

#### 15. `sourceCode/public/style.css`
* **What it does:** Makes the website look clean and modern.
* **Key styling rules:**
  * `.computer-table`: Gives column 1 (`Item Description`) at least 320px width so long product names don't wrap awkwardly.
  * `.handwritten-table`: Gives column 1 (`SR.NO`) 60-80px, column 2 (`ITEM NAME`) 250px, column 3 (`PACK SIZE`) 120px, and column 4 (`QUANTITY`) 100px.
  * Scoped classes ensure that computer and handwritten styles **never collide or distort each other**.

---

## 4. How the "Preview Collision" Bug Was Solved

### The Problem:
If a user generated a handwritten report (4 columns) and then generated a computer report (12 columns) — or vice-versa — the second report looked squished, overlapping, and corrupted on screen.

### Why it happened:
1. Both tables shared the exact same `<table>` element.
2. Handwritten table set `table-layout: fixed; width: 100%` inline on the table.
3. When the 12-column computer report was loaded, that `table-layout: fixed` was still active, forcing 12 wide columns to squeeze into the screen width.
4. Unscoped CSS `th:first-child { min-width: 350px }` stretched the `SR.NO` column of handwritten reports to 350px.

### How we fixed it:
1. **Clean Slate (`clearPreviewSection`):** Whenever a file is selected or processed, the table completely strips any previous inline styles (`invoiceTable.removeAttribute("style")`) and empties both `thead` and `tbody`.
2. **Dedicated Table Classes:**
   * Computer tables use `.computer-table` with `table-layout: auto; min-width: 1200px;` and horizontal scroll.
   * Handwritten tables use `.handwritten-table` with `table-layout: fixed; width: 100%;`.
3. **Bi-Directional Card Clearing:** Selecting a file in one card immediately resets the other card's input, filename, and status.

---

## 5. How to Run & Test (Quick Reference)

### 1. Starting the server
Open your terminal in `sourceCode` and run:
```bash
npm run dev
```
Open browser at: `http://localhost:5000`

### 2. Environment variables (`.env`)
The `.env` file lives inside `sourceCode/.env`:
```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.6-flash
```
* If you have a key, handwritten files are processed in ~1-2 seconds using Gemini AI.
* If you leave the key blank or commented out, handwritten files are automatically processed locally using the offline parser.

---

## 6. Reading Order for Developers

If you want to read through the source code to refresh your memory, read in this exact order:
1. `sourceCode/server.js` (Server setup)
2. `sourceCode/routes/invoiceRoutes.js` (Route endpoints)
3. `sourceCode/controllers/invoiceController.js` (Traffic director)
4. `sourceCode/services/handwrittenInvoiceService.js` (AI extraction + fallback trigger)
5. `sourceCode/services/localHandwrittenParser.js` (Offline handwritten engine)
6. `sourceCode/services/pdfService.js` & `rowParser.js` (Computer report engine)
7. `sourceCode/services/excelService.js` (Excel workbook creator)
8. `sourceCode/public/script.js` (Frontend interaction & table rendering)
