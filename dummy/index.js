const DUMMY_DOCUMENTS_CHUNKS_BY_KEYWORD = [
    {
      chunk_id: 'doc-abc-123_p2_c0',
      ingested_doc_id: 'doc-abc-123',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'medical_record_18-08-2925.pdf',
      page_count: 12,
      page_number: 4,
      chunk_index: 'p2_c0',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.008,
      bounding_box: { top: 0.472, left: 0.581, width: 0.328, height: 0.344 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.755, left: 0.801, width: 0.153, height: 0.17 }
    },
    {
      chunk_id: 'doc-powewh-32903721_p9_h6',
      ingested_doc_id: 'doc-powewh-32903721',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'doc-powewh-32903721_p9_h6.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.087, left: 0.67, width: 0.126, height: 0.338 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.384, left: 0.362, width: 0.409, height: 0.128 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.402, left: 0.744, width: 0.095, height: 0.297 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.58, left: 0.442, width: 0.303, height: 0.178 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.071, left: 0.186, width: 0.779, height: 0.302 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.855, left: 0.585, width: 0.275, height: 0.06 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.116, left: 0.884, width: 0.059, height: 0.52 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.767, left: 0.124, width: 0.738, height: 0.195 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.125, left: 0.862, width: 0.074, height: 0.394 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.752, left: 0.347, width: 0.169, height: 0.161 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.648, left: 0.466, width: 0.407, height: 0.326 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.405, left: 0.868, width: 0.118, height: 0.498 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.748, left: 0.353, width: 0.093, height: 0.102 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.5, left: 0.889, width: 0.059, height: 0.133 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.45, left: 0.265, width: 0.595, height: 0.323 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.567, left: 0.173, width: 0.361, height: 0.274 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.184, left: 0.259, width: 0.343, height: 0.43 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.034, left: 0.23, width: 0.491, height: 0.112 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.159, left: 0.234, width: 0.684, height: 0.431 }
    },
    {
      chunk_id: 'doc-abc-456_p9_h6',
      ingested_doc_id: 'doc-abc-456',
      chunk_text: 'Text for an imaginary medical report for document creation and retrieval purposes.',
      source_file_name: 'loreum_ipsum_18-08-2925.pdf',
      page_count: 6,
      page_number: 2,
      chunk_index: 'p9_h6',
      chunk_type: 'LAYOUT_HEADER',
      confidence: 0.052,
      bounding_box: { top: 0.159, left: 0.718, width: 0.176, height: 0.733 }
    }
  ];

