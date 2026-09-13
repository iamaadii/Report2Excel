function validateRows(rows) {

    const errors = [];

    rows.forEach(
        (row, index) => {

            const rowNumber =
                index + 1;


            // Quantity × rate is not available
            // because this report gives values directly,
            // so we mainly check numeric fields.

            const numericFields = [

                "openingQty",
                "openingValue",

                "receiptQty",
                "receiptValue",

                "issueQty",
                "issueValue",

                "closingQty",
                "closingValue",

                "dumpQty"

            ];


            for (
                const field
                of numericFields
            ) {

                const value =
                    row[field];


                if (
                    value !== "" &&
                    typeof value !== "number"
                ) {

                    errors.push(
                        `Row ${rowNumber}: invalid ${field}`
                    );
                }
            }


            // M. Exp should look like MM/YY
            if (
                row.mExp &&
                !/^\d{1,2}\/\d{2}$/.test(
                    row.mExp
                )
            ) {

                errors.push(
                    `Row ${rowNumber}: invalid M. Exp`
                );
            }
        }
    );


    return {

        valid:
            errors.length === 0,

        errors

    };
}


module.exports = {
    validateRows
};