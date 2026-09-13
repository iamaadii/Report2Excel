# Notes: How this project works now

This app is a document-to-Excel workflow for reports and invoice-like sheets. A user uploads a PDF or image, the backend extracts table data, and the result is shown in a browser preview before export to Excel.

The main flow is:

1. User chooses either a computer-generated report or a handwritten report.
2. The browser sends the file to the Express API.
3. The server stores the uploaded file temporarily.
4. The controller checks the file type and selected report mode.
5. The app classifies whether the file looks printed or handwritten.
6. A processing path runs:
   - printed/computer report: local PDF text extraction or OCR
   - handwritten report: Gemini AI extraction
7. Extracted rows are sent back to the UI.
8. The user can review and edit the data.
9. The final rows are converted to an Excel file for download.

---

## 1. Full workflow

### Step 1: Browser loads the upload UI

The page in `public/index.html` shows two upload cards:

- Computer-Generated Report
- Handwritten Report

The frontend supports drag-and-drop and file selection for PDF, JPG, JPEG, and PNG files.

### Step 2: File is sent to the server

The browser uses fetch calls to the backend routes in `routes/invoiceRoutes.js`.

The main processing endpoint is:

- `POST /api/invoices/process`

The download endpoint is:

- `POST /api/invoices/download`

### Step 3: Upload middleware handles the file

`middleware/uploadMiddleware.js` checks:

- file presence
- allowed file types
- file size limit
- temporary storage location

Files are saved in the `uploads` folder before processing.

### Step 4: Controller decides the processing route

`controllers/invoiceController.js` is the main decision point. It does the following:

- checks that a file was uploaded
- reads the file extension
- reads the selected `invoiceType`
- runs local document classification
- rejects file type mismatches when the file appears to belong to the other category
- calls the correct extraction service

### Step 5: Local classification happens before extraction

The app runs `classifyDocumentLocally()` from `services/documentClassificationService.js`.

This is important because it helps detect whether the uploaded document is:

- computer-generated
- handwritten

The classification is done locally using:

- PDF digital text inspection
- embedded page image OCR
- report keyword detection
- table structure heuristics

This avoids unnecessary Gemini calls for printed reports.

### Step 6: Printed report extraction

For computer-generated files, the app checks whether the PDF has a text layer. If it does, it extracts text directly. If not, it extracts page images and runs OCR on those images.

Key files involved:

- `services/pdfService.js` – PDF text extraction and page image processing
- `services/ocrService.js` – OCR on enhanced images
- `services/rowParser.js` – row and value extraction from OCR text
- `services/imageService.js` – image cleanup before OCR

### Step 7: Handwritten extraction

For handwritten reports, the app calls:

- `services/handwrittenInvoiceService.js`

This sends the document to the Gemini API and asks for a JSON array of extracted rows.

The prompt instructs the model to ignore noise, handle ditto marks, resolve quantity formulas, and return clean structured data.

### Step 8: Preview and editing in the browser

The backend returns the extracted rows as JSON.

The frontend in `public/script.js` builds the preview table and lets the user make corrections before export.

### Step 9: Download as Excel

When the user clicks Download Excel:

- the browser sends the edited rows to `/api/invoices/download`
- the backend creates an Excel file using `excelService.js`
- the browser downloads the generated `.xlsx`

---

## 2. Important files

### `server.js`

This is the main Express server.

It does the following:

- loads environment variables
- enables CORS
- serves the frontend from `public`
- serves uploaded files from `uploads`
- mounts the invoice API routes
- exposes `/api/health`
- starts the app on port 5000

### `routes/invoiceRoutes.js`

This file maps routes to controller functions:

- `POST /process`
- `POST /download`

### `controllers/invoiceController.js`

This file handles the core request lifecycle.

It is responsible for:

- validating uploads
- checking file extension
- determining report type
- calling local classification
- selecting the correct extraction path
- returning rows to the frontend
- exporting the final Excel workbook

### `services/documentClassificationService.js`

This file decides whether a document looks handwritten or computer-generated.

It uses local heuristics instead of relying on external classification endpoints.

### `services/pdfService.js`

This file handles digital PDF extraction and scanned PDF OCR.

It supports single-page and multi-page PDFs.

### `services/ocrService.js`

This file runs the OCR pipeline for printed reports and scanned pages.

### `services/rowParser.js`

This file converts OCR text into structured rows.

It cleans the extracted text and tries to map values into fields such as:

- item description
- pack size
- opening quantity/value
- receipt quantity/value
- issue quantity/value
- closing quantity/value
- dump quantity
- M. Exp

### `services/excelService.js`

This file creates the final workbook and converts the preview rows into Excel output.

### `services/handwrittenInvoiceService.js`

