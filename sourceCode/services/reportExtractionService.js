const fs = require("fs");
const path = require("path");
let sharp;
try {
    sharp = require("sharp");
} catch (err) {
    console.warn("Sharp native module note:", err.message);
}
const { extractImagesFromPdf, extractTextFromPdf } = require("./pdfService");

/**
 * Checks whether extracted PDF text has substantial, structured report content.
 * Native digital PDFs (from Tally, Marg, SAP, Busy) have dense text and numbers.
 */
function hasSufficientDigitalText(text) {
    if (!text || typeof text !== "string") return false;
    const cleaned = text.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "").trim();
    if (cleaned.length < 100) return false;
    const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const linesWithDigits = lines.filter((l) => /\d/.test(l));
    return lines.length >= 4 && linesWithDigits.length >= 3;
}

/**
 * Cleans and evaluates quantity values from handwritten notes,
 * resolving equations (e.g. "96 + 36 = 142" or "96+36" -> 142) and stripping unit labels.
 */
function cleanQuantity(val) {
    if (typeof val === "number") return Math.round(val);
    if (!val) return 1;

    let s = String(val).trim();

    if (s.includes("=")) {
        const parts = s.split("=");
        s = parts[parts.length - 1].trim();
    }

    if (/^\d+\s*[\+]\s*\d+/.test(s)) {
        try {
            const sum = s.split("+").reduce((acc, part) => acc + (parseInt(part.replace(/\D/g, ""), 10) || 0), 0);
            if (sum > 0) return sum;
        } catch (_) {}
    }

    const match = s.match(/-?\d+/);
    return match ? parseInt(match[0], 10) : 1;
}

/**
 * Normalizes number fields, removing extra spaces inside decimals (e.g. "20604 .55" -> "20604.55").
 */
function cleanField(val) {
    if (val === undefined || val === null) return "";
    let s = String(val).trim();
    if (s === "-" || s === "--" || s === "null" || s === "undefined") return "";
    s = s.replace(/(\d)\s*\.\s*(\d)/g, "$1.$2");
    return s;
}

/**
 * Robust multi-format parser: Parses pipe-delimited (|), TSV, or JSON output.
 * Immune to json_validate_failed or truncated bracket errors.
 */
