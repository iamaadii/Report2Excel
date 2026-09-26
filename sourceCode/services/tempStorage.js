const fs = require("fs");
const os = require("os");
const path = require("path");

let tempStorageDir;
try {
    const isServerless =
        process.env.VERCEL ||
        process.env.VERCEL_ENV ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        (process.cwd && process.cwd().startsWith("/var/task"));

    if (isServerless) {
        tempStorageDir = path.join(os.tmpdir(), "report2excel");
    } else {
        tempStorageDir = path.join(__dirname, "..", "uploads");
    }
    fs.mkdirSync(tempStorageDir, { recursive: true });
} catch (err) {
    // Unconditional safe fallback to OS tmp directory for read-only serverless filesystems
    tempStorageDir = path.join(os.tmpdir(), "report2excel");
    try {
        fs.mkdirSync(tempStorageDir, { recursive: true });
    } catch (_) {}
}

module.exports = tempStorageDir;
