const path = require("path");
const fs = require("fs");

const { extractReport } = require("../services/reportExtractionService");
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
 * Processes uploaded report (image or PDF).
 * Auto-detects whether the document is handwritten or computer-generated,
 * and extracts the corresponding columns via Grok Vision API.
 */
async function processReport(req, res) {
    let filePath = null;

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No report file uploaded."
            });
        }

        filePath = req.file.path;
        const extension = path.extname(filePath).toLowerCase();

        if (![".jpg", ".jpeg", ".png", ".pdf"].includes(extension)) {
            await safeDeleteFile(filePath);
            return res.status(400).json({
                success: false,
                message: "Unsupported file type. Please upload a single PDF or single image (JPG, JPEG, PNG).",
                category: "file_type",
                tip: "Only single-page PDF or image files are allowed."
            });
        }

        // Strict Single-Page Check for PDFs
        if (extension === ".pdf") {
            const { getPdfPageCount } = require("../services/pdfService");
            const pageCount = await getPdfPageCount(filePath);
            if (pageCount > 1) {
                await safeDeleteFile(filePath);
                return res.status(400).json({
                    success: false,
                    message: `Multi-page PDF detected (${pageCount} pages). Only single-page documents are accepted.`,
                    category: "multi_page_not_allowed",
                    tip: "Please upload only a single-page PDF or extract/split the specific report page before uploading."
                });
            }
        }

        const mode = req.body?.mode || req.query?.mode || "auto";
        const { documentType, rows, timeSeconds } = await extractReport(filePath, { mode });

        return res.json({
            success: true,
            reportType: documentType,
            invoiceType: documentType,
            rows,
            timeSeconds
        });

    } catch (error) {
        console.error("Report processing error:", error);

        // Determine specific user-friendly error details
        let userMessage = error.message || "Failed to process report.";
        let errorCategory = "general";
        let tip = "";

        if (userMessage.includes("Daily Quota Reached") || userMessage.includes("tokens per day") || userMessage.includes("TPD")) {
            errorCategory = "daily_quota";
            tip = "The AI service free-tier daily quota has been reached. Please try again shortly or configure an alternative API key.";
        } else if (userMessage.includes("Invalid document format") || userMessage.includes("not recognized as a report")) {
            errorCategory = "invalid_format";
            tip = "The uploaded file does not look like a valid report. Please upload a clear photo/scan of a handwritten slip or computer report.";
        } else if (userMessage.includes("rate limit") || userMessage.includes("429")) {
            errorCategory = "rate_limit";
            tip = "The AI service is momentarily busy handling requests. Please wait a few seconds and click Process again.";
        } else if (userMessage.includes("No product rows could be extracted")) {
            errorCategory = "no_rows";
            tip = "Could not find readable items or stock rows. Ensure the photo/scan is clear, well-lit, right-side up, and contains a tabular report.";
        } else if (userMessage.includes("file too large") || userMessage.includes("File too large")) {
            errorCategory = "file_size";
            tip = "Please upload an image or PDF under 20MB.";
        } else if (userMessage.includes("No valid GROK_API_KEY")) {
            errorCategory = "missing_key";
            tip = "Please check your server .env configuration for a valid API key.";
        }

        return res.status(500).json({
            success: false,
            message: userMessage,
            category: errorCategory,
            tip: tip
        });
    } finally {
        await safeDeleteFile(filePath);
    }
}

/**
 * Generates and downloads Excel file (.xlsx) based on the detected report type.
 */
async function downloadExcel(req, res) {
    try {
        const { rows } = req.body;
        const reportType = req.body.reportType || req.body.invoiceType || "handwritten";

        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No report data available."
            });
        }

        let filePath;

        if (reportType === "handwritten") {
            filePath = await createHandwrittenExcelFile(rows);
        } else {
            filePath = await createExcelFile(rows);
        }

        const fileName = reportType === "handwritten" ? "handwritten_report.xlsx" : "computer_report.xlsx";

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
    processReport,
    downloadExcel
};
