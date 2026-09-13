const multer = require("multer");
const path = require("path");
const fs = require("fs");


/*
 * Make sure uploads folder exists
 */

const uploadDir =
    path.join(
        __dirname,
        "..",
        "uploads"
    );


if (!fs.existsSync(uploadDir)) {

    fs.mkdirSync(
        uploadDir,
        {
            recursive: true
        }
    );

}


/*
 * Storage configuration
 */

const storage =
    multer.diskStorage({

        destination:
            function (
                req,
                file,
                cb
            ) {

                cb(
                    null,
                    uploadDir
                );

            },


        filename:
            function (
                req,
                file,
                cb
            ) {

                const extension =
                    path.extname(
                        file.originalname
                    );


                const fileName =
                    `invoice-${Date.now()}${extension}`;


                cb(
                    null,
                    fileName
                );

            }

    });


/*
 * Allowed files
 */

function fileFilter(
    req,
    file,
    cb
) {

    const allowedTypes = [

        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/pdf"

    ];


    if (
        allowedTypes.includes(
            file.mimetype
        )
    ) {

        cb(
            null,
            true
        );

    } else {

        cb(
            new Error(
                "Only JPG, JPEG, PNG and PDF files are allowed."
            ),
            false
        );

    }

}


/*
 * Multer upload
 */

const upload =
    multer({

        storage,

        fileFilter,

        limits: {

            fileSize:
                20 * 1024 * 1024

        }

    });


module.exports = upload;