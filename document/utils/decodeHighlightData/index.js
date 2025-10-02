'use strict';

function decodeHighlightData(base64EncodedHighlightDataArrayOfObjects) {
    const validObjectProperties = ['top', 'left', 'width', 'height'];
    const defaultObjectKeyValues = {top: 0,left: 0,width: 0,height: 0};

    const decodedHighlightDataArrayOfObjects = Buffer.from(base64EncodedHighlightDataArrayOfObjects, 'base64').toString('ascii');
    const parsedArrayOfObjects = JSON.parse(decodedHighlightDataArrayOfObjects);

    if (!Array.isArray(parsedArrayOfObjects)) {
        return [defaultObjectKeyValues];
    }

    const sanitisedHighlightDataObject = parsedArrayOfObjects.map(hightlightDataObject => {
        const containsInvalidKeysOrValues = Object.entries(hightlightDataObject).some(keyValueArray => {
            if (!validObjectProperties.includes(keyValueArray[0]) || isNaN(parseFloat(keyValueArray[1]))) {
                return true;
            }
            return false;
        });
    
        if (containsInvalidKeysOrValues) {
            return defaultObjectKeyValues;
        }
        return hightlightDataObject;
    });

    return sanitisedHighlightDataObject;
}

export default decodeHighlightData;
