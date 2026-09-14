const path = require("path");
const fs = require("fs");
const { createWorker } = require("tesseract.js");

// Resolve local folder containing eng.traineddata
function getLangPath() {
    const candidate1 = path.join(__dirname, "..");
    if (fs.existsSync(path.join(candidate1, "eng.traineddata"))) {
        return candidate1;
    }
    const candidate2 = process.cwd();
    if (fs.existsSync(path.join(candidate2, "eng.traineddata"))) {
        return candidate2;
    }
    return __dirname;
}

let workerInstance = null;
let workerInitPromise = null;

async function getWorker() {
    if (workerInstance) {
        return workerInstance;
    }

    if (!workerInitPromise) {
        workerInitPromise = (async () => {
            const langPath = getLangPath();
            console.log("Initializing warm Tesseract worker with local langPath:", langPath);

            const worker = await createWorker("eng", 1, {
                langPath,
                gzip: false
            });

            await worker.setParameters({
                tessedit_pageseg_mode: "6",
                preserve_interword_spaces: "1"
            });

            workerInstance = worker;
            return worker;
        })().catch((err) => {
            workerInitPromise = null;
            workerInstance = null;
            throw err;
        });
    }

    return workerInitPromise;
}

async function performOCR(imagePath) {
    console.log("Starting Tesseract OCR on:", imagePath);
    try {
        const worker = await getWorker();

        const result = await worker.recognize(imagePath, {}, {
            text: true,
            tsv: true
        });

        console.log("OCR completed successfully.");

        return {
            text: result.data.text || "",
            tsv: result.data.tsv || ""
        };
    } catch (error) {
        console.error("Tesseract OCR Error:", error.message);
        // Reset worker on failure so subsequent requests can recover
        workerInstance = null;
        workerInitPromise = null;
        throw error;
    }
}

async function performHandwrittenOCR(imagePaths) {
    console.log("Starting handwritten OCR...");
    try {
        const worker = await getWorker();
        const results = [];

        for (const imagePath of imagePaths) {
            console.log("Running OCR on:", imagePath);
            const result = await worker.recognize(
                imagePath,
                {},
                {
                    text: true,
                    tsv: true
                }
            );

            results.push({
                text: result.data.text || "",
                tsv: result.data.tsv || "",
                confidence: result.data.confidence || 0
            });
        }

        results.sort((a, b) => b.confidence - a.confidence);
        return results[0] || { text: "", tsv: "", confidence: 0 };
    } catch (error) {
        console.error("Handwritten OCR Error:", error.message);
        workerInstance = null;
        workerInitPromise = null;
        throw error;
    }
}

module.exports = {
    performOCR,
    performHandwrittenOCR,
    getWorker
};