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

async function performOCR(imagePath) {
    console.log("Starting Tesseract OCR on:", imagePath);
    const langPath = getLangPath();
    const worker = await createWorker("eng", 1, {
        langPath,
        gzip: false
    });

    try {
        await worker.setParameters({
            tessedit_pageseg_mode: "6",
            preserve_interword_spaces: "1"
        });

        const result = await worker.recognize(imagePath, {}, {
            text: true,
            tsv: true
        });

        console.log("OCR completed successfully.");

        return {
            text: result.data.text || "",
            tsv: result.data.tsv || ""
        };
    } finally {
        await worker.terminate();
    }
}

async function performHandwrittenOCR(imagePaths) {
    console.log("Starting handwritten OCR...");
    const langPath = getLangPath();
    const worker = await createWorker("eng", 1, {
        langPath,
        gzip: false
    });

    try {
        await worker.setParameters({
            tessedit_pageseg_mode: "6",
            preserve_interword_spaces: "1"
        });

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
    } finally {
        await worker.terminate();
    }
}

module.exports = {
    performOCR,
    performHandwrittenOCR
};