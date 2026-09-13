const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

// Initialize the API with the new SDK client
// It automatically detects process.env.GEMINI_API_KEY
const ai = new GoogleGenAI();

async function extractHandwrittenInvoice(inputPath) {
    console.log("Starting Google Gemini API Extraction...", inputPath);

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
            You are a highly accurate data entry specialist. Extract the data table from this invoice document (which may contain one or multiple pages/reports).
            The table contains: S.No, Item Name, Pack Size, and Qty.
            
            CRITICAL RULES FOR ACCURACY:
            1. **Ignore Noise:** Skip letterheads (e.g., "AGRAWAL TRADING COMPANY"), dates, addresses, and signatures.
            2. **Ditto Marks:** If an item name is written as "u", "”", or "-", it means the item is the exact same as the row directly above it. You MUST output the actual item name from the row above, not the ditto mark.
            3. **Math Equations:** If the quantity is written as an equation (e.g., "96 Ps + 36 = 142"), evaluate it and output ONLY the final integer (142).
            4. **Language & Units:** If a unit is written in Hindi (e.g., "पैकेट"), translate the unit to English or ignore the Hindi word, keeping just the Pack Size (e.g., "96x5.5ml").
            5. **Format Cleaning:** Strip out words like "Pcs", "Ps", "Box", or "Pug" from the Quantity column. Quantity must be a pure Number.
            6. **Sequential S.No:** Ignore handwritten S.No numbers. Generate continuous sequential "srNo" (1, 2, 3...) across all valid product rows found across all pages/reports in the entire document.
        `;

        console.log("Analyzing document layout and handwriting context via Gemini...");
        
        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
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

        console.log("Gemini Extraction Successful:");
        console.log(extractedRows);

        return extractedRows;

    } catch (error) {
        console.error("Gemini API Extraction Error:", error);
        throw new Error("Failed to extract handwritten data via Gemini API.");
    }
}

module.exports = {
    extractHandwrittenInvoice
};