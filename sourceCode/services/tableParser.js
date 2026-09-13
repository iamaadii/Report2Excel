const {
    columns
} = require("./invoiceConfig");


function parseTSV(tsv) {

    const lines =
        tsv.trim().split("\n");


    if (lines.length < 2) {
        return [];
    }


    const headers =
        lines[0].split("\t");


    const words = [];


    for (let i = 1; i < lines.length; i++) {

        const values =
            lines[i].split("\t");


        if (values.length !== headers.length) {
            continue;
        }


        const row = {};

        headers.forEach(
            (header, index) => {

                row[header] =
                    values[index];

            }
        );


        if (
            Number(row.conf) < 30 ||
            !row.text ||
            !row.text.trim()
        ) {
            continue;
        }


        words.push({

            text:
                row.text.trim(),

            left:
                Number(row.left),

            top:
                Number(row.top),

            width:
                Number(row.width),

            height:
                Number(row.height),

            confidence:
                Number(row.conf)

        });

    }


    return words;
}


module.exports = {
    parseTSV
};