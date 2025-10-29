# FIND

[![GitHub repo size](https://img.shields.io/github/repo-size/ministryofjustice/cica-review-case-documents)](https://github.com/ministryofjustice/cica-review-case-documents)
<!-- [![GitHub repo version](https://img.shields.io/github/package-json/v/ministryofjustice/cica-review-case-documents)](https://github.com/ministryofjustice/cica-review-case-documents/releases/latest) -->
[![GitHub repo npm version](https://img.shields.io/badge/npm_version->=10.8.2-blue)](https://github.com/ministryofjustice/cica-review-case-documents/blob/master/package.json#L5)
[![GitHub repo node version](https://img.shields.io/badge/node_version->=22.8.0-blue)](https://github.com/ministryofjustice/cica-review-case-documents/blob/master/package.json#L6)
[![GitHub repo contributors](https://img.shields.io/github/contributors/ministryofjustice/cica-review-case-documents)](https://github.com/ministryofjustice/cica-review-case-documents/graphs/contributors)
<!-- [![GitHub repo license](https://img.shields.io/github/package-json/license/ministryofjustice/cica-review-case-documents)](https://github.com/ministryofjustice/cica-review-case-documents/blob/master/LICENSE) -->

> [!NOTE]
> To set up the Opensearch database and client, please refer to the [airflow documentation](https://github.com/ministryofjustice/cica-review-case-documents-airflow?tab=readme-ov-file#cica-review-case-documents-airflow-ingestion-pipeline).

## Prerequisites

-   You have got this running: [airflow documentation](https://github.com/ministryofjustice/cica-review-case-documents-airflow?tab=readme-ov-file#cica-review-case-documents-airflow-ingestion-pipeline)
-   You have NPM `">=10.8.2"` installed globally.
-   You have Node `">=22.8.0"` installed globally.

## Installation

Run the install:
````
npm install
````

Add the environent variables to the `.env` file:
````properties 
APP_COOKIE_NAME=somerandomname
APP_COOKIE_SECRET=somereallylongstringthatwouldbetoohardtoguessandhasalotofcharactersinit123456789
APP_SEARCH_PAGINATION_ITEMS_PER_PAGE=5
APP_DOCUMENT_PAGINATION_ITEMS_PER_PAGE=1
APP_API_URL=http://localhost:5000/api
APP_DATABASE_URL=http://localhost:9200
OPENSEARCH_INDEX_CHUNKS_NAME=page_chunks
````

| Name                                   | Description                                       |
| -                                      | -                                                 |
| PORT                                   | Port that the application will run on             |
| APP_COOKIE_NAME                        | Name of the cookie that is stored client-side     |
| APP_COOKIE_SECRET                      | String used to encrypt the cookie                 |
| APP_SEARCH_PAGINATION_ITEMS_PER_PAGE   | Number of search results to be displayed per page |
| APP_API_URL                            | URL of the document API                           |
| OPENSEARCH_INDEX_CHUNKS_NAME           | Name of the index used for searches               |

## Running

Run the app:
````
npm run start:dev
````

Navigate to `http://localhost:5000/` in your browser to see the default page.

This web app is intended to be accessed via Tempus. Tempus has specific links that a user can click on to get to specific areas of this web app.

### Case Reference Number selection

In order for the user to be able to search, they need to first selected which case they are searching. This is done with a query parameter in the URL.

| Name                                   | Description                                                 |
| -                                      | -                                                           |
| caseReferenceNumber                    | The case that will be searched when a search is carried out |
| crn                                    | Alias of `caseReferenceNumber`                              |

#### Examples

http://localhost:5000/search?caseReferenceNumber=25-111111

This will select the case with the CRN `25-111111`. That should be reflected in the UI with `CRN: 25-111111` being displayed on the page. Now that the CRN is specified, you will now be able to search for a string within the documents attached to the case with the CRN `25-111111`.

http://localhost:5000/search/gabapentin%20600mg/1/5?caseReferenceNumber=25-111111

Does the same s th above URL, but also performs a search.

http://localhost:5000/search/the?caseReferenceNumber=12-121212

This CRN does not exist, so it will not return any results.

## URLs

### Search

URL shape: /search/{query}/{pageNumber}/{itemsPerPage}

| Name                                   | Description                                                 |
| -                                      | -                                                           |
| query                                  | Space-delimited keywords or sentence to search for          |
| pageNumber                             | Page number of the paginated results                        |
| itemsPerPage                           | The number of items to show per page of results             |

## Test

This app uses the [NodeJS test runner](https://nodejs.org/api/test.html)

````
npm test
````


## CSS

This project uses [Sass](https://sass-lang.com/) for styling.

Build CSS:
````
npm run sass
````

Entry point:
````
./src/sass/all.scss
````

Dist:
````
./public/stylesheets/all.css
````

## JS

This project uses [Babel](https://babeljs.io/) and [Webpack](https://webpack.js.org/) for transpilation and bundling of JS.

Build JS for debugging: 
````
npm run build:dev
````

Build JS for production: 
````
npm run build
````

Entry point:
````
./src/js/scripts.js
````

Dist:
````
./public/js/bundle.js
````