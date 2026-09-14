const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");
const { parseHandwrittenLocally } = require("./localHandwrittenParser");

async function extractHandwrittenInvoice(inputPath) {
    console.log("Starting Handwritten Invoice Extraction...", inputPath);

    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    const hasValidKey = apiKey && apiKey !== "your_api_key_here" && !apiKey.startsWith("your_");

    // If no valid API key is configured, immediately run local extraction
    if (!hasValidKey) {
        console.log("No valid GEMINI_API_KEY found. Performing local extraction on handwritten file...");
        const localRows = await parseHandwrittenLocally(inputPath);
        if (localRows && localRows.length > 0) {
            return localRows;
        }
        return [
            {
                srNo: 1,
                itemName: "Please check / enter item name",
                packSize: "-",
                quantity: 1
            }
        ];
    }

    try {
        const ext = path.extname(inputPath).toLowerCase();
        let mimeType = "image/jpeg";
        if (ext === ".png") {
            mimeType = "image/png";
        } else if (ext === ".pdf") {
            mimeType = "application/pdf";
        }

        const documentPart = {
            inlineData: {
                data: Buffer.from(fs.readFileSync(inputPath)).toString("base64"),
                mimeType
            }
        };

        const prompt = `
            You are a highly accurate data entry specialist extracting tabular data from handwritten invoice / stock report sheets.
            The table has 4 fixed columns: Sr. No, Item Name, Pack Size, and Quantity.
            
            CRITICAL EXTRACTION RULES:
            1. **Any Item Name:** The item name can be ANY product (FMCG, Ayurvedic, pharmaceutical, cosmetic, or general goods, e.g. HLS Oil, HFC Shampoo, KKT Cream, Swarn Prashan, Zeal, Face Wash, Henna, or any other product). Capture whatever product name is written.
            2. **Horizontal Dash Connectors:** Dealers often draw horizontal dashes, line rules, or dots (e.g. "HLS Oil ----- 100ml ----- 288 Pcs") between columns to guide the eye across paper. Strictly treat these as column dividers. NEVER include these dashes in item names, pack sizes, or quantities, and never treat them as negative numbers.
            3. **Complete Scan (All Rows):** Extract ALL valid product rows from the top of the table to the bottom. There may be 5, 25, 50, or 100+ rows. Scan the entire page thoroughly without stopping or truncating.
            4. **Ignore Noise:** Skip dealer letterheads (e.g. "MAA VAISHNO ENTERPRISES", "AKANSHA", "AGRAWAL TRADING"), phone numbers, GST numbers, dates, addresses, and bottom signatures/stamps.
            5. **Ditto Marks:** If an item name is written as "u", "”", '"', or "-", it means the item is the exact same as the row directly above it. Output the actual item name from the row above.
            6. **Math Equations:** If a quantity is written as an equation (e.g. "96 Ps + 36 = 142" or "96+36=142"), evaluate it and output ONLY the final integer (142).
            7. **Clean Quantity:** Strip out words like "Pcs", "Ps", "Box", "Pug", "Doz", or Hindi units (like "पैकेट"). Quantity must be a pure numeric Integer.
            8. **Sequential S.No:** Ignore messy handwritten numbers. Generate clean, continuous sequential "srNo" (1, 2, 3...) for each row.
        `;

        console.log("Analyzing handwritten invoice via Google Gemini API...");
        const ai = new GoogleGenAI({ apiKey });
        
        const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";
        console.log(`Using Gemini model: ${modelName}`);
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [prompt, documentPart],
            config: {
                temperature: 0.0,
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            srNo: { type: "INTEGER", description: "Sequential serial number starting from 1" },
                            itemName: { type: "STRING", description: "The name of the product" },
                            packSize: { type: "STRING", description: "The size of the packaging" },
                            quantity: { type: "INTEGER", description: "The numeric quantity ordered" }
                        },
                        required: ["srNo", "itemName", "packSize", "quantity"]
                    }
                }
            }
        });

        const extractedRows = JSON.parse(response.text);

        console.log(`Gemini Extraction Successful: ${extractedRows.length} row(s) extracted.`);
        return extractedRows;

    } catch (error) {
        console.warn("Gemini API Error (Quota/Network/Auth):", error.message);
        console.log("Falling back seamlessly to local handwritten parser...");

        try {
            const fallbackRows = await parseHandwrittenLocally(inputPath);
            if (fallbackRows && fallbackRows.length > 0) {
                console.log(`Local fallback extracted ${fallbackRows.length} rows successfully.`);
                return fallbackRows;
            }
        } catch (fallbackErr) {
            console.error("Local fallback also encountered an error:", fallbackErr.message);
        }

        return [
            {
                srNo: 1,
                itemName: "Please check / enter item name",
                packSize: "-",
                quantity: 1
            }
        ];
    }
}

module.exports = {
    extractHandwrittenInvoice
};