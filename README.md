# Report2excel

This project, report2excel, converts uploaded report or invoice images/PDFs into editable table data and then exports the cleaned result as an Excel workbook.

It supports both:

- Computer-generated reports
- Handwritten reports

The app includes local document classification, OCR-based extraction for printed reports, PDF processing, multi-page handling, and Excel export.

## Features

- Upload PDF, JPG, JPEG, or PNG files
- Automatically classify documents as computer-generated or handwritten
- Process computer-generated PDFs locally using the PDF text layer and OCR fallback
- Process scanned or embedded PDF pages with local OCR
- Extract handwritten report data through Gemini AI
- Preview rows in the browser before export
- Let users edit extracted table values before downloading Excel
- Generate .xlsx files from processed rows
- Serve a lightweight browser UI from the frontend folder

## Project structure

- `sourceCode/` – application code
  - `server.js` – Express server entry point
  - `controllers/invoiceController.js` – file upload processing and Excel download flow
  - `routes/invoiceRoutes.js` – API routes
  - `middleware/uploadMiddleware.js` – uploads and validation
  - `services/` – OCR, parsing, classification, PDF handling, AI extraction, and Excel generation
  - `public/` – frontend HTML, CSS, and JavaScript
  - `uploads/` – temporary uploaded files

## Tech stack

- Node.js + Express
- Tesseract.js for OCR
- Sharp for image enhancement
- pdfjs-dist + pdf-lib for PDF parsing and page image extraction
- ExcelJS for Excel generation
- Google Gemini GenAI for handwritten extraction

## Prerequisites

- Node.js 18 or newer
- npm
- Access to a Gemini API key for handwritten extraction

## Installation

1. Open the terminal in the project root.
2. Go to the application folder:

```bash
cd sourceCode
```

3. Install dependencies:

```bash
npm install
```

4. Create a `.env` file in the `sourceCode` directory with your API key:

```env
GEMINI_API_KEY=your_api_key_here
```

## Run the app

From the `sourceCode` folder:

```bash
npm start
```

Development mode:

```bash
npm run dev
```

The app runs at:

```text
http://localhost:5000
```

## API endpoints

### Health check

```http
GET /api/health
```

Returns a basic server status response.

### Upload and process file

```http
POST /api/invoices/process
```

Expected upload:

- Form field: `invoice`
- Optional form field: `invoiceType` (`computer` or `handwritten`)

This route accepts PDF or image files and returns extracted rows in JSON, for example:

```json
{
  "success": true,
  "invoiceType": "computer",
  "rows": [
    {
      "itemDescription": "Vasu Trichip HFC Oil",
      "packSize": "200ML",
      "openingQty": "303",
      "openingValue": "55880.26"
    }
  ]
}
```

### Download Excel

```http
POST /api/invoices/download
```

Request body example:

```json
{
  "invoiceType": "computer",
  "rows": [
    {
      "itemDescription": "Vasu Trichip HFC Oil",
      "packSize": "200ML",
      "openingQty": "303",
      "openingValue": "55880.26"
    }
  ]
}
```

This creates and downloads a `.xlsx` file.

## Current behavior

### Computer-generated reports

- Supported formats: PDF, JPG, JPEG, PNG
- Uses local document classification before processing
- If the PDF has a digital text layer, the app extracts text first
- If not, it extracts embedded page images and runs OCR locally
- Parsed rows are sent to the preview and Excel export flow

### Handwritten reports

- Supported formats: PDF, JPG, JPEG, PNG
- The app sends the document to Gemini for structured extraction
- The response is converted into rows for preview and export

### Type mismatch protection

The app checks the uploaded document against the selected report type and rejects mismatches such as:

- choosing “Computer-Generated Report” for a handwritten file
- choosing “Handwritten Report” for a printed report

## Notes

- The frontend is served from `sourceCode/public`.
- Uploaded files are temporarily stored in `sourceCode/uploads` and cleaned up after processing.
- The app requires the `GEMINI_API_KEY` environment variable for handwritten extraction.
- Local classification is designed to reduce false routing without using external API calls for document detection.

## License

This project is intended for internal or personal use unless otherwise specified by the project owner.
