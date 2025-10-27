'use strict';

function base64encodeBoundingBoxData(arrayOfObjectsWithBoundingBoxProperty) {
    return arrayOfObjectsWithBoundingBoxProperty.map(objectWithBoundingBoxProperty => {
        if ('bounding_box' in objectWithBoundingBoxProperty) {
            // in n array for allowing multiple highlights in the template.
            const stringifiedBoundingBoxData = JSON.stringify([objectWithBoundingBoxProperty.bounding_box]);
            const base64Data = Buffer.from(stringifiedBoundingBoxData).toString('base64');
            objectWithBoundingBoxProperty.bounding_box_base64 = base64Data;
        }

        return objectWithBoundingBoxProperty;
    });
}

export default base64encodeBoundingBoxData;