function parseExtractedText(rawText) {
    let documentType = "handwritten";
    const lower = rawText.toLowerCase();

    if (lower.includes("invalid_document") || lower.includes("not an invoice") || lower.includes("not a report") || lower.includes("status: invalid")) {
        throw new Error("Invalid document format. The uploaded file is not recognized as a valid report.");
    }

    if (lower.includes("type: computer") || lower.includes("type: printed") || lower.includes("type: digital")) {
        documentType = "computer";
    } else if (lower.includes("type: handwritten") || lower.includes("type: hand")) {
        documentType = "handwritten";
    }

    const rows = [];
    const trimmed = rawText.trim();

    // 1. Try JSON parsing if the output is JSON
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            let jsonClean = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
            // Auto-repair if JSON was cut off near the end
            if (!jsonClean.endsWith("}") && !jsonClean.endsWith("]")) {
                const lastBracket = Math.max(jsonClean.lastIndexOf("}"), jsonClean.lastIndexOf("]"));
                if (lastBracket > 0) {
                    jsonClean = jsonClean.substring(0, lastBracket + 1);
                    if (jsonClean.startsWith("{") && !jsonClean.endsWith("}")) jsonClean += "}";
                }
            }

            const parsed = JSON.parse(jsonClean);
            if (parsed.documentType) {
                documentType = parsed.documentType.toLowerCase().includes("hand") ? "handwritten" : "computer";
            }

            let rawRows = Array.isArray(parsed) ? parsed : (parsed.rows || parsed.items || parsed.data || []);

            for (const r of rawRows) {
                if (Array.isArray(r)) {
                    if (r.length >= 8) {
                        documentType = "computer";
                        rows.push({
                            itemDescription: String(r[0] || "").trim(),
                            packSize: cleanField(r[1]) || "-",
                            openingQty: cleanField(r[2]),
                            openingValue: cleanField(r[3]),
                            receiptQty: cleanField(r[4]),
                            receiptValue: cleanField(r[5]),
                            issueQty: cleanField(r[6]),
                            issueValue: cleanField(r[7]),
                            closingQty: cleanField(r[8]),
                            closingValue: cleanField(r[9]),
                            dumpQty: cleanField(r[10]),
                            mExp: cleanField(r[11])
                        });
                    } else {
                        rows.push({
                            srNo: rows.length + 1,
                            itemName: String(r[1] || r[0] || "").trim(),
                            packSize: cleanField(r[2]) || "-",
                            quantity: cleanQuantity(r[3] || r[2])
                        });
                    }
                } else if (typeof r === "object" && r !== null) {
                    if (r.openingQty !== undefined || r.itemDescription !== undefined) {
                        documentType = "computer";
                        rows.push({
                            itemDescription: String(r.itemDescription || r.itemName || "").trim(),
                            packSize: cleanField(r.packSize) || "-",
                            openingQty: cleanField(r.openingQty),
                            openingValue: cleanField(r.openingValue),
                            receiptQty: cleanField(r.receiptQty),
                            receiptValue: cleanField(r.receiptValue),
                            issueQty: cleanField(r.issueQty),
                            issueValue: cleanField(r.issueValue),
                            closingQty: cleanField(r.closingQty),
                            closingValue: cleanField(r.closingValue),
                            dumpQty: cleanField(r.dumpQty),
                            mExp: cleanField(r.mExp)
                        });
                    } else {
                        rows.push({
                            srNo: rows.length + 1,
                            itemName: String(r.itemName || r.itemDescription || "").trim(),
                            packSize: cleanField(r.packSize) || "-",
                            quantity: cleanQuantity(r.quantity)
                        });
                    }
                }
            }

            if (rows.length > 0) {
                return { documentType, rows };
            }
        } catch (_) {}
    }

    // 2. Parse Line-by-Line (Pipe | or Tab \t delimited)
    const lines = rawText.split(/\r?\n/);

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith("```") || line.toUpperCase().startsWith("TYPE:")) continue;

        const upper = line.toUpperCase();
        if (
            upper.startsWith("ITEM DESCRIPTION") ||
            upper.startsWith("SR.NO") ||
            upper.startsWith("SR NO") ||
            upper === "TOTAL" ||
            upper.startsWith("TOTAL ") ||
            upper.startsWith("PAGE ") ||
            upper.includes("STOCK & SALES")
        ) {
            continue;
        }

        let parts = line.split("|").map((p) => p.trim());
        if (parts.length < 3) {
            parts = line.split("\t").map((p) => p.trim());
        }

        if (parts.length >= 2) {
            if (documentType === "computer" || parts.length >= 8) {
                documentType = "computer";
                const desc = parts[0] || "";
                if (!desc || desc.toUpperCase() === "TOTAL" || desc.toUpperCase().startsWith("TOTAL ")) continue;

                rows.push({
                    itemDescription: desc,
                    packSize: cleanField(parts[1]) || "-",
                    openingQty: cleanField(parts[2]),
                    openingValue: cleanField(parts[3]),
                    receiptQty: cleanField(parts[4]),
                    receiptValue: cleanField(parts[5]),
                    issueQty: cleanField(parts[6]),
                    issueValue: cleanField(parts[7]),
                    closingQty: cleanField(parts[8]),
                    closingValue: cleanField(parts[9]),
                    dumpQty: cleanField(parts[10]),
                    mExp: cleanField(parts[11])
                });
            } else {
                let name = parts[1];
                let pack = parts[2];
                let qty = parts[3];

                // If only 3 parts: name | pack | qty
                if (parts.length === 3) {
                    name = parts[0];
                    pack = parts[1];
                    qty = parts[2];
                }

                if (!name || name.toUpperCase() === "TOTAL" || name.toUpperCase().startsWith("TOTAL ")) continue;

                rows.push({
                    srNo: rows.length + 1,
                    itemName: name,
                    packSize: cleanField(pack) || "-",
                    quantity: cleanQuantity(qty)
                });
            }
        }
    }

    return { documentType, rows };
}

