function parseTSV(tsv) {
  if (!tsv) {
    console.log("WARNING: TSV data is empty.");
    return [];
  }

  const lines = tsv.split("\n");


    const words = [];


    /*
     * TSV columns:
     *
     * level
     * page_num
     * block_num
     * par_num
     * line_num
     * word_num
     * left
     * top
     * width
     * height
     * conf
     * text
     */

    for (
        let i = 1;
        i < lines.length;
        i++
    ) {

        const line =
            lines[i];


        const parts =
            line.split("\t");


        if (
            parts.length < 12
        ) {
            continue;
        }


        const text =
            parts[11]
                .trim();


        if (!text) {
            continue;
        }


        const confidence =
            Number(
                parts[10]
            );


        if (
            confidence < 20
        ) {
            continue;
        }


        words.push({

            text,

            left:
                Number(parts[6]),

            top:
                Number(parts[7]),

            width:
                Number(parts[8]),

            height:
                Number(parts[9]),

            confidence

        });

    }


    return words;
}


/*
 * Group words having approximately
 * the same Y position.
 */

function groupWordsIntoRows(
    words
) {

    const sorted =
        [...words].sort(
            (a, b) => {

                if (
                    Math.abs(
                        a.top - b.top
                    ) < 10
                ) {

                    return (
                        a.left -
                        b.left
                    );

                }


                return (
                    a.top -
                    b.top
                );

            }
        );


    const rows = [];


    for (
        const word
        of sorted
    ) {

        let matchedRow =
            null;


        for (
            const row
            of rows
        ) {

            if (
                Math.abs(
                    row.top -
                    word.top
                ) <= 10
            ) {

                matchedRow =
                    row;

                break;

            }

        }


        if (!matchedRow) {

            matchedRow = {

                top:
                    word.top,

                words: []

            };


            rows.push(
                matchedRow
            );

        }


        matchedRow.words.push(
            word
        );

    }


    /*
     * Sort rows vertically
     */

    rows.sort(
        (a, b) =>
            a.top - b.top
    );


    /*
     * Sort words horizontally
     */

    rows.forEach(
        row => {

            row.words.sort(
                (a, b) =>
                    a.left - b.left
            );

        }
    );


    return rows;
}


module.exports = {

    parseTSV,

    groupWordsIntoRows

};