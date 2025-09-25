'use strict';

// const DUMMY_DOCUMENT_STORE = {
//     data: [
//         {
//             document_id: 'askjdc892y4824',
//             document_title: 'TC19 - Additional information request',
//             received: '2024-03-24T22:03:21+00:00',
//             pagesCount: 7,
//             pages_raw: [
//                 {
//                     pageId: 1,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 2,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 3,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 4,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 5,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 6,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 7,
//                     image: 'https://picsum.photos/500/600'
//                 },
//             ],
//             pages_processed: [
//                 {
//                     pageId: 1,
//                     text: 'Lorem ipsum 11111111111111111111111111'
//                 },
//                 {
//                     pageId: 2,
//                     text: 'Lorem ipsum 22222222222222222222222222'
//                 },
//                 {
//                     pageId: 3,
//                     text: 'Lorem ipsum 33333333333333333333333333'
//                 },
//                 {
//                     pageId: 4,
//                     text: 'Lorem ipsum 44444444444444444444444444'
//                 },
//                 {
//                     pageId: 5,
//                     text: 'Lorem ipsum 55555555555555555555555555'
//                 },
//                 {
//                     pageId: 6,
//                     text: 'Lorem ipsum 66666666666666666666666666'
//                 },
//                 {
//                     pageId: 7,
//                     text: 'Lorem ipsum 77777777777777777777777777'
//                 },
//             ]
//         },
//         {
//             document_id: 'sdlkfjwr039q2q304237',
//             document_title: 'TX01 - Lorem ipsum',
//             received: '2024-03-10T22:03:21+00:00',
//             pagesCount: 7,
//             pages_raw: [
//                 {
//                     pageId: 1,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 2,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 3,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 4,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 5,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 6,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 7,
//                     image: 'https://picsum.photos/500/600'
//                 },
//             ],
//             pages_processed: [
//                 {
//                     pageId: 1,
//                     text: 'Lorem ipsum 11111111111111111111111111'
//                 },
//                 {
//                     pageId: 2,
//                     text: 'Lorem ipsum 22222222222222222222222222'
//                 },
//                 {
//                     pageId: 3,
//                     text: 'Lorem ipsum 33333333333333333333333333'
//                 },
//                 {
//                     pageId: 4,
//                     text: 'Lorem ipsum 44444444444444444444444444'
//                 },
//                 {
//                     pageId: 5,
//                     text: 'Lorem ipsum 55555555555555555555555555'
//                 },
//                 {
//                     pageId: 6,
//                     text: 'Lorem ipsum 66666666666666666666666666'
//                 },
//                 {
//                     pageId: 7,
//                     text: 'Lorem ipsum 77777777777777777777777777'
//                 },
//             ]
//         },
//         {
//             document_id: 'cnow9v4y38312391',
//             document_title: 'AR93 - Something else document',
//             received: '2024-02-06T22:03:21+00:00',
//             pagesCount: 7,
//             pages_raw: [
//                 {
//                     pageId: 1,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 2,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 3,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 4,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 5,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 6,
//                     image: 'https://picsum.photos/500/600'
//                 },
//                 {
//                     pageId: 7,
//                     image: 'https://picsum.photos/500/600'
//                 },
//             ],
//             pages_processed: [
//                 {
//                     pageId: 1,
//                     text: 'Lorem ipsum 11111111111111111111111111'
//                 },
//                 {
//                     pageId: 2,
//                     text: 'Lorem ipsum 22222222222222222222222222'
//                 },
//                 {
//                     pageId: 3,
//                     text: 'Lorem ipsum 33333333333333333333333333'
//                 },
//                 {
//                     pageId: 4,
//                     text: 'Lorem ipsum 44444444444444444444444444'
//                 },
//                 {
//                     pageId: 5,
//                     text: 'Lorem ipsum 55555555555555555555555555'
//                 },
//                 {
//                     pageId: 6,
//                     text: 'Lorem ipsum 66666666666666666666666666'
//                 },
//                 {
//                     pageId: 7,
//                     text: 'Lorem ipsum 77777777777777777777777777'
//                 },
//             ]
//         }
//     ]
// };

// function createDocumentService() {
//     function getAllDocuments() {
//         const documentsResource = DUMMY_DOCUMENT_STORE;

//         return documentsResource;
//     }
//     function getDocumentPageByDocumentId(documentId, pageId) {
//         let documentResource = JSON.parse(JSON.stringify(DUMMY_DOCUMENT_STORE));
//         documentResource = documentResource.data.filter(document => document.document_id === documentId)[0];
//         documentResource.pages_raw = documentResource.pages_raw.filter(pageRaw => pageRaw.pageId === pageId);
//         documentResource.pages_processed = documentResource.pages_processed.filter(pageProcessed => pageProcessed.pageId === pageId);
//         return documentResource;
//     }

//     return Object.freeze({
//         getAllDocuments,
//         getDocumentPageByDocumentId
//     });
// }

// export default createDocumentService;


'use strict';

import createDocumentDAL from '../document/document-dal.js';

function createDocumentService() {
    const db = createDocumentDAL();

    async function getAllDocuments(caseReferenceNumber) { // explicitly pass this in from the session data.
        return db.getAllDocuments(caseReferenceNumber);
    }

    async function getDocument(documentId) {
        return db.getDocument(documentId);
    }

    return Object.freeze({
        getAllDocuments,
        getDocument
    });
}

export default createDocumentService;
