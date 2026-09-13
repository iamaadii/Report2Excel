// services/rowParser.js


// ======================================================
// CLEAN OCR NUMBER
// ======================================================

function cleanNumber(value) {
  if (!value) return "";

  value = value.trim();

  // "-" means empty value in this invoice
  if (value === "-") {
    return "";
  }

  // Fix OCR decimal spacing:
  // 20604 .55  -> 20604.55
  // 10922 .52  -> 10922.52
  value = value.replace(/\s*\.\s*/g, ".");

  // Remove remaining spaces
  value = value.replace(/\s+/g, "");

  return value;
}


// ======================================================
// NORMALIZE OCR LINE
// ======================================================

function normalizeLine(line) {

  line = line.trim();

  /*
    VERY IMPORTANT

    Tesseract sometimes produces:

        20604 .55

    instead of:

        20604.55

    Join them before splitting the line.
  */

  line = line.replace(
    /(\d)\s+\.(\d+)/g,
    "$1.$2"
  );

  /*
    Also handle:

        10922 . 52

    ->

        10922.52
  */

  line = line.replace(
    /(\d)\s+\.\s+(\d+)/g,
    "$1.$2"
  );

  return line;
}


// ======================================================
// PARSE ONE INVOICE ROW
// ======================================================

function parseInvoiceLine(originalLine) {

  if (!originalLine) {
    return null;
  }

  // Normalize OCR mistakes first
  const line = normalizeLine(originalLine);

  // Ignore unwanted lines
  if (
    /^TOTAL\b/i.test(line) ||
    /^VASU\s*$/i.test(line) ||
    /^VASU WELLNESS/i.test(line) ||
    /^ITEM DESCRIPTION/i.test(line) ||
    /^PACK SIZE/i.test(line)
  ) {
    return null;
  }


  // ====================================================
  // 1. GET M.EXP
  // ====================================================

  /*
      Example:

      ... 146 6/24

      M.EXP = 6/24
  */

  const mExpMatch =
    line.match(/(\d{1,2}\/\d{2})\s*$/);

  if (!mExpMatch) {
    return null;
  }

  const mExp = mExpMatch[1];


  // Remove M.EXP
  let remaining =
    line.substring(0, mExpMatch.index).trim();


  // ====================================================
  // 2. SPLIT INTO TOKENS
  // ====================================================

  const tokens = remaining.split(/\s+/);


  /*
      Example:

      VASU
      TRICHIP
      HFC
      OIL
      200ML
      303
      55880.26
      -
      0.00
      109
      20604.55
      194
      35778.12
      146
  */


  /*
      From RIGHT SIDE:

      146          -> Dump Qty
      35778.12     -> Closing Value
      194          -> Closing Qty
      20604.55     -> Issue Value
      109          -> Issue Qty
      0.00         -> Receipt Value
      -            -> Receipt Qty
      55880.26     -> Opening Value
      303          -> Opening Qty
  */


  if (tokens.length < 11) {
    return null;
  }


  // ====================================================
  // 3. TAKE NUMERIC COLUMNS FROM RIGHT
  // ====================================================

  const dumpQty =
    cleanNumber(tokens.pop());

  const closingValue =
    cleanNumber(tokens.pop());

  const closingQty =
    cleanNumber(tokens.pop());

  const issueValue =
    cleanNumber(tokens.pop());

  const issueQty =
    cleanNumber(tokens.pop());

  const receiptValue =
    cleanNumber(tokens.pop());

  const receiptQty =
    cleanNumber(tokens.pop());

  const openingValue =
    cleanNumber(tokens.pop());

  const openingQty =
    cleanNumber(tokens.pop());


  // ====================================================
  // 4. REMAINING TOKENS = DESCRIPTION + PACK SIZE
  // ====================================================

  if (tokens.length < 2) {
    return null;
  }


  /*
      Example remaining:

      [
        "VASU",
        "TRICHIP",
        "HFC",
        "OIL",
        "200ML"
      ]
  */


  const lastToken =
    tokens[tokens.length - 1];

  const secondLastToken =
    tokens.length >= 2
      ? tokens[tokens.length - 2]
      : "";


  let packSize = "";
  let descriptionTokens = [];


  // ====================================================
  // CASE 1
  // "200 GM"
  // "120 ML"
  // "640 ML"
  // ====================================================

  if (
    /^(GM|G|ML|MG|KG|L|TAB|TABLET|CAPSULES?)$/i
      .test(lastToken)
    &&
    /\d/.test(secondLastToken)
  ) {

    packSize =
      `${secondLastToken} ${lastToken}`;

    descriptionTokens =
      tokens.slice(0, -2);
  }


  // ====================================================
  // CASE 2
  // "200ML"
  // "100GM"
  // "25ML"
  // "5.5ML"
  // "10GMX24"
  // "G40ML"
  // ====================================================

  else if (
    /\d/.test(lastToken) &&
    /(GM|G|ML|MG|KG|L|TAB|TABLET|X\d+)$/i
      .test(lastToken)
  ) {

    packSize = lastToken;

    descriptionTokens =
      tokens.slice(0, -1);
  }


  // ====================================================
  // CASE 3
  // NUMERIC ONLY
  // "VASU ZEAL TABLET 1"
  // ====================================================

  else if (
    /^\d+(?:\.\d+)?$/.test(lastToken)
  ) {

    packSize = lastToken;

    descriptionTokens =
      tokens.slice(0, -1);
  }


  // ====================================================
  // FALLBACK
  // ====================================================

  else {

    packSize = lastToken;

    descriptionTokens =
      tokens.slice(0, -1);
  }


  const itemDescription =
    descriptionTokens.join(" ").trim();


  if (!itemDescription) {
    return null;
  }


  // ====================================================
  // RETURN FINAL OBJECT
  // ====================================================

  return {

    itemDescription,

    packSize,

    openingQty,

    openingValue,

    receiptQty,

    receiptValue,

    issueQty,

    issueValue,

    closingQty,

    closingValue,

    dumpQty,

    mExp
  };
}


// ======================================================
// PARSE COMPLETE OCR TEXT
// ======================================================

function parseInvoiceText(text) {

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
      parseInvoiceLine(line);

    if (row) {
      rows.push(row);
    }
  }


  return rows;
}


module.exports = {
  parseInvoiceText,
  parseInvoiceLine
};