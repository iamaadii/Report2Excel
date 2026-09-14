const sharp = require("sharp");
const path = require("path");


async function enhanceImage(
    inputPath
) {

    const extension =
        path.extname(
            inputPath
        );


    const outputPath =
        inputPath.replace(
            extension,
            "-enhanced.png"
        );


    await sharp(inputPath)
        .resize({
            width: 1800,
            withoutEnlargement: true,
            fit: "inside"
        })
        .grayscale()
        .normalize()
        .sharpen({
            sigma: 1.2
        })
        .png({
            compressionLevel: 4
        })
        .toFile(outputPath);


    return outputPath;
}


async function enhanceHandwrittenImage(inputPath) {
    const extension = path.extname(inputPath);
    const basePath = inputPath.replace(extension, "");

    const normalPath = `${basePath}-hw-normal.png`;
    const thresholdPath = `${basePath}-hw-threshold.png`;
    const contrastPath = `${basePath}-hw-contrast.png`;

    console.log("Enhancing handwritten invoice...");

    // Version 1: Normal enhancement
    await sharp(inputPath)
        .rotate()
        .resize({
            width: 3000,
            withoutEnlargement: false,
            fit: "inside"
        })
        .grayscale()
        .normalize()
        .sharpen({ sigma: 1.2 })
        .png()
        .toFile(normalPath);


    // Version 2: Threshold
    await sharp(inputPath)
        .rotate()
        .resize({
            width: 3000,
            withoutEnlargement: false,
            fit: "inside"
        })
        .grayscale()
        .normalize()
        .threshold(170)
        .png()
        .toFile(thresholdPath);


    // Version 3: Contrast enhancement
    await sharp(inputPath)
        .rotate()
        .resize({
            width: 3000,
            withoutEnlargement: false,
            fit: "inside"
        })
        .grayscale()
        .clahe({
            width: 8,
            height: 8,
            maxSlope: 3
        })
        .sharpen({ sigma: 1.5 })
        .png()
        .toFile(contrastPath);


    console.log("Handwritten enhancement completed.");

    return {
        normalPath,
        thresholdPath,
        contrastPath
    };
}

module.exports = {
    enhanceImage,
    enhanceHandwrittenImage
};