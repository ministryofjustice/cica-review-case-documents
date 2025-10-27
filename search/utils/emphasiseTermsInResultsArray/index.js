'use strict';

function emphasiseTermsInResultsArray(arrayOfSearchResults, termsToEmphasise, resultWrapper = ['<strong>', '</strong>']) {
    return arrayOfSearchResults.map(searchResultsObject => {
        const searchResultsItem = searchResultsObject;
        if (searchResultsItem?._source?.chunk_text) {
            for (let i=0;i<termsToEmphasise.length;i++) {
                let matchFound = false;
                const regexTerm = new RegExp(termsToEmphasise[i], 'gi');
                searchResultsItem._source.chunk_text = searchResultsItem?._source?.chunk_text.replaceAll(regexTerm, (match) => {
                    matchFound = true;
                    return `${resultWrapper[0]}${match}${resultWrapper[1]}`;
                });
                // Only do this if an exact match is not found within a given string, and
                // can't be emphasised. The reason that the below is not the default behaviour
                // is because we want to prioritise the emphasising of the exact term before
                // any of the individual words in the term. This will make the results as
                // relevant as possible, and  make it less crowded.
                if (matchFound === false) {
                    const individualTermsWords = termsToEmphasise[i].split(' ');
                    if (individualTermsWords.length > 1) {
                        const regexTermIndividualWords = new RegExp(individualTermsWords.join('|'), 'gi');
                        searchResultsItem._source.chunk_text = searchResultsItem?._source?.chunk_text.replaceAll(regexTermIndividualWords, (match) => {
                            return `${resultWrapper[0]}${match}${resultWrapper[1]}`;
                        });
                    }
                }
            }
        }

        return searchResultsItem;
    });
}

export default emphasiseTermsInResultsArray;
