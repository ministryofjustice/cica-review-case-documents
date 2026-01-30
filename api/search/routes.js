import express from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * @module routes/searchRouter
 * @description
 * Express router that handles search requests for documents by keyword.
 *
 * Each request must include an `On-Behalf-Of` header indicating the case reference number.
 * The route supports pagination parameters for efficient search result retrieval.
 */

/**
 * GET /:query/:pageNumber/:itemsPerPage
 *
 * @name GET /:query/:pageNumber/:itemsPerPage
 * @function
 * @memberof module:routes/searchRouter
 * @description
 * Handles a search request for document contents by keyword.
 * Fetches paginated results from the search service and returns them
 * in a JSON:API-compatible resource object.
 *
 * The `id` field in the response is a **UUID v4 (RFC 4122)**, generated at request time
 * to uniquely identify this search result resource instance.
 *
 * @param {express.Request} req - The Express request object.
 * @param {string} req.query.query - The keyword to search for.
 * @param {string|number} req.query.pageNumber - The current page number (1-based).
 * @param {string|number} req.query.itemsPerPage - The number of results per page.
 * @param {express.Response} res - The Express response object.
 * @param {express.NextFunction} next - The Express next middleware function.
 *
 * @returns {Promise<void>} Responds with a JSON object containing the search results.
 *
 * @example
 * // Example request
 * GET /search/fracture?pageNumber=2&crn=25-711111
 * Header: On-Behalf-Of: 25-711111
 *
 * // Example response
 * {
 *   "data": {
 *     "type": "search-results",
 *     "id": "3983c5c8-10d8-4a84-97fd-e682081f242e", // UUID v4
 *     "attributes": {
 *       "query": "invoice",
 *       "results": [ ... ]
 *     }
 *   }
 * }
 */
export default function searchRouter({ searchService }) {
    const router = express.Router();

    router.get('/', async (req, res, next) => {
        try {
            const { query, pageNumber, itemsPerPage } = req.query;
            const searchResults = await searchService.getSearchResultsByKeyword(
                query,
                pageNumber,
                itemsPerPage,
                {
                    caseReferenceNumber: req.get('On-Behalf-Of'),
                    logger: req.log
                }
            );

            const searchResultsResource = {
                data: {
                    type: 'search-results',
                    id: uuidv4(),
                    attributes: {
                        query: query,
                        results: searchResults
                    }
                }
            };

            res.status(200).json(searchResultsResource);
        } catch (err) {
            next(err);
        }
    });

    return router;
}
