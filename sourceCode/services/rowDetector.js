function groupWordsIntoRows(words) {

    const rows = [];

    const Y_TOLERANCE = 8;


    const sortedWords =
        [...words].sort(
            (a, b) => {

                if (
                    Math.abs(
                        a.top - b.top
                    ) <= Y_TOLERANCE
                ) {
                    return a.left - b.left;
                }

                return a.top - b.top;
            }
        );


    for (const word of sortedWords) {

        let matchedRow = null;


        for (const row of rows) {

            if (
                Math.abs(
                    row.top - word.top
                ) <= Y_TOLERANCE
            ) {

                matchedRow = row;
                break;
            }
        }


        if (matchedRow) {

            matchedRow.words.push(word);

        } else {

            rows.push({

                top: word.top,

                words: [word]

            });
        }
    }


    rows.sort(
        (a, b) =>
            a.top - b.top
    );


    return rows;
}


module.exports = {
    groupWordsIntoRows
};