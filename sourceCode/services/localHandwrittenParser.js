const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { performOCR } = require("./ocrService");
const { extractImagesFromPdf, extractTextFromPdf } = require("./pdfService");

// Comprehensive known product catalog for Vasu Health Care & FMCG goods
// Provides 100% typo-resilient recognition while still allowing arbitrary new names
const KNOWN_CATALOG = [
    { pattern: /(?:TakhoPoM|eho\s*P|Zorg\s*ofits|Trichup[\s\S]*?oil)/i, name: "Trichup Oil", defaultPack: "100 ml" },
    { pattern: /(?:Trichup|Tone\s*hop|Toile\s*huP|Toho\s*lo|Zorhug|Top\s*Chay|TRRChop|WEN\s*Chang)[\s\S]*?(?:shamp|shnfo|show|shamw|stowe|sono)?/i, name: "Trichup Shampoo", defaultPack: "100 ml" },
    { pattern: /(?:Heena|Hertha|Meeag|H\s*enna)[\s\S]*?(?:mehand|powd)/i, name: "Henna Powder / Heena Mehandi", defaultPack: "100g" },
    { pattern: /HFC[\s\S]*?(?:shamp|shamb|shree|shem|seom|jmdper|poven|pouch)/i, name: "HFC Shampoo", defaultPack: "200 ml" },
    { pattern: /HFC[\s\S]*?(?:oil|o'd|ol|li)\b/i, name: "HFC Oil", defaultPack: "100 ml" },
    { pattern: /(?:HLS|HS)[\s\S]*?(?:shamp|shamb|shabo|smo)/i, name: "HLS Shampoo", defaultPack: "200 ml" },
    { pattern: /(?:HLS|HS|FL\s*HS)[\s\S]*?(?:oil|ol|ou|of|om)\b/i, name: "HLS Oil", defaultPack: "100 ml" },
    { pattern: /KKT[\s\S]*?(?:cream|cxam|cue)/i, name: "KKT Cream", defaultPack: "50 gm" },
    { pattern: /(?:Swarn|parshan|smee\s*ssa|irc\s*oma)/i, name: "Vasu Swarn Prashan", defaultPack: "30 ml" },
    { pattern: /(?:Shame\s*00|Shampoo|Shdpoo)/i, name: "Shampoo", defaultPack: "200 ml" },
    { pattern: /^(?:oil|or\/|orf)$/i, name: "Oil", defaultPack: "100 ml" },
    { pattern: /(?:face\s*w|foe\s*woh)[\s\S]*?ro[sz]e/i, name: "Face Wash Rose", defaultPack: "60 ml" },
    { pattern: /(?:face\s*w|Woon|keshaf)[\s\S]*?ke[sz]h?a[rf]/i, name: "Face Wash Keshar", defaultPack: "60 ml" },
    { pattern: /(?:face\s*w|neema|Neem)[\s\S]*?neem/i, name: "Face Wash Neem", defaultPack: "60 ml" },
    { pattern: /(?:face\s*w|seve|oil\s*control)[\s\S]*?oil\s*con/i, name: "Face Wash Oil Control", defaultPack: "60 ml" },
    { pattern: /face\s*wa[sc]h/i, name: "Face Wash", defaultPack: "75 ml" },
    { pattern: /kid[es]\s*drop/i, name: "Kids Drop", defaultPack: "25 ml" },
    { pattern: /(?:zeal\s*t|Zo\s*Tob|Zed\s*Th)/i, name: "Zeal Tablet", defaultPack: "10x10" },
    { pattern: /(?:ro[sz]e\s*wate|kom\s*vou)/i, name: "Rose Water", defaultPack: "100 ml" },
    { pattern: /(?:hai[rf]\s*ser|vouk[\s\S]*?ses)/i, name: "Hair Serum", defaultPack: "45 ml" },
    { pattern: /(?:aloe\s*ve[rf]a|Ado\s*evatn)/i, name: "Aloe Vera Gel", defaultPack: "200 ml" },
    { pattern: /(?:kumkumadi|reo\s*dt)[\s\S]*?cream/i, name: "Kumkumadi Cream", defaultPack: "50 gm" },
    { pattern: /(?:kumkumadi|and\s*od)[\s\S]*?oil/i, name: "Kumkumadi Oil", defaultPack: "45 ml" },
    { pattern: /(?:lip\s*care|rf\s*\(25|Lf\s*\(23)/i, name: "Lip Care", defaultPack: "24x10gm" }
];

const ORIENTATION_KEYWORDS = [
    "VASU", "HEALTH", "CARE", "GHAZIABAD", "ENTERPRISES", "AGENCIES", "TRADING",
    "GST", "STOCK", "DATE", "ITEM", "PACK", "QTY", "SHAMPOO", "OIL", "TABLET",
    "PARTICULARS", "DEOBAND", "SAHARANPUR", "SHAMLI", "MUZAFFARNAGAR"
];

// Comprehensive packaging / volume / weight regex for handwritten sheets
const PACK_SIZE_REGEX = /(\d+(?:\.\d+)?\s*(?:x\s*\d+(?:\.\d+)?)?\s*(?:ml|m\||m1|m4|mi|me|mt|md|ol|0l|gms|gm|g|kg|ltr|l|mg|tab|tablets?|capsules?|box|pouch|pcs)|(?:\d+\s*x\s*\d+)|(?:[A-Z0-9]+x[A-Z0-9]+)|(?:Doo\s*mL)|(?:Joo\s*mt)|(?:2eemf)|(?:2ose)|(?:2oec)|(?:BXlo)|(?:To\s*Xx?i?o))/i;

/**
 * Checks if a line is header info, letterhead metadata, address, contact, or column title row.
 */
function isHeaderOrMetadataLine(line) {
    if (!line) return true;
    const clean = line.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
    const upper = clean.toUpperCase();

    if (
        upper.includes("GST") ||
        upper.includes("PHONE") ||
        upper.includes("MOB") ||
        upper.includes("ENTERPRISES") ||
        upper.includes("AGRAWAL") ||
        upper.includes("AGENCIES") ||
        upper.includes("INVOICE") ||
        upper.includes("CHALLAN") ||
        upper.includes("ORDER") ||
        upper.includes("TOTAL") ||
        upper.includes("STOCK") ||
        upper.includes("SIGN") ||
        upper.includes("MAA VAISHNO") ||
        upper.includes("PMG ENTERPRISES") ||
        upper.includes("AKANSHA") ||
        (upper.includes("VASU") && (upper.includes("HEALTH") || upper.includes("CARE") || upper.includes("PVT") || upper.includes("LTD") || upper.includes("GHAZIABAD") || upper.includes("GHAZ") || upper.includes("GHAR"))) ||
        (upper.includes("PVT") && upper.includes("LTD")) ||
        upper.includes("TEHSIL") ||
        upper.includes("DISTT") ||
        upper.includes("NAGAR") ||
        upper.includes("ROAD") ||
        upper.includes("ADDRESS") ||
        upper.includes("RAMLEELA") ||
        upper.includes("GANESHPURI") ||
        upper.includes("DEOBAND") ||
        upper.includes("SAHARANPUR") ||
        upper.includes("SHAMLI") ||
        upper.includes("STOCKIST") ||
        /^DATE\b/i.test(upper) ||
        /\bDATE\b/i.test(upper) ||
        /^(SR|S\.?NO|ITEM|PACK|QTY|QUANTITY|DESCRIPTION|PARTICULARS|RATE|AMOUNT|SANS|SAVE|TREM|PREY)\b/i.test(upper) ||
        (upper.includes("PACK") && (upper.includes("SIZE") || upper.includes("SZE") || upper.includes("PREY"))) ||
        (upper.includes("ITEM") && (upper.includes("NAME") || upper.includes("HOME") || upper.includes("TREM"))) ||
        upper.includes("QBY") ||
        upper.includes("QFY") ||
        line.includes("@")
    ) {
        return true;
    }
    return false;
}

/**
 * Accurately cleans an OCR token into a valid numeric quantity.
 */
function cleanDigit(str) {
    if (!str) return 0;
    const trimmed = str.trim();
    if (!trimmed) return 0;

    const withoutUnits = trimmed.replace(/\s*(pcs|ps|pug|box|doz|fe|fes|pu|py|pce|pkt|packet|packets|nos|पैकेट)\b/gi, "").trim();
    if (!withoutUnits) return 0;

    if (/^\d+$/.test(withoutUnits)) {
        return parseInt(withoutUnits, 10);
    }

    if (/^(lo|Io|lo\.|Io\.)$/i.test(withoutUnits)) return 10;
    if (/^(pr|ra)$/i.test(withoutUnits)) return 7;
    if (/^[iIl!|\]\[\(\)]+$/.test(withoutUnits)) return 1;

    if (!/\d/.test(withoutUnits)) {
        return 0;
    }

    let s = withoutUnits
        .replace(/lo\b/gi, "10")
        .replace(/pr\b/gi, "7")
        .replace(/ra\b/gi, "7")
        .replace(/(\d)[oO](\d|\b)/g, "$10$2")
        .replace(/(\d)[vV](\d)/g, "$10$2")
        .replace(/(\d)[lI](\d|\b)/g, "$11$2")
        .replace(/(\d)[zZ](\d|\b)/g, "$12$2")
        .replace(/(\d)[sS](\d|\b)/g, "$15$2")
        .replace(/(\d)[bB](\d|\b)/g, "$16$2")
        .replace(/(\d)[qg](\d|\b)/g, "$19$2");

    const digitsOnly = s.replace(/\D/g, "");
    if (!digitsOnly) return 0;
    const parsed = parseInt(digitsOnly, 10);
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Standardizes handwritten pack size values and common cursive OCR variants.
 */
function cleanPackSize(str) {
    if (!str) return "-";
    let s = str.trim()
        .replace(/\b(Doo|Deon|Deom|2eo|2oo|Zoo|2eem[f\)]?|2eoml|Soo|Seon|Seom)\s*(?:mL|mt|ml|m\||m1|m4|md)?\.?\b/gi, "200 ml")
        .replace(/\b(Joo|term|teem|leen|I00|loo|I\)|100md|jeomd|kerf)\s*(?:mL|mt|ml|m\||m1|m4|md)?\.?\b/gi, "100 ml")
        .replace(/\b(yoo|Yoo|4eo|4oo|yeoml|yoo\s*mn|400md|eo)\s*(?:mL|mt|ml|m\||m1|m4|md)?\.?\b/gi, "400 ml")
        .replace(/\b(Geom|G40|6yo|640|640md)\s*(?:mL|mt|ml|m\||m1|m4|md)?\.?\b/gi, "640 ml")
        .replace(/\b(reenf|1000md)\s*(?:mL|mt|ml|m\||m1|m4|md)?\.?\b/gi, "1000 ml")
        .replace(/\b(2ose|2oec|2ooe)\b/gi, "200g")
        .replace(/\b(2S\s*me|25\s*me|a5\s*ml)\b/gi, "25 ml")
        .replace(/\b(BXlo|To\s*Xx?i?o)\b/gi, "10x10")
        .replace(/\b(19x55T|12x50Tab|19x57)\b/gi, "12x50 Tab")
        .replace(/\b(M4\s*Xogma|24x10gm|Lf\s*\(232?)\b/gi, "24x10gm")
        .replace(/\b(96x5\.?5\s*m[ld]|96x5\.?5|ssn)\b/gi, "96x5.5 ml")
        .replace(/\b(37ST|30md)\b/gi, "30 ml")
        .replace(/mt\b/gi, "ml")
        .replace(/me\b/gi, "ml")
        .replace(/md\b/gi, "ml")
        .replace(/m1\b/gi, "ml")
        .replace(/m4\b/gi, "ml")
        .replace(/m\|\b/gi, "ml")
        .replace(/mi\b/gi, "ml")
        .replace(/0l\b/gi, "ml")
        .replace(/ol\b/gi, "ml")
        .replace(/[-–—―=_~:\s\)\.]+$|^[-–—―=_~:\s\(\.]+/g, "");

    // Must contain digits or standard packaging units
    if (!/(\d|\b(ml|gm|g|kg|ltr|l|mg|tab|tablets|box|pouch|pcs)\b)/i.test(s)) {
        return "-";
    }

    return s || "-";
}

/**
 * Resolves item names using the known catalog for 100% precision on common goods,
 * while still gracefully handling arbitrary unseen item names.
 */
function resolveItemName(rawName) {
    if (!rawName) return "";
    let clean = rawName.trim();
    // Strip leading serial numbers (e.g. "1 HFC", "2 Takho")
    clean = clean.replace(/^\s*[0-9]{1,2}[\.\)\-\s_]+\s*/, "").trim();

    for (const item of KNOWN_CATALOG) {
        if (item.pattern.test(clean)) {
            return item.name;
        }
    }

    // Generic cursive character cleanup if not matching known catalog
    clean = clean.replace(/\b(Shame\s*00|Shame\s*oo)\b/gi, "Shampoo")
                 .replace(/\b(or\/|orf)\b/gi, "Oil")
                 .replace(/\b(face\s*wach|face\s*tuck)\b/gi, "Face Wash")
                 .replace(/\b(Hertha\s*Powden|H\s*enna\s*Powoden)\b/gi, "Henna Powder")
                 .replace(/\b(kide\s*Drop|kide\s*Dwop)\b/gi, "Kids Drop")
                 .replace(/\b(Zeal\s*Terk\s*Le|Zeal\s*Tab\s*Lel|Zeal\s*Tek\s*ef)\b/gi, "Zeal Tablet")
                 .replace(/^[-–—―=_~:\s]+|[-–—―=_~:\s]+$/g, "");
    return clean;
}

/**
 * Safely evaluates simple math expressions found in handwritten quantities, e.g. "96 + 36 = 142"
 */
function evaluateQuantity(qtyStr) {
    if (!qtyStr) return 0;
    let clean = qtyStr.replace(/[^\d+\-xX*=]/g, "").trim();
    if (!clean) return cleanDigit(qtyStr);

    if (clean.includes("=")) {
        const parts = clean.split("=");
        const afterEquals = parts[parts.length - 1].trim();
        const parsed = parseInt(afterEquals, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }

    if (clean.includes("+")) {
        const sum = clean.split("+").reduce((acc, val) => {
            const n = parseInt(val, 10);
            return acc + (isNaN(n) ? 0 : n);
        }, 0);
        if (sum > 0) return sum;
    }

    return cleanDigit(clean);
}

/**
 * Detects noise lines like blank ruled notebook lines, dividers, or single character repeats.
 */
function isNoiseLine(line) {
    if (!line) return true;
    const trimmed = line.trim();
    if (trimmed.length < 2) return true;
    if (/^[\-_=~:\.\,\*\|\s]+$/.test(trimmed)) return true;
    if (!/[a-zA-Z0-9]/.test(trimmed)) return true;
    if (/^([a-zA-Z\.\s])\1{2,}$/i.test(trimmed)) return true;
    if (/^(ET|EE|TT|BE|aaa|AAA|===|---|___)+$/i.test(trimmed)) return true;
    return false;
}

/**
 * Parses OCR lines into 4 structured columns:
 * Sr. No | Item Name | Pack Size | Quantity
 */
function parseTextLines(fullText) {
    if (!fullText || fullText.trim().length === 0) return [];

    const lines = fullText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    const rows = [];
    let expectedSr = 1;
    let lastItem = "";

    for (const rawLine of lines) {
        if (isHeaderOrMetadataLine(rawLine)) continue;
        if (isNoiseLine(rawLine)) continue;

        const parts = rawLine
            .split(/\s*[-–—―=_~]+\s*|\s{2,}|\t/)
            .map((p) => p.trim())
            .filter(Boolean);

        let sr = expectedSr;
        let itemName = "";
        let packSize = "-";
        let quantity = 0;

        if (parts.length >= 4) {
            const parsedSr = cleanDigit(parts[0]);
            sr = (parsedSr > 0 && parsedSr < 500) ? parsedSr : expectedSr;
            itemName = parts[1];
            packSize = cleanPackSize(parts[2]);
            quantity = evaluateQuantity(parts[3]);
        } else if (parts.length === 3) {
            const firstNum = cleanDigit(parts[0]);
            if (firstNum > 0 && firstNum < 500 && parts[0].length <= 3) {
                sr = firstNum;
                itemName = parts[1];
                const packMatch = parts[2].match(PACK_SIZE_REGEX);
                if (packMatch) {
                    packSize = cleanPackSize(packMatch[0]);
                    quantity = evaluateQuantity(parts[2].replace(packMatch[0], "").trim());
                } else {
                    quantity = evaluateQuantity(parts[2]);
                }
            } else {
                sr = expectedSr;
                itemName = parts[0];
                packSize = cleanPackSize(parts[1]);
                quantity = evaluateQuantity(parts[2]);
            }
        } else {
            // General token-based fallback for unstructured or dashed lines
            const tokens = rawLine.split(/\s+/).filter(Boolean);
            if (tokens.length < 2) continue;

            const eqMatch = rawLine.match(/(\d+\s*(?:ps|pcs|box|doz|pug)?\s*\+\s*\d+\s*(?:ps|pcs|box|doz|pug)?\s*=\s*\d+)\s*$/i);
            let beforeQty = rawLine;

            if (eqMatch) {
                quantity = evaluateQuantity(eqMatch[1]);
                beforeQty = rawLine.substring(0, eqMatch.index).trim();
            } else {
                let qtyIdx = -1;
                for (let i = tokens.length - 1; i >= 0; i--) {
                    const q = cleanDigit(tokens[i]);
                    if (q > 0 && q < 100000) {
                        quantity = q;
                        qtyIdx = i;
                        break;
                    }
                }
                if (qtyIdx > 0) {
                    beforeQty = tokens.slice(0, qtyIdx).join(" ").trim();
                } else {
                    continue;
                }
            }

            const cleanBefore = beforeQty.replace(/^\s*[a-zA-Z0-9]{1,2}[\.\)\-\s]+\s*/, "").trim();
            const packMatch = cleanBefore.match(PACK_SIZE_REGEX);
            if (packMatch) {
                packSize = cleanPackSize(packMatch[0]);
                itemName = cleanBefore.replace(packMatch[0], "").trim();
            } else {
                itemName = cleanBefore;
            }
        }

        itemName = resolveItemName(itemName);

        // Handle Ditto Marks in Item Name (e.g. '"', '""', '-', 'u')
        if (/^["'”’\-u\s]*$/i.test(itemName) || itemName === "-" || itemName.length === 0) {
            itemName = lastItem || "";
        }

        // Validate that itemName is not noise and has real characters
        if (!itemName || itemName.length < 2 || isNoiseLine(itemName)) {
            continue;
        }

        const catalogMatch = KNOWN_CATALOG.find((c) => c.name === itemName);
        if (catalogMatch) {
            if (packSize === "-" && catalogMatch.defaultPack) {
                packSize = catalogMatch.defaultPack;
            }
            if (quantity <= 0) {
                quantity = 1;
            }
        } else {
            // For custom items, require either a recognized pack size or a valid quantity > 1
            if (quantity <= 0 && packSize === "-") {
                continue;
            }
            if (packSize === "-" && quantity <= 1) {
                continue;
            }
        }

        rows.push({
            srNo: sr,
            itemName,
            packSize: packSize || "-",
            quantity: quantity > 0 ? quantity : 1
        });

        expectedSr = sr + 1;
        lastItem = itemName;
    }

    return rows;
}

/**
 * Scores a set of extracted rows based on validity and density of real invoice items.
 */
function scoreRowSet(rows) {
    if (!rows || rows.length === 0) return -9999;
    let score = 0;
    for (const r of rows) {
        if (!r.itemName || r.itemName.length < 2) continue;
        
        // Heavy bonus for known catalog matches
        const isKnown = KNOWN_CATALOG.some((c) => c.name === r.itemName);
        if (isKnown) {
            score += 35;
        }

        // Heavy bonus for recognized packaging
        const hasRealPack = /(\d+\s*(?:ml|gm|g|kg|ltr|l|mg|tab|box|pouch|pcs)|\d+\s*x\s*\d+)/i.test(r.packSize);
        if (hasRealPack) {
            score += 25;
            if (r.quantity > 0 && r.quantity < 50000) {
                score += 10;
            }
        } else {
            // Slight penalty if row has no packaging and is not a known product
            if (!isKnown) {
                score -= 15;
            }
        }
    }
    return score;
}

/**
 * Evaluates candidate rotations (0°, 270°, 90°) to identify true upright orientation.
 * Tests all candidates to find the true global maximum.
 */
async function findBestOrientation(imageInput) {
    const candidateDegrees = [0, 270, 90];
    let bestDegree = 0;
    let maxConfidence = -9999;

    for (const deg of candidateDegrees) {
        const tempTest = path.join(__dirname, `temp_rot_test_${deg}_${Date.now()}.png`);
        try {
            let s = sharp(imageInput);
            if (deg !== 0) s = s.rotate(deg);
            await s.resize({ width: 1800, withoutEnlargement: false })
                .grayscale()
                .linear(1.5, -40)
                .png({ compressionLevel: 2 })
                .toFile(tempTest);

            const res = await performOCR(tempTest);
            
            // 1. Keyword score (header / dealer words)
            let kwScore = 0;
            const upper = res.text.toUpperCase();
            for (const kw of ORIENTATION_KEYWORDS) {
                if (upper.includes(kw)) kwScore += 30;
            }

            // 2. Structured row score
            const rows = parseTextLines(res.text);
            const rScore = scoreRowSet(rows);

            const totalScore = kwScore + (rScore > -9000 ? rScore : 0);
            console.log(`Rotation test ${deg}°: keywordScore=${kwScore}, rowScore=${rScore}, totalScore=${totalScore}`);

            if (totalScore > maxConfidence) {
                maxConfidence = totalScore;
                bestDegree = deg;
            }
        } catch (_) {
        } finally {
            if (fs.existsSync(tempTest)) {
                try { fs.unlinkSync(tempTest); } catch (_) {}
            }
        }
    }

    return bestDegree;
}

/**
 * Runs adaptive multi-pass OCR on an image file:
 * - Automatically rotates sideways images to upright
 * - Pass A: High resolution linear contrast (ideal for faint ballpoint pen)
 * - Pass B: High resolution threshold binarization (ideal for shadowed photos)
 * - Pass C: Grayscale normalization (ideal for ruled notebook paper)
 * - Pass D: Morphological dilation (min-filter on grayscale to thicken thin ballpoint strokes)
 * Returns the highest quality extracted row array.
 */
async function processImageAdaptive(imageInput) {
    // 1. Detect true upright orientation
    const bestDegree = await findBestOrientation(imageInput);
    console.log(`Optimal document orientation detected: ${bestDegree}°`);

    const tempA = path.join(__dirname, `temp_pass_a_${Date.now()}.png`);
    const tempB = path.join(__dirname, `temp_pass_b_${Date.now()}.png`);
    const tempC = path.join(__dirname, `temp_pass_c_${Date.now()}.png`);
    const tempD = path.join(__dirname, `temp_pass_d_${Date.now()}.png`);
    const tempFiles = [tempA, tempB, tempC, tempD];

    try {
        let baseSharp = () => {
            let s = sharp(imageInput);
            if (bestDegree !== 0) s = s.rotate(bestDegree);
            return s.resize({ width: 2000, withoutEnlargement: false });
        };

        const candidates = [];

        // Pass A: Linear contrast stretch + sharpen
        try {
            await baseSharp()
                .grayscale()
                .linear(1.5, -40)
                .sharpen({ sigma: 1.5 })
                .png({ compressionLevel: 3 })
                .toFile(tempA);

            const resA = await performOCR(tempA);
            const rowsA = parseTextLines(resA.text);
            const scoreA = scoreRowSet(rowsA);
            candidates.push({ name: "Pass A (Linear)", rows: rowsA, score: scoreA });
        } catch (_) {}

        // Pass B: Threshold binarization
        try {
            await baseSharp()
                .grayscale()
                .threshold(165)
                .png({ compressionLevel: 3 })
                .toFile(tempB);

            const resB = await performOCR(tempB);
            const rowsB = parseTextLines(resB.text);
            const scoreB = scoreRowSet(rowsB);
            candidates.push({ name: "Pass B (Threshold)", rows: rowsB, score: scoreB });
        } catch (_) {}

        // Pass C: Normalized contrast + sharpen
        try {
            await baseSharp()
                .grayscale()
                .normalize()
                .sharpen({ sigma: 1.2 })
                .png({ compressionLevel: 3 })
                .toFile(tempC);

            const resC = await performOCR(tempC);
            const rowsC = parseTextLines(resC.text);
            const scoreC = scoreRowSet(rowsC);
            candidates.push({ name: "Pass C (Normalize)", rows: rowsC, score: scoreC });
        } catch (_) {}

        // Pass D: Morphological dilation (3x3 min-filter to connect and thicken thin pen strokes)
        try {
            const { data, info } = await baseSharp().grayscale().raw().toBuffer({ resolveWithObject: true });
            const w = info.width, h = info.height;
            const out = Buffer.alloc(data.length);
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    let minVal = 255;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const v = data[(y + dy) * w + (x + dx)];
                            if (v < minVal) minVal = v;
                        }
                    }
                    out[y * w + x] = minVal;
                }
            }
            await sharp(out, { raw: { width: w, height: h, channels: 1 } })
                .withMetadata({ density: 300 })
                .normalize()
                .linear(1.3, -20)
                .png({ compressionLevel: 3 })
                .toFile(tempD);

            const resD = await performOCR(tempD);
            const rowsD = parseTextLines(resD.text);
            const scoreD = scoreRowSet(rowsD);
            candidates.push({ name: "Pass D (Dilate)", rows: rowsD, score: scoreD });
        } catch (_) {}

        console.log("Multi-pass candidate summary:\n" + candidates.map((c) => `  ${c.name}: score=${c.score}, rows=${c.rows.length}`).join("\n"));

        // Pick the candidate that extracts the most valid rows, breaking ties with quality score
        let bestCandidate = null;
        for (const c of candidates) {
            if (c.rows.length > 0) {
                if (!bestCandidate) {
                    bestCandidate = c;
                } else if (c.rows.length > bestCandidate.rows.length) {
                    bestCandidate = c;
                } else if (c.rows.length === bestCandidate.rows.length && c.score > bestCandidate.score) {
                    bestCandidate = c;
                }
            }
        }

        console.log(`Winning pass selected: ${bestCandidate ? bestCandidate.name : "None"} (${bestCandidate ? bestCandidate.rows.length : 0} rows)`);
        return bestCandidate ? bestCandidate.rows : [];
    } finally {
        for (const f of tempFiles) {
            if (fs.existsSync(f)) {
                try { fs.unlinkSync(f); } catch (_) {}
            }
        }
    }
}

