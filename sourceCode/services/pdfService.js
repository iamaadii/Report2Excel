const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const sharp = require("sharp");
const { PDFDocument, PDFName, PDFRawStream } = require("pdf-lib");
const { performOCR } = require("./ocrService");
const { parseInvoiceText } = require("./rowParser");
const { enhanceImage } = require("./imageService");

/**
 * Extracts raw digital text across all pages of a PDF document using pdfjs-dist.
 * Reconstructs lines with proper newlines based on text item vertical coordinates and hasEOL markers.
 * 
 * @param {string} filePath - Absolute or relative path to PDF file
 * @returns {Promise<{ text: string, pages: Array<{ num: number, text: string }> }>}
 */
async function extractTextFromPdf(filePath) {
    try {
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const data = new Uint8Array(fs.readFileSync(filePath));
        const doc = await pdfjsLib.getDocument({ data, disableFontFace: true, verbosity: 0 }).promise;

        let fullText = "";
        const pages = [];

        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();

            let pageText = "";
            let lastY = null;

            for (const item of textContent.items) {
                const y = item.transform ? item.transform[5] : null;

                // When vertical position shifts by more than 3 units, start a new line
                if (lastY !== null && y !== null && Math.abs(y - lastY) > 3) {
                    pageText += "\n";
                }

                pageText += item.str;

                if (item.hasEOL) {
                    pageText += "\n";
                } else if (item.str && !item.str.endsWith(" ")) {
                    pageText += " ";
                }

                lastY = y;
            }

            pages.push({ num: i, text: pageText });
            fullText += pageText + "\n";
        }

        return {
            text: fullText,
            pages
        };
    } catch (error) {
        console.warn("Failed to extract digital text from PDF:", error.message);
        return {
            text: "",
            pages: []
        };
    }
}

/**
 * Extracts embedded page images from a PDF file using pdf-lib and sharp.
 * Completely avoids node-canvas issues and works offline.
 * 
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<Array<Buffer>>} Array of PNG image buffers
 */
async function extractImagesFromPdf(filePath) {
    const data = fs.readFileSync(filePath);
    const doc = await PDFDocument.load(data, { ignoreEncryption: true });
    const imageBuffers = [];

    const context = doc.context;
    for (const [ref, obj] of context.enumerateIndirectObjects()) {
        if (obj instanceof PDFRawStream) {
            const dict = obj.dict;
            const subtype = dict.get(PDFName.of("Subtype"));
            if (subtype === PDFName.of("Image")) {
                const width = dict.get(PDFName.of("Width"))?.asNumber();
                const height = dict.get(PDFName.of("Height"))?.asNumber();
                const filter = dict.get(PDFName.of("Filter"));
                const colorSpace = dict.get(PDFName.of("ColorSpace"));

                if (!width || !height) continue;

                let imgBuf = Buffer.from(obj.contents);
                try {
                    if (filter === PDFName.of("FlateDecode")) {
                        imgBuf = zlib.inflateSync(imgBuf);
                        const isRgb = colorSpace === PDFName.of("DeviceRGB") || (imgBuf.length === width * height * 3);
                        const isCmyk = colorSpace === PDFName.of("DeviceCMYK") || (imgBuf.length === width * height * 4);
                        const channels = isRgb ? 3 : (isCmyk ? 4 : 1);
                        const pngBuf = await sharp(imgBuf, { raw: { width, height, channels } }).png().toBuffer();
                        imageBuffers.push(pngBuf);
                    } else if (filter === PDFName.of("DCTDecode")) {
                        const pngBuf = await sharp(imgBuf).png().toBuffer();
                        imageBuffers.push(pngBuf);
                    } else {
                        const pngBuf = await sharp(imgBuf).png().toBuffer();
                        imageBuffers.push(pngBuf);
                    }
                } catch (err) {
                    console.warn("Failed to decode an image stream:", err.message);
                }
            }
        }
    }
    return imageBuffers;
}

/**
 * Processes a computer-generated PDF (supporting both single and multi-page documents).
 * 
 * Strategy (100% LOCAL & OFFLINE — ZERO GEMINI API CALLS):
 * 1. Digital PDF extraction: Extracts digital text layer with pdfjs-dist.
 *    If structured tabular rows are detected, parse with parseInvoiceText and return them.
 * 2. Scanned PDF extraction: If digital text has no rows, extracts embedded page images via pdf-lib,
 *    enhances each page image with sharp, runs local Tesseract OCR, and parses rows with parseInvoiceText.
 * 
 * @param {string} filePath - Path to the uploaded computer PDF
 * @returns {Promise<Array<object>>} Extracted rows
 */
async function processComputerPdf(filePath) {
    console.log("Processing computer-generated PDF locally (100% Offline, Zero API calls)...", filePath);

    // 1. Digital PDF extraction (fast path)
    try {
        const { text } = await extractTextFromPdf(filePath);
        if (text && text.trim().length > 0) {
            const digitalRows = parseInvoiceText(text);
            if (digitalRows.length > 0) {
                console.log(`Successfully extracted ${digitalRows.length} rows directly from digital PDF text layer.`);
                return digitalRows;
            }
        }
    } catch (digitalErr) {
        console.warn("Digital PDF parsing note:", digitalErr.message);
    }

    // 2. Scanned PDF: Extract embedded page images and run local Tesseract OCR
    console.log("No digital table rows found in PDF text layer; extracting page images for local OCR...");
    const pageImages = await extractImagesFromPdf(filePath);

    if (!pageImages || pageImages.length === 0) {
        console.warn("No embedded images found in PDF to OCR.");
        return [];
    }

    console.log(`Scanned PDF contains ${pageImages.length} page image(s) to process via local Tesseract OCR.`);
    const allRows = [];
    const tempImages = [];

    try {
        for (let i = 0; i < pageImages.length; i++) {
            const pageNumber = i + 1;
            const tempRawPath = filePath.replace(/\.pdf$/i, `-raw-page-${pageNumber}-${Date.now()}.png`);
            tempImages.push(tempRawPath);
            fs.writeFileSync(tempRawPath, pageImages[i]);

            // Enhance image for crisp OCR recognition
            const enhancedPath = await enhanceImage(tempRawPath);
            tempImages.push(enhancedPath);

            console.log(`Running local Tesseract OCR on page ${pageNumber}...`);
            const { text: pageText } = await performOCR(enhancedPath);
            const pageRows = parseInvoiceText(pageText);

            console.log(`Page ${pageNumber}: Extracted ${pageRows.length} row(s) via local OCR.`);
            allRows.push(...pageRows);
        }
        return allRows;
    } finally {
        for (const tempPath of tempImages) {
            try {
                if (fs.existsSync(tempPath)) {
                    fs.unlinkSync(tempPath);
                }
            } catch (_) { }
        }
    }
}

module.exports = {
    extractTextFromPdf,
    extractImagesFromPdf,
    processComputerPdf
};