const DUMMY_DOCUMENTS = [
    {
        "document_id": "doc-abc-123",
        "case_ref": "23/123456",
        "summary": "This document appears to be a medical report detailing injuries, treatment, and recovery",
        "received_date": "2025-08-18 11:55:00",
        "source_file_name": "medical_record_18-08-2025.pdf",
        "s3_pages_image": [
            {
                pageId: 1,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 2,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 3,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 4,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 5,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 6,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 7,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 8,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 9,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 10,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 11,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 12,
                image: 'https://picsum.photos/500/600'
            }
        ],
        "s3_pages_text": [
            {
                pageId: 1,
                text: 'Lorem ipsum 11111111111111111111111111'
            },
            {
                pageId: 2,
                text: 'Lorem ipsum 22222222222222222222222222'
            },
            {
                pageId: 3,
                text: 'Lorem ipsum 33333333333333333333333333'
            },
            {
                pageId: 4,
                text: 'Lorem ipsum 44444444444444444444444444'
            },
            {
                pageId: 5,
                text: 'Lorem ipsum 55555555555555555555555555'
            },
            {
                pageId: 6,
                text: 'Lorem ipsum 66666666666666666666666666'
            },
            {
                pageId: 7,
                text: 'Lorem ipsum 77777777777777777777777777'
            },
            {
                pageId: 8,
                text: 'Lorem ipsum 88888888888888888888888888'
            },
            {
                pageId: 9,
                text: 'Lorem ipsum 99999999999999999999999999'
            },
            {
                pageId: 10,
                text: 'Lorem ipsum 10-10-10-10-10-10-10-10-10'
            },
            {
                pageId: 1,
                text: 'Lorem ipsum 11-11-11-11-11-11-11-11-11'
            },
            {
                pageId: 12,
                text: 'Lorem ipsum 12-12-12-12-12-12-12-12-12'
            }
        ],
        "correspondence_type": "TC19",
        "page_count": 12
    },
    {
        "document_id": "doc-abc-456",
        "case_ref": "23/987654",
        "summary": "This document appears to be a medical report detailing injuries, treatment, and recovery",
        "received_date": "2025-08-18 11:55:00",
        "source_file_name": "police_letter_26-9-2025.pdf",
        "s3_pages_image": [
            {
                pageId: 1,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 2,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 3,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 4,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 5,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 6,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 7,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 8,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 9,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 10,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 11,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 12,
                image: 'https://picsum.photos/500/600'
            }
        ],
        "s3_pages_text": [
            {
                pageId: 1,
                text: 'Lorem ipsum 11111111111111111111111111'
            },
            {
                pageId: 2,
                text: 'Lorem ipsum 22222222222222222222222222'
            },
            {
                pageId: 3,
                text: 'Lorem ipsum 33333333333333333333333333'
            },
            {
                pageId: 4,
                text: 'Lorem ipsum 44444444444444444444444444'
            },
            {
                pageId: 5,
                text: 'Lorem ipsum 55555555555555555555555555'
            },
            {
                pageId: 6,
                text: 'Lorem ipsum 66666666666666666666666666'
            },
            {
                pageId: 7,
                text: 'Lorem ipsum 77777777777777777777777777'
            },
            {
                pageId: 8,
                text: 'Lorem ipsum 88888888888888888888888888'
            },
            {
                pageId: 9,
                text: 'Lorem ipsum 99999999999999999999999999'
            },
            {
                pageId: 10,
                text: 'Lorem ipsum 10-10-10-10-10-10-10-10-10'
            },
            {
                pageId: 1,
                text: 'Lorem ipsum 11-11-11-11-11-11-11-11-11'
            },
            {
                pageId: 12,
                text: 'Lorem ipsum 12-12-12-12-12-12-12-12-12'
            }
        ],
        "correspondence_type": "TC19",
        "page_count": 12
    },
    {
        "document_id": "doc-powewh-32903721",
        "case_ref": "23/123456",
        "summary": "This document appears to be a medical report detailing injuries, treatment, and recovery",
        "received_date": "2025-08-18 11:55:00",
        "source_file_name": "some_letter_18-08-2025.pdf",
        "s3_pages_image": [
            {
                pageId: 1,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 2,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 3,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 4,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 5,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 6,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 7,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 8,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 9,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 10,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 11,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 12,
                image: 'https://picsum.photos/500/600'
            }
        ],
        "s3_pages_text": [
            {
                pageId: 1,
                text: 'Lorem ipsum 11111111111111111111111111'
            },
            {
                pageId: 2,
                text: 'Lorem ipsum 22222222222222222222222222'
            },
            {
                pageId: 3,
                text: 'Lorem ipsum 33333333333333333333333333'
            },
            {
                pageId: 4,
                text: 'Lorem ipsum 44444444444444444444444444'
            },
            {
                pageId: 5,
                text: 'Lorem ipsum 55555555555555555555555555'
            },
            {
                pageId: 6,
                text: 'Lorem ipsum 66666666666666666666666666'
            },
            {
                pageId: 7,
                text: 'Lorem ipsum 77777777777777777777777777'
            },
            {
                pageId: 8,
                text: 'Lorem ipsum 88888888888888888888888888'
            },
            {
                pageId: 9,
                text: 'Lorem ipsum 99999999999999999999999999'
            },
            {
                pageId: 10,
                text: 'Lorem ipsum 10-10-10-10-10-10-10-10-10'
            },
            {
                pageId: 1,
                text: 'Lorem ipsum 11-11-11-11-11-11-11-11-11'
            },
            {
                pageId: 12,
                text: 'Lorem ipsum 12-12-12-12-12-12-12-12-12'
            }
        ],
        "correspondence_type": "TX01",
        "page_count": 12
    },
    {
        "document_id": "doc-ajbfa-0097432",
        "case_ref": "23/987654",
        "summary": "This document appears to be a medical report detailing injuries, treatment, and recovery",
        "received_date": "2025-08-18 11:55:00",
        "source_file_name": "correspondence_26-9-2025.pdf",
        "s3_pages_image": [
            {
                pageId: 1,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 2,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 3,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 4,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 5,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 6,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 7,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 8,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 9,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 10,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 11,
                image: 'https://picsum.photos/500/600'
            },
            {
                pageId: 12,
                image: 'https://picsum.photos/500/600'
            }
        ],
        "s3_pages_text": [
            {
                pageId: 1,
                text: 'Lorem ipsum 11111111111111111111111111'
            },
            {
                pageId: 2,
                text: 'Lorem ipsum 22222222222222222222222222'
            },
            {
                pageId: 3,
                text: 'Lorem ipsum 33333333333333333333333333'
            },
            {
                pageId: 4,
                text: 'Lorem ipsum 44444444444444444444444444'
            },
            {
                pageId: 5,
                text: 'Lorem ipsum 55555555555555555555555555'
            },
            {
                pageId: 6,
                text: 'Lorem ipsum 66666666666666666666666666'
            },
            {
                pageId: 7,
                text: 'Lorem ipsum 77777777777777777777777777'
            },
            {
                pageId: 8,
                text: 'Lorem ipsum 88888888888888888888888888'
            },
            {
                pageId: 9,
                text: 'Lorem ipsum 99999999999999999999999999'
            },
            {
                pageId: 10,
                text: 'Lorem ipsum 10-10-10-10-10-10-10-10-10'
            },
            {
                pageId: 1,
                text: 'Lorem ipsum 11-11-11-11-11-11-11-11-11'
            },
            {
                pageId: 12,
                text: 'Lorem ipsum 12-12-12-12-12-12-12-12-12'
            }
        ],
        "correspondence_type": "AB12",
        "page_count": 12
    }
];

export {
    DUMMY_DOCUMENTS_CHUNKS_BY_KEYWORD,
    DUMMY_DOCUMENTS
};