/**
 * Unified Report Extraction Service using Grok / Groq Vision API.
 * High-speed, token-efficient extraction that eliminates JSON validation failures.
 *
 * @param {string} inputPath - Path to uploaded image or PDF
 * @returns {Promise<{ documentType: "handwritten" | "computer", rows: Array<object> }>}
 */
async function extractReport(inputPath, options = {}) {
    console.log("Starting Unified Report Extraction via Grok/Groq API...", inputPath);

    // Support multiple fallback API keys (comma-separated GROQ_API_KEYS or single GROK_API_KEY)
    const rawKeys = [
        process.env.GROQ_API_KEYS,
        process.env.GROK_API_KEY,
        process.env.GROQ_API_KEY
    ].filter(Boolean).join(",");

    const apiKeys = rawKeys
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k && k !== "your_api_key_here" && !k.startsWith("your_"));

    if (apiKeys.length === 0) {
        throw new Error("No valid GROK_API_KEY found in server configuration (.env). Please set GROK_API_KEY.");
    }

    const mode = (options.mode || "auto").toLowerCase();
    const isHandwrittenMode = mode.includes("hand") || mode === "fast";
    const isComputerMode = mode.includes("comp");

    const ext = path.extname(inputPath).toLowerCase();
    const startTime = Date.now();

    // Helper to call OpenAI-compatible Vision/Text API with Key Rotation & Rate-Limit Retries
    const executeWithKeyRotation = async (makePayload) => {
        let lastError = null;

        for (let keyIdx = 0; keyIdx < apiKeys.length; keyIdx++) {
            const currentKey = apiKeys[keyIdx];
            const isXAI = currentKey.startsWith("xai-");
            const defaultBaseUrl = isXAI ? "https://api.x.ai/v1" : "https://api.groq.com/openai/v1";
            const baseUrl = (process.env.GROK_BASE_URL || process.env.GROQ_BASE_URL || defaultBaseUrl).replace(/\/+$/, "");
            const defaultModel = isXAI ? "grok-2-vision-1212" : "qwen/qwen3.8-27b";
            const modelName = process.env.GROK_MODEL || process.env.GROQ_MODEL || defaultModel;
            const providerLabel = isXAI ? "xAI Grok" : "Groq AI";

            const payload = makePayload(modelName, isXAI);

            let retries = 0;
            let success = false;
            let resultData = null;

            while (!success && retries < 3) {
                try {
                    const response = await fetch(`${baseUrl}/chat/completions`, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${currentKey}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(payload)
                    });

                    if (response.status === 429) {
                        const errBody = await response.text();
                        const isDailyLimit = errBody.includes("tokens per day") || errBody.includes("(TPD)") || errBody.includes("quota");

                        if (isDailyLimit) {
                            console.warn(`[Key ${keyIdx + 1}/${apiKeys.length}] Daily quota reached for current key.`);
                            lastError = new Error("Daily AI Quota Reached. All configured free-tier tokens have been exhausted.");
                            // Break out of retry loop to attempt the next API key in the list immediately!
                            break;
                        }

                        // Short-term rate limit (TPM/RPM)
                        retries++;
                        let waitSeconds = 4;
                        const timeMatch = errBody.match(/try again in (?:(\d+)m)?([\d\.]+)s/i);
                        if (timeMatch) {
                            const mins = timeMatch[1] ? parseInt(timeMatch[1], 10) : 0;
                            const secs = timeMatch[2] ? Math.ceil(parseFloat(timeMatch[2])) : 0;
                            waitSeconds = Math.min(mins * 60 + secs + 1, 15);
                        }

                        console.warn(`${providerLabel} short-term 429. Waiting ${waitSeconds}s before retry (attempt ${retries}/3)...`);
                        await new Promise((r) => setTimeout(r, waitSeconds * 1000));
                        continue;
                    }

                    if (!response.ok) {
                        const errText = await response.text();
                        throw new Error(`${providerLabel} Error HTTP ${response.status}: ${errText}`);
                    }

                    resultData = await response.json();
                    return resultData;
                } catch (err) {
                    lastError = err;
                    if (retries >= 2 || err.message.includes("Daily AI Quota")) break;
                    retries++;
                    await new Promise((r) => setTimeout(r, 1500));
                }
            }
        }

        throw lastError || new Error("Failed to process document with configured AI services.");
    };

    // 1. Digital PDF Fast-Track:
    // If the PDF contains a clean native text layer (from Tally, Marg, SAP, ERP),
    // extract directly via high-speed text API.
    if (ext === ".pdf") {
        let digitalText = "";
        try {
            digitalText = await extractTextFromPdf(inputPath);
        } catch (err) {
            console.warn("Digital PDF text probe note:", err.message);
        }

        if (hasSufficientDigitalText(digitalText)) {
            console.log(`[Fast-Track] Native digital PDF detected (${digitalText.length} chars). Extracting directly via text API...`);

            let textPrompt;
            if (isHandwrittenMode) {
                textPrompt = `You are a high-speed report data extractor. Extract rows from this report text:
Line 1: TYPE: handwritten
Each row: srNo|itemName|packSize|quantity
Clean quantities. Plain lines only, pipe separated.`;
            } else if (isComputerMode) {
                textPrompt = `You are a report data extractor. Extract all product rows from this computer stock & sales report text:
Line 1: TYPE: computer
Each row: itemDescription|packSize|openingQty|openingValue|receiptQty|receiptValue|issueQty|issueValue|closingQty|closingValue|dumpQty|mExp
Write - for zero or empty fields. Exactly 11 pipe characters per line. Plain text only.`;
            } else {
                textPrompt = `You are a report extractor. Determine document type on line 1:
TYPE: handwritten  OR  TYPE: computer

If handwritten, output rows as:
srNo|itemName|packSize|quantity

If computer, output rows as (12 columns):
itemDescription|packSize|openingQty|openingValue|receiptQty|receiptValue|issueQty|issueValue|closingQty|closingValue|dumpQty|mExp

Plain lines only. No markdown.`;
            }

            try {
                const textData = await executeWithKeyRotation((modelName, isXAI) => ({
                    model: modelName,
                    messages: [
                        {
                            role: "user",
                            content: `${textPrompt}\n\nDocument text:\n${digitalText.substring(0, 16000)}`
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: isHandwrittenMode ? 600 : (isXAI ? 4096 : 920),
                    reasoning_effort: isXAI ? undefined : "none"
                }));

                const textContent = textData?.choices?.[0]?.message?.content || "";
                const { documentType, rows } = parseExtractedText(textContent);

                if (rows.length > 0) {
                    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
                    const finalType = isHandwrittenMode ? "handwritten" : (isComputerMode ? "computer" : documentType);
                    console.log(`[Fast-Track] Extraction Successful: Detected "${finalType}", extracted ${rows.length} row(s) in ${durationSeconds}s.`);
                    return {
                        documentType: finalType,
                        rows,
                        timeSeconds: parseFloat(durationSeconds)
                    };
                }
            } catch (textErr) {
                console.warn("[Fast-Track] Direct text API call note, falling back to vision:", textErr.message);
            }
            console.log("[Fast-Track] Direct text yielded no rows. Falling back to vision rendering...");
        }
    }

    // 2. Vision Processing for Images and Scanned PDFs
    let imageBuffers = [];
    if (ext === ".pdf") {
        const extracted = await extractImagesFromPdf(inputPath);
        if (extracted && extracted.length > 0) {
            imageBuffers = extracted;
        } else {
            throw new Error("Unable to read or extract page images from this PDF. Please check if the file is encrypted or corrupted.");
        }
    } else {
        imageBuffers = [fs.readFileSync(inputPath)];
    }

    // Protect against overwhelming rate limits with very large PDFs
    if (imageBuffers.length > 8) {
        console.warn(`Document has ${imageBuffers.length} pages. Limiting to first 8 pages to avoid rate limit rejection.`);
        imageBuffers = imageBuffers.slice(0, 8);
    }

    // Lean, high-speed prompts tailored to user request with strict document validation
    let prompt;
    if (isHandwrittenMode) {
        prompt = `You are a report data extractor. First verify: is this a handwritten report, slip, or order sheet with product items?
If NO (e.g., photo of a person, landscape, random letter, receipt without line items, or unrelated document), reply ONLY:
STATUS: INVALID_DOCUMENT

If YES, output format:
Line 1: TYPE: handwritten
Each row: srNo|itemName|packSize|quantity

Rules:
- Extract all product lines from top to bottom.
- 4 columns separated by pipe (|): srNo|itemName|packSize|quantity
- Clean quantity (e.g., resolve equations "96+36=142" -> 142, strip words like Pcs or Box).
- Plain lines only. No markdown, no commentary.`;
    } else if (isComputerMode) {
        prompt = `You are a report data extractor. First verify: is this a computer-generated stock & sales report or structured tabular report?
If NO (e.g., random photo, unrelated document, landscape, or personal photo), reply ONLY:
STATUS: INVALID_DOCUMENT

If YES, output rows:
Line 1: TYPE: computer
Each row: itemDescription|packSize|openingQty|openingValue|receiptQty|receiptValue|issueQty|issueValue|closingQty|closingValue|dumpQty|mExp
Write - for zero or empty fields. Exactly 11 pipe characters per line. Plain text only.`;
    } else {
        prompt = `You are a report extractor. First verify: is this a handwritten report slip or computer stock/sales report?
If NO (e.g., photo of an object, person, ID card, random text, or unrelated document), reply ONLY:
STATUS: INVALID_DOCUMENT

If YES, determine document type on line 1:
TYPE: handwritten  OR  TYPE: computer

If handwritten, output rows as:
srNo|itemName|packSize|quantity

If computer, output rows as (12 columns):
itemDescription|packSize|openingQty|openingValue|receiptQty|receiptValue|issueQty|issueValue|closingQty|closingValue|dumpQty|mExp

Plain lines only. No markdown.`;
    }

    let detectedDocumentType = isHandwrittenMode ? "handwritten" : (isComputerMode ? "computer" : "handwritten");
    const allExtractedRows = [];

    // Helper to process a single page image with vision
    const processPageImage = async (imgBuffer) => {
        let base64Data;
        if (sharp) {
            try {
                const optimizedBuffer = await sharp(imgBuffer)
                    .resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true })
                    .jpeg({ quality: 76, mozjpeg: false })
                    .toBuffer();
                base64Data = optimizedBuffer.toString("base64");
            } catch (sharpErr) {
                console.warn("Sharp optimization note:", sharpErr.message);
                base64Data = imgBuffer.toString("base64");
            }
        } else {
            base64Data = imgBuffer.toString("base64");
        }

        const data = await executeWithKeyRotation((modelName, isXAI) => {
            const payload = {
                model: modelName,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Data}`
                                }
                            }
                        ]
                    }
                ],
                temperature: 0.1,
                max_tokens: isHandwrittenMode ? 600 : (isXAI ? 4096 : 920)
            };

            if (process.env.GROK_MAX_TOKENS) {
                payload.max_tokens = parseInt(process.env.GROK_MAX_TOKENS, 10);
            }

            if (!isXAI) {
                payload.reasoning_effort = "none";
            }

            return payload;
        });

        const messageContent = data.choices?.[0]?.message?.content || "";
        return parseExtractedText(messageContent);
    };

    // Process pages in serial/small batches to respect token limits
    for (let i = 0; i < imageBuffers.length; i++) {
        const res = await processPageImage(imageBuffers[i]);
        if (res.documentType) {
            detectedDocumentType = isHandwrittenMode ? "handwritten" : (isComputerMode ? "computer" : res.documentType);
        }
        allExtractedRows.push(...res.rows);
    }

    if (allExtractedRows.length === 0) {
        throw new Error("No product rows could be extracted from this document.");
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Extraction Successful: Detected "${detectedDocumentType}", extracted ${allExtractedRows.length} row(s) in ${durationSeconds}s.`);

    return {
        documentType: detectedDocumentType,
        rows: allExtractedRows,
        timeSeconds: parseFloat(durationSeconds)
    };
}

module.exports = {
    extractReport
};
