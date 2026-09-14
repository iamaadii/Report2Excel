const fs = require("fs");
const path = require("path");
const { extractTextFromPdf, extractImagesFromPdf } = require("./pdfService");
const { performOCR } = require("./ocrService");
const { parseInvoiceText } = require("./rowParser");

/**
 * Common printed computer report / invoice headers and keywords.
 */
const COMPUTER_INVOICE_KEYWORDS = [
    "ITEM DESCRIPTION",
    "PACK SIZE",
    "OPENING QTY",
    "OPENING VALUE",
    "RECEIPT QTY",
    "RECEIPT VALUE",
    "ISSUE QTY",
    "ISSUE VALUE",
    "CLOSING QTY",
    "CLOSING VALUE",
    "DUMP QTY",
    "M.EXP",
    "M. EXP",
    "VASU WELLNESS",
    "VASU HEALTHCARE",
    "STOCK & SALES",
    "STOCK AND SALES",
    "STOCK STATEMENT",
    "TAX INVOICE",
    "BILL OF SUPPLY",
    "PARTICULARS",
    "DESCRIPTION OF GOODS",
    "HSN/SAC",
    "BATCH NO",
    "NET AMOUNT"
];

/**
 * Classifies an uploaded document (image or single/multi-page PDF) as either "handwritten" or "computer_generated"
 * 100% LOCALLY and OFFLINE using PDF text layer inspection, embedded image OCR, and table layout heuristics.
 *
 * ZERO EXTERNAL API (Gemini) calls are used for classification.
 *
 * @param {string} filePath - Path to the image or PDF file
 * @returns {Promise<{ documentType: "handwritten" | "computer_generated", confidence: number, reasoning: string }>}
 */
async function classifyDocumentLocally(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    console.log(`Classifying ${ext.toUpperCase()} document locally (Zero API calls)...`, filePath);

    try {
        /* ===================================================
         * 1. PDF DOCUMENT LOCAL CLASSIFICATION
         * =================================================== */
        if (ext === ".pdf") {
            // A. Check digital text layer
            const { text } = await extractTextFromPdf(filePath);
            if (text && text.trim().length >= 40) {
                const upperText = text.toUpperCase();
                const matchedKeywords = COMPUTER_INVOICE_KEYWORDS.filter(kw => upperText.includes(kw));
                const parsedRows = parseInvoiceText(text);

                if (parsedRows.length > 0 || matchedKeywords.length >= 1) {
                    console.log(`Local PDF classification: Digital text matched ${matchedKeywords.length} keywords, ${parsedRows.length} structured rows.`);
                    return {
                        documentType: "computer_generated",
                        confidence: 0.98,
                        reasoning: `Digital PDF contains computer-generated typography (${matchedKeywords.length} report headers, ${parsedRows.length} parsed rows).`
                    };
                }
            }

            // B. Scanned PDF: Extract embedded page image and inspect with local OCR
            try {
                const images = await extractImagesFromPdf(filePath);
                if (images && images.length > 0) {
                    const tempPagePath = filePath.replace(/\.pdf$/i, `-cls-temp-${Date.now()}.png`);
                    try {
                        fs.writeFileSync(tempPagePath, images[0]);
                        const { text: ocrText } = await performOCR(tempPagePath);

                        if (ocrText && ocrText.trim().length > 0) {
                            const upperOcr = ocrText.toUpperCase();
                            const matchedKeywords = COMPUTER_INVOICE_KEYWORDS.filter(kw => upperOcr.includes(kw));
                            const parsedRows = parseInvoiceText(ocrText);

                            if (parsedRows.length > 0 || matchedKeywords.length >= 1) {
                                console.log(`Local PDF classification (OCR): Scanned page matched ${matchedKeywords.length} headers, ${parsedRows.length} structured rows.`);
                                return {
                                    documentType: "computer_generated",
                                    confidence: 0.95,
                                    reasoning: `Scanned PDF image contains printed computer-generated headers (${matchedKeywords.length} matched).`
                                };
                            }
                        }
                    } finally {
                        if (fs.existsSync(tempPagePath)) {
                            try { fs.unlinkSync(tempPagePath); } catch (_) {}
                        }
                    }
                }
            } catch (scanErr) {
                console.warn("Could not inspect scanned PDF images locally:", scanErr.message);
            }

            return {
                documentType: "handwritten",
                confidence: 0.85,
                reasoning: "PDF document contains no computer-generated report headers or printed table structures."
            };
        }

        /* ===================================================
         * 2. IMAGE DOCUMENT LOCAL CLASSIFICATION (.jpg, .jpeg, .png)
         * =================================================== */
        const { text: ocrText } = await performOCR(filePath);
        if (!ocrText || ocrText.trim().length === 0) {
            return {
                documentType: "handwritten",
                confidence: 0.7,
                reasoning: "No printed computer text detected by OCR; classified as handwritten."
            };
        }

        const upperOcr = ocrText.toUpperCase();
        const matchedKeywords = COMPUTER_INVOICE_KEYWORDS.filter(kw => upperOcr.includes(kw));
        const parsedRows = parseInvoiceText(ocrText);

        if (parsedRows.length > 0 || matchedKeywords.length >= 1) {
            return {
                documentType: "computer_generated",
                confidence: parsedRows.length > 0 ? 0.98 : 0.9,
                reasoning: `Image contains printed computer report headers (${matchedKeywords.length} matched, ${parsedRows.length} structured rows).`
            };
        }

        return {
            documentType: "handwritten",
            confidence: 0.85,
            reasoning: "No printed computer report headers or structured printed rows detected."
        };

    } catch (error) {
        console.error("Local document classification error:", error);
        return null;
    }
}

module.exports = {
    COMPUTER_INVOICE_KEYWORDS,
    classifyDocumentLocally,
    classifyDocumentType: classifyDocumentLocally
};
