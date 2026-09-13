const { createWorker } = require("tesseract.js");

async function performOCR(imagePath) {
  console.log("Starting Tesseract OCR...");

  const worker = await createWorker("eng");

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: "6",
      preserve_interword_spaces: "1"
    });

    const result = await worker.recognize(imagePath, {}, {
      text: true,
      tsv: true
    });

    console.log("OCR completed.");

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

    const worker = await createWorker("eng");

    try {

        await worker.setParameters({
            tessedit_pageseg_mode: "6",
            preserve_interword_spaces: "1"
        });


        const results = [];

        for (const imagePath of imagePaths) {

            console.log(
                "Running handwritten OCR on:",
                imagePath
            );

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


        // Select the OCR result
        // having the highest confidence

        results.sort(
            (a, b) =>
                b.confidence - a.confidence
        );


        console.log(
            "Best handwritten OCR confidence:",
            results[0].confidence
        );


        return results[0];

    } finally {

        await worker.terminate();

    }
}

module.exports = {
    performOCR,
    performHandwrittenOCR
};