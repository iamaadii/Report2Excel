const fs = require("fs");
const zlib = require("zlib");
const sharp = require("sharp");
const { PDFDocument, PDFName, PDFRawStream } = require("pdf-lib");
const { PDFParse } = require("pdf-parse");

/**
 * Extracts page images from any PDF file (both scanned image PDFs and digital vector PDFs).
 * - For scanned/photo PDFs: Extracts raw embedded image streams directly.
 * - For digital vector PDFs: Renders page screenshots to crisp PNG buffers.
 * 
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<Array<Buffer>>} Array of PNG image buffers
 */
async function extractImagesFromPdf(filePath) {
    const data = fs.readFileSync(filePath);
    const imageBuffers = [];

    // 1. Try extracting raw embedded images first (fastest for scanned/handwritten photo PDFs)
    try {
        const doc = await PDFDocument.load(data, { ignoreEncryption: true });
        const context = doc.context;

        for (const [ref, obj] of context.enumerateIndirectObjects()) {
            if (obj instanceof PDFRawStream) {
                const dict = obj.dict;
                const subtype = dict.get(PDFName.of("Subtype"));
                if (subtype === PDFName.of("Image")) {
                    const width = dict.get(PDFName.of("Width"))?.asNumber();
                    const height = dict.get(PDFName.of("Height"))?.asNumber();
                    const filter = dict.get(PDFName.of("Filter"));
                    const colorSpace = dict.get(PDFName.of("ColorSpace"));

                    if (!width || !height) continue;

                    let imgBuf = Buffer.from(obj.contents);
                    try {
                        const filterStr = filter ? filter.toString() : "";
                        if (filterStr.includes("FlateDecode")) {
                            try {
                                imgBuf = zlib.inflateSync(imgBuf);
                            } catch (_) {
                                imgBuf = zlib.inflateRawSync(imgBuf);
                            }
                        }

                        const isJpeg = filterStr.includes("DCTDecode") ||
                            (imgBuf.length > 3 && imgBuf[0] === 0xff && imgBuf[1] === 0xd8);

                        if (isJpeg) {
                            const pngBuf = await sharp(imgBuf).png().toBuffer();
                            imageBuffers.push(pngBuf);
                        } else {
                            const isRgb = (colorSpace && colorSpace.toString().includes("DeviceRGB")) || (imgBuf.length === width * height * 3);
                            const isCmyk = (colorSpace && colorSpace.toString().includes("DeviceCMYK")) || (imgBuf.length === width * height * 4);
                            const channels = isRgb ? 3 : (isCmyk ? 4 : 1);
                            try {
                                const pngBuf = await sharp(imgBuf, { raw: { width, height, channels } }).png().toBuffer();
                                imageBuffers.push(pngBuf);
                            } catch (_) {
                                const pngBuf = await sharp(imgBuf).png().toBuffer();
                                imageBuffers.push(pngBuf);
                            }
                        }
                    } catch (err) {
                        console.warn("Failed to decode an image stream:", err.message);
                    }
                }
            }
        }
    } catch (err) {
        console.warn("pdf-lib raw image extraction note:", err.message);
    }

    // 2. If no embedded images found (e.g. digital vector PDF), render pages to PNG screenshots
    if (imageBuffers.length === 0) {
        try {
            const parser = new PDFParse({ data: new Uint8Array(data) });
            await parser.load();
            const shot = await parser.getScreenshot();
            if (shot && shot.pages && shot.pages.length > 0) {
                for (const page of shot.pages) {
                    if (page.dataUrl) {
                        const base64 = page.dataUrl.replace(/^data:image\/\w+;base64,/, "");
                        imageBuffers.push(Buffer.from(base64, "base64"));
                    }
                }
            }
        } catch (renderErr) {
            console.warn("PDFParse screenshot render note:", renderErr.message);
        }
    }

    return imageBuffers;
}

/**
 * Extracts digital text layer from a PDF file if present.
 * 
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromPdf(filePath) {
    try {
        const data = fs.readFileSync(filePath);
        const parser = new PDFParse({ data: new Uint8Array(data) });
        await parser.load();
        const textObj = await parser.getText();
        return textObj?.text || "";
    } catch (err) {
        return "";
    }
}

module.exports = {
    extractImagesFromPdf,
    extractTextFromPdf
};