const path = require("path");
const fs = require("fs");

const { extractInvoice } = require("../services/unifiedInvoiceService");
const {
    createExcelFile,
    createHandwrittenExcelFile
} = require("../services/excelService");

/**
 * Safely deletes a file with retries for Windows filesystem locks.
 */
async function safeDeleteFile(filePath, retries = 5, delayMs = 120) {
    if (!filePath) return;
    for (let i = 0; i < retries; i++) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return;
        } catch (err) {
            if (i === retries - 1) {
                console.warn(`Could not delete file ${filePath}: ${err.message}`);
            } else {
                await new Promise((r) => setTimeout(r, delayMs));
            }
        }
    }
}

/**
 * Processes uploaded invoice (image or PDF).
 * Auto-detects whether the document is handwritten or computer-generated,
 * and extracts the corresponding columns via Grok Vision API.
 */
async function processInvoice(req, res) {
    let filePath = null;

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No invoice file uploaded."
            });
        }

        filePath = req.file.path;
        const extension = path.extname(filePath).toLowerCase();

        if (![".jpg", ".jpeg", ".png", ".pdf"].includes(extension)) {
            await safeDeleteFile(filePath);
            return res.status(400).json({
                success: false,
                message: "Unsupported file type. Please upload a PDF, JPG, JPEG, or PNG file."
            });
        }

        const mode = req.body?.mode || req.query?.mode || "auto";
        const { documentType, rows, timeSeconds } = await extractInvoice(filePath, { mode });

        return res.json({
            success: true,
            invoiceType: documentType,
            rows,
            timeSeconds
        });

    } catch (error) {
        console.error("Invoice processing error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to process invoice."
        });
    } finally {
        await safeDeleteFile(filePath);
    }
}

/**
 * Generates and downloads Excel file (.xlsx) based on the detected invoice type.
 */
async function downloadExcel(req, res) {
    try {
        const { rows, invoiceType } = req.body;

        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No invoice data available."
            });
        }

        let filePath;

        if (invoiceType === "handwritten") {
            filePath = await createHandwrittenExcelFile(rows);
        } else {
            filePath = await createExcelFile(rows);
        }

        const fileName = invoiceType === "handwritten" ? "handwritten_report.xlsx" : "computer_report.xlsx";

        res.download(filePath, fileName, (error) => {
            if (error) {
                console.error("Excel download error:", error);
            }
            fs.unlink(filePath, (unlinkError) => {
                if (unlinkError) {
                    console.error("Failed to remove temporary Excel file:", unlinkError);
                }
            });
        });

    } catch (error) {
        console.error("Excel Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create Excel file."
        });
    }
}

module.exports = {
    processInvoice,
    downloadExcel
};
