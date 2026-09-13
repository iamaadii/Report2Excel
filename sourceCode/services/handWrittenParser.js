function cleanText(value) {

    if (!value) {
        return "";
    }

    return value
        .trim()
        .replace(/\s+/g, " ");
}


function cleanOCRNumber(value) {

    if (!value) {
        return "";
    }

    value = value.trim();

    // Common OCR mistakes
    value = value
        .replace(/[Oo]/g, "0")
        .replace(/[Il]/g, "1");

    return value;
}


function parseHandwrittenLine(line) {

    if (!line) {
        return null;
    }


    line = cleanText(line);


    // Ignore header
    if (
        /^sr\.?\s*no/i.test(line) ||
        /^sr\.?\s*number/i.test(line) ||
        /^item\s*name/i.test(line)
    ) {
        return null;
    }


    /*
        Expected:

        Sr.No
        Item Name
        Pack Size
        Quantity

        Example:

        1 VASU ALOVER GEL 200 GM 5
    */

    const match = line.match(
        /^(\d+)\s+(.+?)\s+(\d+(?:\.\d+)?\s*(?:GM|G|ML|MG|KG|L|TAB|TABLET|CAPSULES?)?)\s+(\d+(?:\.\d+)?)$/i
    );


    if (!match) {
        return null;
    }


    const srNo =
        cleanOCRNumber(match[1]);

    const itemName =
        cleanText(match[2]);

    const packSize =
        cleanText(match[3]);

    const quantity =
        cleanOCRNumber(match[4]);


    if (!itemName) {
        return null;
    }


    return {
        srNo,
        itemName,
        packSize,
        quantity
    };
}


function parseHandwrittenText(text) {

    if (!text) {
        return [];
    }


    const lines =
        text
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);


    const rows = [];


    for (const line of lines) {

        const row =
            parseHandwrittenLine(line);

        if (row) {
            rows.push(row);
        }
    }


    return rows;
}


module.exports = {
    parseHandwrittenText,
    parseHandwrittenLine
};