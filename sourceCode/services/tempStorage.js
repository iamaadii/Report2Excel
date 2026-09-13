const fs = require("fs");
const os = require("os");
const path = require("path");

const tempStorageDir = process.env.VERCEL
    ? path.join(os.tmpdir(), "report2excel")
    : path.join(__dirname, "..", "uploads");

fs.mkdirSync(tempStorageDir, { recursive: true });

module.exports = tempStorageDir;
