# Report2Excel: AI-Powered Report to Excel Converter

An intelligent, lightning-fast web application that converts **computer-generated and handwritten report sheets (PDFs and images) into clean, beautifully formatted Microsoft Excel spreadsheets (`.xlsx`)**.

Powered by the **Grok / Groq Vision AI**, Report2Excel features intelligent layout detection, a dedicated **⚡ Fast Handwritten Mode (~1.5s)**, in-browser table editing, and export-ready Excel formatting.

---

## ✨ Key Features

* **⚡ Ultra-Fast Vision Pipeline (~1.5s):**
  * Optimized token-efficient image pipeline using Sharp.
  * Resizes and encodes as lightweight JPEG (quality 80), reducing payload size by ~95% (from 1.4 MB down to ~75 KB).
  * Consumes ~600 vision tokens (down from 4,000+), preventing free-tier TPM rate limits (429) entirely.
* **🎯 Mode Selector (Default: Auto-Detect):**
  * **🤖 Auto-Detect (Default):** Automatically inspects and classifies document layout without manual effort.
  * **⚡ Fast Handwritten Mode (~1.5s):** Direct, lean prompt tailored for notebook pages and handwritten receipts. Automatically solves equations (e.g. `96+36=142` → `142`), resolves ditto marks (`"`), and strips unit words (`pcs`, `box`).
  * **▤ Computer Report Mode:** Dedicated 12-column Stock & Sales report extraction.
* **🎨 Rich Animations & Micro-Interactions:**
  * Ambient floating organic background glows and shimmering hero typography.
  * Futuristic laser scanning beam animation across the card during document processing.
  * Real-time live elapsed timer counter (`0.1s... 1.4s`) and spinner during extraction.
  * Smooth cascaded table row entrance animation.
  * Celebratory canvas confetti particle burst on successful extraction and Excel export.
* **📝 Interactive In-Browser Table Editing:**
  * Click any cell to edit spelling, names, or numbers directly on your screen.
  * **＋ Add Row** button to append missing items.
  * **× Delete Row** button: Polished muted-gray pill button that turns soft coral-red on hover for safe row management.
* **📱 100% Mobile & Tablet Responsive:**
  * Fully responsive design across all screen sizes (320px to 4K displays).
  * Zero horizontal viewport overflow; touch-friendly stacked controls and isolated table horizontal scroll.
* **📊 Professional Excel Export (`.xlsx`):**
  * **Header:** Vasu corporate dark emerald green (`#1D8A70`) with white bold text.
  * **Data:** Auto-fitted column widths, centered `SR.NO` and `PACK SIZE`, bold left-aligned `ITEM NAME`, and bold right-aligned `QUANTITY` (`#,##0`).
  * **Summary Row:** Automatically appends a styled `TOTAL` summary row calculating total quantities.
  * **Borders:** Subtle hairline borders across all cells for clean printing and reporting.

---

## 📋 Report Formats Supported

| Feature | 🤖 Auto-Detect / ✍️ Handwritten Slip | 🖥️ Computer-Generated Report |
| :--- | :--- | :--- |
| **Typical Document** | Notebook slips, handwritten receipts, paper order slips | Digital invoices, billing software PDFs, printed stock sheets |
| **Columns Extracted** | **4 Columns:**<br>• `SR.NO`<br>• `ITEM NAME`<br>• `PACK SIZE`<br>• `QUANTITY` | **12 Columns:**<br>• `ITEM DESCRIPTION`<br>• `PACK SIZE`<br>• `OPENING QTY` & `VALUE`<br>• `RECEIPT QTY` & `VALUE`<br>• `ISSUE QTY` & `VALUE`<br>• `CLOSING QTY` & `VALUE`<br>• `DUMP QTY`<br>• `M.EXP` (MM/YY) |
| **Equation Solver** | ✅ Auto-resolves math (e.g., `96+36=142` → `142`) | N/A (Standard tabular extraction) |
| **Average Speed** | **~1.4s – 2.5s** | **~3s – 5s** |
| **Requires API Key?** | ⚡ Yes (`GROK_API_KEY` in `.env`) | ⚡ Yes (`GROK_API_KEY` in `.env`) |

---

## 🛠️ Tech Stack

* **Backend:** [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
* **AI Vision Engine:** [Groq Cloud / xAI Grok Vision API](https://groq.com/) (e.g. `qwen/qwen3.8-27b`, `grok-2-vision-1212`)
* **Image & PDF Processing:** [Sharp](https://sharp.pixelplumbing.com/) & [pdf-lib](https://pdf-lib.js.org/)
* **Spreadsheet Generator:** [ExcelJS](https://github.com/exceljs/exceljs)
* **Frontend:** Vanilla HTML5, CSS3, and JavaScript (Zero external UI framework dependencies)

---

## 📦 Getting Started

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (version 18 or newer) installed.

### 2. Clone and Install Dependencies
Open your terminal and run:
```bash
git clone https://github.com/iamaadii/Report2Excel.git
cd Report2Excel/sourceCode
npm install
```

### 3. Environment Configuration
Create a `.env` file inside the `sourceCode` folder:
```env
# Add your Groq / Grok API key:
GROK_API_KEY=gsk_your_api_key_here
```

### 4. Run the Application
- **Development Mode (with live auto-reload):**
  ```bash
  npm run dev
  ```
- **Production Mode:**
  ```bash
  npm start
  ```

### 5. Access the Web Interface
Open your browser and navigate to:
```text
http://localhost:5000
```

---

## 🎯 How to Use

1. **Select Mode:** Choose between **🤖 Auto-Detect** (default), **⚡ Fast Handwritten (~1.5s)**, or **▤ Computer Report**.
2. **Upload Document:** Drop your PDF, JPG, JPEG, or PNG into the upload zone or click **Choose report**.
3. **Process:** Click **Process Report**. Watch the live laser scanner and timer indicator extract your rows in seconds.
4. **Review & Edit:** Review the extracted table. Click any cell to fix typos, use **＋ Add Row** to add missing items, or click **×** to remove rows.
5. **Download:** Click **Download Excel** to export a formatted `.xlsx` spreadsheet styled with Vasu corporate emerald branding.

---

## 📂 Project Structure

```text
Report2Excel/
├── README.md                            # Public documentation and user guide
├── notes.md                             # Technical architecture and implementation notes
└── sourceCode/
    ├── server.js                        # Express server entry point
    ├── controllers/
    │   └── invoiceController.js         # Request validation, mode handling, and Excel dispatch
    ├── middleware/
    │   └── uploadMiddleware.js          # Multer file upload validation (type & size limits)
    ├── public/                          # Frontend web interface
    │   ├── index.html                   # HTML structure, mode selector, table and canvas
    │   ├── style.css                    # Design system, animations, keyframes, and mobile media queries
    │   ├── script.js                    # Client logic, live timer, dynamic tables, confetti, and download
    │   ├── favicon.svg                  # Application favicon
    │   └── logo.png                     # Vasu Healthcare branding logo
    ├── routes/
    │   └── invoiceRoutes.js             # Express API routes (/process & /download)
    ├── services/
    │   ├── unifiedInvoiceService.js     # Vision AI extractor, prompt optimizer, and layout classifier
    │   ├── pdfService.js                # PDF page image extractor (pdf-lib & Sharp)
    │   ├── excelService.js              # Styled .xlsx generator with emerald headers and borders
    │   └── tempStorage.js               # Temporary directory path resolver
    ├── uploads/                         # Temporary folder for uploads (auto-cleaned)
    └── package.json
```