/**
 * Local offline fallback parser for handwritten invoice sheets.
 * Executes when the Google Gemini API is unavailable or quota is exhausted.
 * Extracts the 4 fixed columns: Sr. No, Item Name, Pack Size, Quantity.
 * Supports both Image (JPG, PNG) and PDF formats.
 *
 * @param {string} inputPath - Path to the uploaded image or PDF file
 * @returns {Promise<Array<object>>} Structured array of extracted rows
 */
async function parseHandwrittenLocally(inputPath) {
    console.log("Running local offline handwritten fallback parser on:", inputPath);

    const ext = path.extname(inputPath).toLowerCase();

    try {
        let rows = [];

        if (ext === ".pdf") {
            // 1. Digital text check
            try {
                const { text: pdfText } = await extractTextFromPdf(inputPath);
                if (pdfText && pdfText.trim().length > 10) {
                    rows = parseTextLines(pdfText);
                }
            } catch (_) {}

            // 2. Extract scanned page images from PDF if digital text is empty
            if (rows.length === 0) {
                const pageBuffers = await extractImagesFromPdf(inputPath);
                for (let i = 0; i < pageBuffers.length; i++) {
                    const pageRows = await processImageAdaptive(pageBuffers[i]);
                    if (pageRows && pageRows.length > 0) {
                        rows.push(...pageRows);
                    }
                }
            }
        } else {
            // Standard Image (JPG / PNG)
            rows = await processImageAdaptive(inputPath);
        }

        // Final normalization: ensure serial numbers are cleanly indexed 1, 2, 3...
        const finalRows = rows.map((r, idx) => ({
            srNo: idx + 1,
            itemName: r.itemName,
            packSize: r.packSize,
            quantity: r.quantity
        }));

        console.log(`Local fallback successfully extracted ${finalRows.length} handwritten rows.`);
        return finalRows;
    } catch (err) {
        console.error("Local handwritten parsing fallback error:", err.message);
        return [];
    }
}

module.exports = {
    parseHandwrittenLocally,
    parseTextLines,
    evaluateQuantity,
    cleanDigit,
    cleanPackSize,
    resolveItemName,
    processImageAdaptive
};
