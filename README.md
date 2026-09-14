# Report2Excel 📊

> **Convert printed reports and handwritten invoices into clean, editable Excel files in seconds.**

Report2Excel is an easy-to-use web application that automates document data entry. Simply upload a PDF or image of a report, review and edit the extracted data directly in your browser, and download a ready-to-use Excel (`.xlsx`) file.

---

## 🌟 What Problems Does This Solve?

Manually typing numbers from reports and inventory sheets into Excel is slow, tedious, and prone to mistakes. Report2Excel solves this by:

1. **Reading Computer-Generated Reports:** Automatically extracts tables from digital or scanned PDFs and images into a standardized **12-column** format.
2. **Reading Handwritten Documents:** Accurately reads pen-and-paper notes, notebook pages, and slips into a clean **4-column** format (`SR.NO`, `ITEM NAME`, `PACK SIZE`, `QUANTITY`).
3. **Working 100% Offline When Needed:** If you don't have an AI API key or the internet goes down, built-in offline code takes over so the app **never crashes**.

---

## 🚀 Key Features

* **Universal File Support:** Upload PDFs, JPG, JPEG, or PNG images.
* **Smart Document Detection:** Automatically identifies whether a file is printed or handwritten, and offers a 1-click button to move it if you uploaded it to the wrong card.
* **Dual-Engine Handwritten Reading:**
  * **Primary (Fast AI):** Uses Google Gemini AI (`gemini-3.6-flash`) to read handwriting, resolve math equations (e.g. `96+36` → `132`), and expand ditto marks.
  * **Offline Fallback Engine:** Built-in computer vision code rotates sideways smartphone photos, cleans faint ink, and extracts tabular rows without needing any API key or internet.
* **Interactive In-Browser Preview:** Review extracted rows on your screen and click any cell to edit spelling or numbers before downloading.
* **Clean Table Display:** Isolated table layouts ensure 12-column computer tables and 4-column handwritten tables never squish or overlap.
* **One-Click Excel Download:** Generates professionally styled `.xlsx` workbooks with bold headers and proper column widths.

---

## 📋 The Two Report Formats

| Feature | 🖥️ Computer-Generated Report | ✍️ Handwritten Report |
| :--- | :--- | :--- |
| **Typical Document** | Digital invoices, billing software PDFs, printed stock sheets | Notebook pages, handwritten slips, paper order registers |
| **Excel Columns** | **12 Columns:**<br>• Item Description<br>• Pack Size<br>• Opening Qty & Value<br>• Receipt Qty & Value<br>• Issue Qty & Value<br>• Closing Qty & Value<br>• Dump Qty<br>• Expiry Date (MM/YY) | **4 Columns:**<br>• SR.NO<br>• ITEM NAME<br>• PACK SIZE<br>• QUANTITY |
| **Extraction Engine** | Digital PDF parser / Local Tesseract OCR (100% Offline) | Google Gemini 3.6 Flash AI (with automatic offline local fallback) |
| **Requires API Key?** | ❌ No (Zero API calls, runs completely offline) | ⚡ Optional (Uses Gemini AI if key is present; runs offline code if not) |

---

## 🛠️ Tech Stack

* **Backend:** [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
* **OCR & Vision:** [Tesseract.js](https://github.com/naptha/tesseract.js/) & [Sharp](https://sharp.pixelplumbing.com/)
* **PDF Processing:** [pdf-lib](https://pdf-lib.js.org/) & [pdfjs-dist](https://mozilla.github.io/pdf.js/)
* **AI Model:** [Google Gemini 3.6 Flash](https://aistudio.google.com/) via `@google/genai`
* **Excel Builder:** [ExcelJS](https://github.com/exceljs/exceljs)
* **Frontend:** Clean Vanilla HTML5, CSS3, and JavaScript (No heavy frameworks required)

---

## 📦 Getting Started

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (version 18 or newer) installed on your computer.

### 2. Clone and Install Dependencies
Open your terminal and run:
```bash
git clone https://github.com/iamaadii/Report2Excel.git
cd Report2Excel/sourceCode
npm install
```

### 3. Environment Variables (Optional)
Create a `.env` file inside the `sourceCode` folder:
```env
# Optional: Add your Google Gemini API key for fast cloud AI handwriting extraction
GEMINI_API_KEY=your_gemini_api_key_here
```
> **Note:** If you don't provide an API key, the app will still work! It will automatically use the built-in offline engine to read handwritten reports.

### 4. Run the App
- **Development Mode (with auto-restart):**
  ```bash
  npm run dev
  ```
- **Production Mode:**
  ```bash
  npm start
  ```

### 5. Open in Your Browser
Open your browser and navigate to:
```text
http://localhost:5000
```

---

## 🎯 How to Use (User Guide)

1. **Choose Report Type:**
   - Use the **Computer-Generated Report** card for printed bills or digital PDFs.
   - Use the **Handwritten Report** card for notes or register photos.
2. **Upload File:** Drag and drop your file onto the card or click **Choose report**.
3. **Process:** Click the **Process Report** button.
4. **Review & Edit:** The extracted data appears in an interactive table. Click into any cell to fix typos or adjust quantities if needed.
5. **Download:** Click **Download Excel** to save the `.xlsx` file to your computer.

---

## 📂 Project Directory Structure

```text
Report2Excel/
├── README.md                            # Public guide for users and contributors
├── notes.md                             # Deep-dive developer documentation
└── sourceCode/
    ├── server.js                        # Express server entry point
    ├── controllers/
    │   └── invoiceController.js         # Core request routing and Excel dispatch
    ├── middleware/
    │   └── uploadMiddleware.js          # File validation (type & size limits)
    ├── public/                          # Frontend web interface
    │   ├── index.html                   # Upload cards and preview layout
    │   ├── style.css                    # Styling and table styling
    │   ├── script.js                    # Browser logic, in-browser editor, and download
    │   └── logo.png
    ├── routes/
    │   └── invoiceRoutes.js             # API route definitions
    ├── services/
    │   ├── handwrittenInvoiceService.js # Gemini AI handler with fallback trigger
    │   ├── localHandwrittenParser.js    # 100% offline handwritten parser
    │   ├── pdfService.js                # Digital and scanned PDF reader
    │   ├── ocrService.js                # Tesseract OCR engine
    │   ├── imageService.js              # Sharp image cleaner and enhancer
    │   ├── rowParser.js                 # 12-column computer report parser
    │   ├── documentClassificationService.js # Identifies computer vs handwritten files
    │   └── excelService.js              # Generates .xlsx workbooks
    ├── uploads/                         # Temporary folder for uploads (auto-cleaned)
    └── package.json
```

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome!
Feel free to open an issue or submit a pull request. For deep-dive technical explanations of every file's internal implementation, please check out [notes.md](notes.md).

---

## 📄 License

This project is open for internal and educational use.
