const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

// Disable Sharp cache to prevent file locking on Windows
sharp.cache(false);


const {
    enhanceImage
} = require("../services/imageService");


const {
    performOCR
} = require("../services/ocrService");


const {
    parseInvoiceText
} = require("../services/rowParser");


const {
    extractHandwrittenInvoice
} = require("../services/handwrittenInvoiceService");


const {
    createExcelFile,
    createHandwrittenExcelFile
} = require("../services/excelService");

const {
    COMPUTER_INVOICE_KEYWORDS,
    classifyDocumentLocally
} = require("../services/documentClassificationService");

const {
    extractTextFromPdf,
    processComputerPdf
} = require("../services/pdfService");


async function safeDeleteFile(filePath, retries = 5, delayMs = 120) {
    if (!filePath) {
        return;
    }

    for (let i = 0; i < retries; i++) {
        try {
            await fs.promises.unlink(filePath);
            return;
        } catch (error) {
            if (error.code === "ENOENT") {
                return;
            }
            if (i < retries - 1) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            } else {
                console.warn("Failed to delete temp file:", filePath, error.message);
            }
        }
    }
}


/*
 * ==========================================
 * PROCESS INVOICE
 * ==========================================
 */
async function processInvoice(
    req,
    res
) {

    const tempFiles = [];

    try {

        if (!req.file) {

            return res.status(400).json({

                success: false,

                message:
                    "Please upload an invoice file."
            });
        }


        const filePath =
            req.file.path;

        tempFiles.push(filePath);


        const extension =
            path.extname(
                filePath
            ).toLowerCase();


        const invoiceType =
            req.body.invoiceType ||
            "computer";


        let extractedRows = [];


        /*
         * ======================================
         * IMAGE PROCESSING
         * ======================================
         */
        if (
            extension === ".jpg" ||
            extension === ".jpeg" ||
            extension === ".png" ||
            extension === ".pdf"
        ) {
            /*
             * ==================================
             * HANDWRITTEN (Images & PDFs)
             * ==================================
             */
            if (invoiceType === "handwritten") {
                // If it's a PDF, do a fast (sub-50ms) digital text check to catch if a user accidentally
                // uploaded a digital computer report in the handwritten section:
                if (extension === ".pdf") {
                    try {
                        const { text } = await extractTextFromPdf(filePath);
                        if (text && text.trim().length >= 40) {
                            const upperText = text.toUpperCase();
                            const matchedKeywords = COMPUTER_INVOICE_KEYWORDS.filter((kw) => upperText.includes(kw));
                            const parsedRows = parseInvoiceText(text);

                            if (parsedRows.length > 0 || matchedKeywords.length >= 2) {
                                await safeDeleteFile(filePath);
                                return res.status(400).json({
                                    success: false,
                                    mismatch: true,
                                    detectedType: "computer_generated",
                                    expectedType: "handwritten",
                                    message: "This file appears to be a computer-generated report. Please upload it in the 'Computer-Generated Report' section."
                                });
                            }
                        }
                    } catch (pdfErr) {
                        console.warn("Digital PDF check note for handwritten upload:", pdfErr.message);
                    }
                }

                // Send directly to Gemini AI (zero slow Tesseract OCR passes)
                console.log(
                    "Using handwritten invoice extraction via Gemini AI (direct fast path)..."
                );

                extractedRows =
                    await extractHandwrittenInvoice(
                        filePath
                    );

            } else {
                /*
                 * ==================================
                 * COMPUTER-GENERATED (Images & PDFs)
                 * ==================================
                 */
                if (extension === ".pdf") {
                    console.log(
                        "Using computer-generated PDF extraction (supports single & multi-page documents)..."
                    );

                    extractedRows =
                        await processComputerPdf(
                            filePath
                        );

                    // If computer PDF yielded zero rows and no text, check if it might be a handwritten document
                    if (!extractedRows || extractedRows.length === 0) {
                        await safeDeleteFile(filePath);
                        return res.status(400).json({
                            success: false,
                            mismatch: true,
                            detectedType: "handwritten",
                            expectedType: "computer",
                            message: "No computer-generated report table found. If this is a handwritten report, please upload it in the 'Handwritten Report' section."
                        });
                    }

                } else {
                    // 1. Enhance the image first for maximum contrast and readability
                    const enhancedPath =
                        await enhanceImage(
                            filePath
                        );

                    tempFiles.push(enhancedPath);

                    const metadata =
                        await sharp(
                            enhancedPath
                        ).metadata();

                    console.log(
                        "Enhanced image width:",
                        metadata.width
                    );

                    // 2. Single-pass OCR on the enhanced image (reuses warm worker & local traineddata)
                    console.log(
                        "Running single-pass Tesseract OCR on enhanced image..."
                    );

                    const {
                        text
                    } =
                        await performOCR(
                            enhancedPath
                        );

                    console.log(
                        "========== OCR TEXT =========="
                    );
                    console.log(text);
                    console.log(
                        "========== END OCR =========="
                    );

                    // 3. Parse rows from OCR text
                    extractedRows =
                        parseInvoiceText(
                            text
                        );

                    // 4. Verify if it really was a computer-generated report
                    const upperText = (text || "").toUpperCase();
                    const matchedKeywords = COMPUTER_INVOICE_KEYWORDS.filter((kw) => upperText.includes(kw));

                    if (extractedRows.length === 0 && matchedKeywords.length === 0) {
                        await Promise.all(
                            tempFiles.map((f) => safeDeleteFile(f))
                        );
                        return res.status(400).json({
                            success: false,
                            mismatch: true,
                            detectedType: "handwritten",
                            expectedType: "computer",
                            message: "This file appears to be a handwritten report. Please upload it in the 'Handwritten Report' section."
                        });
                    }
                }
            }

        } else {
            return res.status(400).json({
                success: false,
                message:
                    "Unsupported file type. Please upload a PDF, JPG, JPEG, or PNG file."
            });
        }


        /*
         * ======================================
         * RESPONSE
         * ======================================
         */
        return res.json({

            success: true,

            invoiceType,

            rows:
                extractedRows
        });


    } catch (error) {

        console.error(
            "Invoice processing error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message ||
                "Failed to process invoice."
        });
    } finally {
        await Promise.all(
            tempFiles.map((filePath) => safeDeleteFile(filePath))
        );
    }
}


