const express =
    require("express");

const upload =
    require(
        "../middleware/uploadMiddleware"
    );

const {
    processInvoice,
    downloadExcel
} =
    require(
        "../controllers/invoiceController"
    );


const router =
    express.Router();


/*
 * Upload + process invoice
 */

router.post(

    "/process",

    upload.single("invoice"),

    processInvoice

);


/*
 * Generate Excel from
 * edited preview data
 */

router.post(

    "/download",

    downloadExcel

);


module.exports =
    router;