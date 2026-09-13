const ExcelJS = require("exceljs");
const path = require("path");


/*
 * ==========================================
 * COMPUTER-GENERATED INVOICE EXCEL
 * ==========================================
 *
 * Keep this format separate from the
 * handwritten invoice format.
 */
async function createExcelFile(rows) {

    const workbook =
        new ExcelJS.Workbook();

    const worksheet =
        workbook.addWorksheet("Invoice");


    worksheet.columns = [

        {
            header: "ITEM DESCRIPTION",
            key: "itemDescription",
            width: 22
        },

        {
            header: "PACK SIZE",
            key: "packSize",
            width: 12
        },

        {
            header: "OPENING QTY",
            key: "openingQty",
            width: 12
        },

        {
            header: "OPENING VALUE",
            key: "openingValue",
            width: 14
        },

        {
            header: "RECEIPT QTY",
            key: "receiptQty",
            width: 12
        },

        {
            header: "RECEIPT VALUE",
            key: "receiptValue",
            width: 14
        },

        {
            header: "ISSUE QTY",
            key: "issueQty",
            width: 12
        },

        {
            header: "ISSUE VALUE",
            key: "issueValue",
            width: 14
        },

        {
            header: "CLOSING QTY",
            key: "closingQty",
            width: 12
        },

        {
            header: "CLOSING VALUE",
            key: "closingValue",
            width: 14
        },

        {
            header: "DUMP QTY",
            key: "dumpQty",
            width: 10
        },

        {
            header: "M.EXP",
            key: "mExp",
            width: 10
        }
    ];


    rows.forEach(row => {

        worksheet.addRow(row);

    });

    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.alignment = {
                horizontal: "center",
                vertical: "middle",
                wrapText: true
            };
        });
    });


    worksheet.getRow(1).font = {
        bold: true
    };


    worksheet.getRow(1).alignment = {
        horizontal: "center",
        vertical: "middle"
    };


    worksheet.views = [
        {
            state: "frozen",
            ySplit: 1
        }
    ];


    const filePath =
        path.join(
            __dirname,
            "..",
            "uploads",
            `invoice-${Date.now()}.xlsx`
        );


    await workbook.xlsx.writeFile(
        filePath
    );


    return filePath;
}


/*
 * ==========================================
 * HANDWRITTEN INVOICE EXCEL
 * ==========================================
 *
 * EXACT FORMAT:
 *
 * SR.NO | ITEM NAME | PACK SIZE | QUANTITY
 */
async function createHandwrittenExcelFile(
    rows
) {

    const workbook =
        new ExcelJS.Workbook();

    const worksheet =
        workbook.addWorksheet("Invoice");


    worksheet.columns = [

        {
            header: "SR.NO",
            key: "srNo",
            width: 9
        },

        {
            header: "ITEM NAME",
            key: "itemName",
            width: 28
        },

        {
            header: "PACK SIZE",
            key: "packSize",
            width: 12
        },

        {
            header: "QUANTITY",
            key: "quantity",
            width: 12
        }
    ];


    /*
     * Add every row dynamically.
     *
     * This supports any number of
     * handwritten invoice rows.
     */
    rows.forEach(row => {

        worksheet.addRow({

            srNo:
                row.srNo ?? "",

            itemName:
                row.itemName ?? "",

            packSize:
                row.packSize ?? "",

            quantity:
                row.quantity ?? ""
        });
    });

    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.alignment = {
                horizontal: "center",
                vertical: "middle",
                wrapText: true
            };
        });
    });


    /*
     * Header formatting.
     */
    worksheet.getRow(1).font = {
        bold: true
    };


    worksheet.getRow(1).alignment = {
        horizontal: "center",
        vertical: "middle"
    };


    /*
     * Alignment.
     */
    worksheet.getColumn("A").alignment = {
        horizontal: "center",
        vertical: "middle"
    };


    worksheet.getColumn("D").alignment = {
        horizontal: "center",
        vertical: "middle"
    };


    /*
     * Freeze header.
     */
    worksheet.views = [
        {
            state: "frozen",
            ySplit: 1
        }
    ];


    const filePath =
        path.join(
            __dirname,
            "..",
            "uploads",
            `handwritten-invoice-${Date.now()}.xlsx`
        );


    await workbook.xlsx.writeFile(
        filePath
    );


    return filePath;
}


module.exports = {
    createExcelFile,
    createHandwrittenExcelFile
};