This file calls Gemini to read handwritten documents and return a clean structured JSON array.

---

## 3. Why the app was changed

The app has moved beyond a simple image-only OCR flow. It now includes:

- PDF extraction
- local classification
- mismatch detection
- multi-page support
- handwritten AI extraction
- browser-side review before Excel export

This means the project is closer to a real document processing workflow than a basic OCR demo.

---

## 4. Environment setup and required variables

The main environment variable used by the app is:

```env
GEMINI_API_KEY=your_api_key_here
```

This is required for handwritten document extraction via Gemini.

The app also expects Node dependencies to be installed with:

```bash
npm install
```

---

## 5. Example mental model

Think of the app as a small data-entry pipeline:

- upload a report
- identify its type
- read the table content
- clean the values
- show the result for review
- download Excel

That is the full purpose of the project.

This file handles handwritten reports.

It uses Gemini AI from Google.

It sends the image and a prompt like:

- ignore noise
- find product rows
- correct ditto marks
- evaluate quantities written as equations
- return a clean JSON array

### Simple meaning

This file lets the app read handwritten invoices with AI instead of OCR.

## services/excelService.js

This file creates the Excel file.

There are two formats:

- createExcelFile(rows) for computer-generated invoice type
- createHandwrittenExcelFile(rows) for handwritten invoice type

It uses ExcelJS library.

It creates worksheets and columns like:

- Item Description
- Pack Size
- Opening Qty
- Receipt Qty
- Issue Qty
- Closing Qty
- etc.

For handwritten reports it creates columns:

- SR.NO
- ITEM NAME
- PACK SIZE
- QUANTITY

### Simple meaning

This file turns rows of data into an actual Excel sheet.

---

# 4. Frontend side: public/script.js

This is the browser JavaScript file.

It controls the whole website experience.

## It does these things:

- keeps track of selected invoice type
- stores extracted rows in memory
- shows upload cards
- enables drag and drop
- allows selecting file and remove file
- sends file to backend API
- receives extracted rows
- creates preview table in browser
- allows user to edit cells
- downloads final Excel file

## Important functions

### setWorkflowStep(currentStep)

This updates progress steps on the page.
The workflow is:

- upload
- review
- export

### renderComputerTable(rows)

This creates the table layout for computer-generated reports.

### renderHandwrittenTable(rows)

This creates a different table layout for handwritten reports.

### downloadBtn.addEventListener("click", ...)

This is triggered when the user clicks Download Excel.
It sends the edited rows to the backend and downloads the file.

### Simple meaning

This file is the UI logic.
It connects the buttons, file upload, data preview, and Excel download.

---

# 5. How the request flow works in real life

### Example: user uploads a printed report

1. User selects an image.
2. Frontend appends the file to FormData.
3. Browser sends POST to /api/invoices/process.
4. uploadMiddleware saves the file.
5. controller checks the type.
6. imageService enhances the image.
7. ocrService reads text from the image.
8. rowParser extracts columns.
9. Backend sends JSON rows back.
10. Browser shows table.
11. User edits the table.
12. Browser sends rows to /api/invoices/download.
13. ExcelJS creates Excel file.
14. Browser downloads final .xlsx file.

### Example: user uploads a handwritten report

1. User selects handwritten image.
2. Frontend sends file to backend.
3. controller sees handwritten type.
4. handwrittenInvoiceService calls Gemini.
5. AI reads the invoice and returns structured row data.
6. Browser shows table.
7. User edits values if needed.
8. User downloads Excel.

---

# 6. Simple summary of the project

This project has 3 main parts:

## Frontend

In the public folder.
It allows the user to upload files and view the data.

## Backend

In server.js and routes/controllers.
It handles requests, file upload, and processing.

## Processing services

In services folder.
These files do the actual work:

- improve image
- read text with OCR
- parse rows
- use AI for handwriting
- create Excel files

---

# 7. Very simple final explanation

This project is basically:

A web tool that takes pictures or scanned reports, reads the data, cleans it, and saves it into Excel.

It works for:

- printed reports
- invoice-like documents
- handwritten reports

It is built using:

- Node.js
- Express
- Tesseract OCR
- Sharp
- ExcelJS
- Gemini AI

---

# 8. Beginner tip

When learning this project,
read files in this order:

1. server.js
2. routes/invoiceRoutes.js
3. controllers/invoiceController.js
4. middleware/uploadMiddleware.js
5. services/imageService.js
6. services/ocrService.js
7. services/rowParser.js
8. services/excelService.js
9. public/script.js

This order helps you understand the full app flow from start to finish.

---

# 9. One-line summary

The app receives a report image, extracts the data, shows it to the user, and exports it as an Excel file.
