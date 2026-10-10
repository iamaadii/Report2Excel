const express = require("express");

const upload = require("../middleware/uploadMiddleware");

const {
    processReport,
    downloadExcel
} = require("../controllers/reportController");

const router = express.Router();

/*
 * Upload + process report
 */
router.post(
    "/process",
    (req, res, next) => {
        upload.single("report")(req, res, (err) => {
            if (err) {
                if (err.code === "LIMIT_FILE_SIZE") {
                    return res.status(400).json({
                        success: false,
                        message: "File exceeds the 20MB maximum size limit.",
                        category: "file_size",
                        tip: "Please compress the document or upload a smaller file."
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: err.message || "File upload failed.",
                    category: "upload_error",
                    tip: "Make sure you are uploading a valid PDF, JPG, JPEG, or PNG."
                });
            }
            next();
        });
    },
    processReport
);

/*
 * Generate Excel from edited preview data
 */
router.post(
    "/download",
    downloadExcel
);

module.exports = router;
