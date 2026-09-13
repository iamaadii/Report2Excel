const fs = require("fs");
const os = require("os");
const path = require("path");

const isVercelRuntime =
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV ||
    process.cwd().startsWith("/var/task");

const tempStorageDir = isVercelRuntime
    ? path.join(os.tmpdir(), "report2excel")
    : path.join(__dirname, "..", "uploads");

fs.mkdirSync(tempStorageDir, { recursive: true });

module.exports = tempStorageDir;
