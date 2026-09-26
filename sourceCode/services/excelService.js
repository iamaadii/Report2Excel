const ExcelJS = require("exceljs");
const path = require("path");
const tempStorageDir = require("./tempStorage");


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

    // Light border definition
    const lightBorder = {
        top: { style: "thin", color: { argb: "FFE2E8E5" } },
        left: { style: "thin", color: { argb: "FFE2E8E5" } },
        bottom: { style: "thin", color: { argb: "FFE2E8E5" } },
        right: { style: "thin", color: { argb: "FFE2E8E5" } }
    };

    // Header styling - Vasu Corporate Emerald Green (#1D8A70) with white bold text
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: "FFFFFFFF" }
    };
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1D8A70" }
    };
    headerRow.alignment = {
        horizontal: "center",
        vertical: "middle"
    };

    // Format all cells
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            row.height = 22;
        }
        row.eachCell((cell, colNumber) => {
            cell.border = lightBorder;
            if (rowNumber > 1) {
                if (colNumber === 1) {
                    // Item Description: left-aligned
                    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
                } else if ([4, 6, 8, 10].includes(colNumber)) {
                    // Values: right-aligned
                    cell.alignment = { horizontal: "right", vertical: "middle" };
                } else {
                    // Quantities & codes: centered
                    cell.alignment = { horizontal: "center", vertical: "middle" };
                }
            }
        });
    });

    // Auto-fit column widths
    worksheet.columns.forEach((column, index) => {
        let maxLen = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
            const val = cell.value !== null && cell.value !== undefined ? String(cell.value) : "";
            if (val.length > maxLen) maxLen = val.length;
        });
        const minWidth = index === 0 ? 30 : 12;
        column.width = Math.max(maxLen + 4, minWidth);
    });

    worksheet.views = [
        {
            state: "frozen",
            ySplit: 1
        }
    ];

    const filePath = path.join(tempStorageDir, `invoice-${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
}

/*
 * ==========================================
 * HANDWRITTEN INVOICE EXCEL
 * ==========================================
 *
 * EXACT FORMAT:
 * SR.NO | ITEM NAME | PACK SIZE | QUANTITY
 */
async function createHandwrittenExcelFile(rows) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Invoice");

    worksheet.columns = [
        { header: "SR.NO", key: "srNo", width: 10 },
        { header: "ITEM NAME", key: "itemName", width: 34 },
        { header: "PACK SIZE", key: "packSize", width: 14 },
        { header: "QUANTITY", key: "quantity", width: 16 }
    ];

    // Add product rows
    rows.forEach(row => {
        worksheet.addRow({
            srNo: row.srNo ?? "",
            itemName: row.itemName ?? "",
            packSize: row.packSize ?? "",
            quantity: typeof row.quantity === "number" ? row.quantity : (parseInt(row.quantity, 10) || row.quantity || "")
        });
    });

    // Calculate total quantity for summary row
    const totalQty = rows.reduce((acc, r) => acc + (parseInt(r.quantity, 10) || 0), 0);
    const totalRow = worksheet.addRow({
        srNo: "",
        itemName: `TOTAL ITEMS (${rows.length})`,
        packSize: "",
        quantity: totalQty
    });

    // Light border definition
    const lightBorder = {
        top: { style: "thin", color: { argb: "FFE2E8E5" } },
        left: { style: "thin", color: { argb: "FFE2E8E5" } },
        bottom: { style: "thin", color: { argb: "FFE2E8E5" } },
        right: { style: "thin", color: { argb: "FFE2E8E5" } }
    };

    // Header styling - Vasu Corporate Dark Emerald Green (#1D8A70) with white bold text
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: "FFFFFFFF" }
    };
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1D8A70" }
    };

    // Align headers
    headerRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    headerRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
    headerRow.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
    headerRow.getCell(4).alignment = { horizontal: "right", vertical: "middle" };

    // Format data rows
    const totalRowNum = rows.length + 2;
    worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
            cell.border = lightBorder;
        });

        if (rowNumber > 1 && rowNumber < totalRowNum) {
            row.height = 22;

            // Col 1 (SR.NO): Center
            const cell1 = row.getCell(1);
            cell1.alignment = { horizontal: "center", vertical: "middle" };
            cell1.font = { name: "Calibri", size: 10, color: { argb: "FF64748B" } };

            // Col 2 (ITEM NAME): Left, Semi-bold
            const cell2 = row.getCell(2);
            cell2.alignment = { horizontal: "left", vertical: "middle" };
            cell2.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: "FF111827" } };

            // Col 3 (PACK SIZE): Center
            const cell3 = row.getCell(3);
            cell3.alignment = { horizontal: "center", vertical: "middle" };
            cell3.font = { name: "Calibri", size: 10, color: { argb: "FF334155" } };

            // Col 4 (QUANTITY): Right, Bold
            const cell4 = row.getCell(4);
            cell4.alignment = { horizontal: "right", vertical: "middle" };
            cell4.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: "FF0F172A" } };
            if (typeof cell4.value === "number") {
                cell4.numFmt = "#,##0";
            }
        }
    });

    // Format Total Row at bottom
    totalRow.height = 25;
    totalRow.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF0F172A" } };
    totalRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0FDF4" }
    };
    totalRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
    totalRow.getCell(4).alignment = { horizontal: "right", vertical: "middle" };
    if (typeof totalRow.getCell(4).value === "number") {
        totalRow.getCell(4).numFmt = "#,##0";
    }

    // Auto-fit column widths
    worksheet.columns.forEach((column, index) => {
        let maxLen = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
            const val = cell.value !== null && cell.value !== undefined ? String(cell.value) : "";
            if (val.length > maxLen) maxLen = val.length;
        });
        const minWidths = [10, 32, 14, 16];
        column.width = Math.max(maxLen + 4, minWidths[index] || 12);
    });

    // Freeze header
    worksheet.views = [
        {
            state: "frozen",
            ySplit: 1
        }
    ];

    const filePath = path.join(tempStorageDir, `handwritten-invoice-${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
}


module.exports = {
    createExcelFile,
    createHandwrittenExcelFile
};