/*
 * ==========================================
 * DOWNLOAD EXCEL
 * ==========================================
 */
async function downloadExcel(
    req,
    res
) {

    try {

        const {
            rows,
            invoiceType
        } = req.body;


        if (
            !Array.isArray(rows) ||
            rows.length === 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "No invoice data available."
            });
        }


        let filePath;


        /*
         * ======================================
         * COMPUTER EXCEL
         * ======================================
         */
        if (
            invoiceType ===
            "computer"
        ) {

            filePath =
                await createExcelFile(
                    rows
                );


            /*
             * ======================================
             * HANDWRITTEN EXCEL
             * ======================================
             */
        } else if (
            invoiceType ===
            "handwritten"
        ) {

            filePath =
                await createHandwrittenExcelFile(
                    rows
                );


        } else {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid invoice type."
            });
        }


        const fileName = "report.xlsx";


        res.download(
            filePath,
            fileName,
            error => {

                if (error) {

                    console.error(
                        "Excel download error:",
                        error
                    );
                }


                /*
                 * Remove temporary Excel
                 * file after the response.
                 */
                fs.unlink(
                    filePath,
                    unlinkError => {

                        if (
                            unlinkError
                        ) {

                            console.error(
                                "Failed to remove temporary Excel file:",
                                unlinkError
                            );
                        }
                    }
                );
            }
        );


    } catch (error) {

        console.error(
            "Excel Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to create Excel file."
        });
    }
}


module.exports = {
    processInvoice,
    downloadExcel
};
