#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Client } from '@opensearch-project/opensearch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolvePath = (relativePath) => path.resolve(__dirname, relativePath);

const DEFAULT_OPENSEARCH_URL = 'http://localhost:9200';
const DEFAULT_OPENSEARCH_INDEX = 'page_chunks';

const HYBRID_SEARCH_QUERIES = [
    'assault',
    'brain injury',
    'Mental Injury',
    'nerve damage',
    'skull fracture',
    'coma',
    'CBT',
    'neuropsychologist',
    'CMHT report',
    'Physiotheraphy treatment',
    'brain injury after assault',
    'nerve damage symptoms',
    'skull fracture diagnosis',
    'mental health treatment CBT',
    'neuropsychologist report',
    'injuries reported after assault',
    'treatment after brain injury',
    'repeat symptoms after incident',
    'Did the applicant suffer brain damage?',
    'Was the applicant in a coma?',
    'What injuries did the applicant have?',
    'What treatment was provided after the assault?',
    'Is there evidence of mental health issues?',
    'Was a neuropsychologist involved?',
    'Did the applicant have depressive episodes?',
    'Did the applicant have suicidal thoughts?',
    'Did the applicant self harm?'
];

const HYBRID_SEARCH_DATE_QUERIES = ['28 Jan 2018'];
const HYBRID_SEARCH_TWO_PART_DATE_QUERIES = ['coma January 2018', 'symptoms after February 2018'];

const HYBRID_SEARCH_THREE_PART_DATE_QUERIES = ['What happened on 28 Jan 2018?'];

const HYBRID_SEARCH_CONFIG = {
    baseDslPath: resolvePath('./query_dsls/hybrid_base_search_query_dsl.json'),
    pageDslPath: resolvePath('./query_dsls/hybrid_page_search_query_dsl.json'),
    queries: HYBRID_SEARCH_QUERIES
};

const HYBRID_SEARCH_DATE_CONFIG = {
    baseDslPath: resolvePath('./query_dsls/hybrid_base_search_date_query_dsl.json'),
    pageDslPath: resolvePath('./query_dsls/hybrid_page_search_date_query_dsl.json'),
    queries: HYBRID_SEARCH_DATE_QUERIES
};

const HYBRID_SEARCH_TWO_PART_DATE_CONFIG = {
    baseDslPath: resolvePath('./query_dsls/hybrid_base_search_two_part_date_query_dsl.json'),
    pageDslPath: resolvePath('./query_dsls/hybrid_page_search_two_part_date_query_dsl.json'),
    queries: HYBRID_SEARCH_TWO_PART_DATE_QUERIES
};

const HYBRID_SEARCH_THREE_PART_DATE_CONFIG = {
    baseDslPath: resolvePath('./query_dsls/hybrid_base_search_three_part_date_query_dsl.json'),
    pageDslPath: resolvePath('./query_dsls/hybrid_page_search_three_part_date_query_dsl.json'),
    queries: HYBRID_SEARCH_THREE_PART_DATE_QUERIES
};

// This works for
// search_query k:60
// page_query k:10

function parseArgs(argv) {
    const args = {
        baseDslPath: resolvePath('./query_dsls/hybrid_base_search_query_dsl.json'),
        pageDslPath: resolvePath('./query_dsls/hybrid_page_search_query_dsl.json'),
        index: process.env.OPENSEARCH_INDEX_CHUNKS_NAME || DEFAULT_OPENSEARCH_INDEX,
        failOnSubsetBreach: true,
        showExamples: 10,
        outputPath: undefined
    };

    for (let i = 2; i < argv.length; i += 1) {
        const token = argv[i];
        const next = argv[i + 1];

        if (token === '--base' && next) {
            args.baseDslPath = resolvePath(next);
            i += 1;
            continue;
        }
        if (token === '--page' && next) {
            args.pageDslPath = resolvePath(next);
            i += 1;
            continue;
        }
        if (token === '--index' && next) {
            args.index = next;
            i += 1;
            continue;
        }
        if (token === '--out' && next) {
            args.outputPath = resolvePath(next);
            i += 1;
            continue;
        }
        if (token === '--no-fail') {
            args.failOnSubsetBreach = false;
            continue;
        }
        if (token === '--examples' && next) {
            const parsed = Number.parseInt(next, 10);
            if (Number.isFinite(parsed) && parsed > 0) {
                args.showExamples = parsed;
            }
            i += 1;
            continue;
        }
        if (token === '--help' || token === '-h') {
            printUsage();
            process.exit(0);
        }
    }

    return args;
}

function printUsage() {
    console.log(`Usage:
  node stuff/validate-page-filter-subset.js [options]

Options:
  --base <path>       Base search DSL file (default: query_dsls/hybrid_base_search_query_dsl.json)
  --page <path>       Page-filtered DSL file (default: query_dsls/hybrid_page_search_query_dsl.json)
  --index <name>      OpenSearch index (fallback if not in DSL)
        --out <path>        JSON report file path (default: results/{query}-{stamp}.json)
  --examples <count>  Number of mismatch examples to print (default: 10)
  --no-fail           Exit 0 even when subset check fails
  --help, -h          Show this help

Environment:
    APP_DATABASE_URL                Optional. Default: ${DEFAULT_OPENSEARCH_URL}
    OPENSEARCH_INDEX_CHUNKS_NAME    Optional. Default: ${DEFAULT_OPENSEARCH_INDEX}
`);
}

function queryToFileSlug(query) {
    const compact = String(query || '')
        .trim()
        .replace(/\s+/g, '_');

    if (compact.length > 0) {
        return compact;
    }

    return 'query';
}

function buildTimestampedOutputPath(query) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    })
        .formatToParts(new Date())
        .reduce((acc, part) => {
            if (part.type !== 'literal') {
                acc[part.type] = part.value;
            }
            return acc;
        }, {});

    const stamp = `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
    const querySlug = queryToFileSlug(query);
    return resolvePath(`./results/${querySlug}-${stamp}.json`);
}

async function readJsonFile(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

function buildSearchParams(dsl, fallbackIndex) {
    // Supports both styles used in this repo:
    // 1) { query: { ... } } + external index
    // 2) { query: { index, preference, body: { query, ... } }, rows }
    if (dsl?.query?.body) {
        const index = dsl.query.index || fallbackIndex;
        if (!index) {
            throw new Error('No index found in page DSL and no fallback index supplied');
        }
        return {
            index,
            preference: dsl.query.preference,
            body: dsl.query.body
        };
    }

    if (dsl?.query) {
        if (!fallbackIndex) {
            throw new Error('No index supplied for base DSL style { query: ... }');
        }
        return {
            index: fallbackIndex,
            body: dsl
        };
    }

    throw new Error(
        'Unrecognized DSL format. Expected either { query: ... } or { query: { body: ... } }'
    );
}

function extractHits(searchResponse) {
    return searchResponse?.body?.hits?.hits || searchResponse?.hits?.hits || [];
}

function extractTotalValue(searchResponse, fallback = 0) {
    const total = searchResponse?.body?.hits?.total ?? searchResponse?.hits?.total;
    if (typeof total === 'number') {
        return total;
    }
    if (total && typeof total.value === 'number') {
        return total.value;
    }
    return fallback;
}

function inferPageSizeFromBody(body) {
    const size = Number.parseInt(body?.size, 10);
    if (Number.isFinite(size) && size > 0) {
        return size;
    }
    return 10;
}

async function fetchAllBaseHits(client, baseSearchParams) {
    const firstResponse = await client.search(baseSearchParams);
    const firstHits = extractHits(firstResponse);
    const totalValue = extractTotalValue(firstResponse, firstHits.length);

    const allHits = [...firstHits];
    const pageSize = inferPageSizeFromBody(baseSearchParams.body);
    let from = Number.parseInt(baseSearchParams?.body?.from, 10);
    if (!Number.isFinite(from) || from < 0) {
        from = 0;
    }

    while (allHits.length < totalValue) {
        from += pageSize;
        const pagedParams = {
            ...baseSearchParams,
            body: {
                ...baseSearchParams.body,
                from,
                size: pageSize
            }
        };

        const pagedResponse = await client.search(pagedParams);
        const pagedHits = extractHits(pagedResponse);
        if (pagedHits.length === 0) {
            break;
        }
        allHits.push(...pagedHits);
    }

    return {
        firstResponse,
        allHits,
        totalValue,
        fetchedAllHits: allHits.length >= totalValue
    };
}

function keyFromHit(hit) {
    const source = hit?._source || {};

    if (source.chunk_id) {
        return `chunk_id:${source.chunk_id}`;
    }

    if (hit?._id) {
        return `_id:${hit._id}`;
    }

    // Last-resort stable key if IDs are absent.
    return `fallback:${source.source_doc_id || 'na'}:${source.page_number || 'na'}:${source.chunk_index || 'na'}`;
}

function summarizeByPage(hits) {
    const counts = new Map();
    for (const hit of hits) {
        const page = hit?._source?.page_number;
        const key = page === undefined ? 'unknown' : String(page);
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Object.fromEntries([...counts.entries()].sort((a, b) => Number(a[0]) - Number(b[0])));
}

function uniqueChunkIdsFromHits(hits) {
    const chunkIds = new Set();
    for (const hit of hits) {
        const chunkId = hit?._source?.chunk_id;
        if (chunkId) {
            chunkIds.add(chunkId);
        }
    }
    return [...chunkIds].sort();
}

function chunkScoresFromHits(hits) {
    const scoreByChunkId = new Map();

    for (const hit of hits) {
        const chunkId = hit?._source?.chunk_id;
        if (!chunkId) {
            continue;
        }

        scoreByChunkId.set(chunkId, hit?._score ?? null);
    }

    return [...scoreByChunkId.entries()]
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        .map(([chunk_id, score]) => ({ chunk_id, score }));
}

function hasNeuralClause(dsl) {
    const shouldClauses = dsl?.query?.body?.query?.bool?.should || dsl?.query?.bool?.should || [];
    return shouldClauses.some((clause) => clause?.neural?.embedding);
}

function extractQueryInputsFromDsl(dsl) {
    const shouldClauses = dsl?.query?.body?.query?.bool?.should || dsl?.query?.bool?.should || [];

    const matchClause = shouldClauses.find((clause) => clause?.match?.chunk_text?.query);
    const neuralClause = shouldClauses.find((clause) => clause?.neural?.embedding?.query_text);

    return {
        keywordQuery: matchClause?.match?.chunk_text?.query || null,
        neuralQueryText: neuralClause?.neural?.embedding?.query_text || null
    };
}

function extractQueryConfigFromDsl(dsl, searchParams) {
    const body = dsl?.query?.body || dsl;
    const boolQuery = body?.query?.bool || {};
    const shouldClauses = boolQuery?.should || [];

    const keywordClause = shouldClauses.find((clause) => clause?.match?.chunk_text);
    const phraseGroupClause = shouldClauses.find((clause) => clause?.bool?.should);
    const neuralClause = shouldClauses.find((clause) => clause?.neural?.embedding);

    return {
        index: searchParams?.index || null,
        preference: searchParams?.preference || null,
        rows: dsl?.rows ?? null,
        min_score: body?.min_score ?? null,
        track_scores: body?.track_scores ?? null,
        minimum_should_match: boolQuery?.minimum_should_match ?? null,
        sort: body?.sort || null,
        boosts: {
            keyword: keywordClause?.match?.chunk_text?.boost ?? null,
            phraseGroup: phraseGroupClause?.bool?.boost ?? null,
            neural: neuralClause?.neural?.embedding?.boost ?? null
        },
        neural: {
            k: neuralClause?.neural?.embedding?.k ?? null
        }
    };
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function shellSingleQuote(value) {
    return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function buildSearchCurlCommand({ nodeUrl, index, preference, body }) {
    const trimmedNodeUrl = String(nodeUrl || '').replace(/\/+$/, '');
    const encodedIndex = encodeURIComponent(index);
    const queryParts = ['pretty=true'];

    if (preference) {
        queryParts.push(`preference=${encodeURIComponent(preference)}`);
    }

    const endpoint = `${trimmedNodeUrl}/${encodedIndex}/_search?${queryParts.join('&')}`;
    const bodyJson = JSON.stringify(body);

    return [
        `curl -sS -X POST ${shellSingleQuote(endpoint)} \\`,
        "  -H 'Content-Type: application/json' \\",
        `  --data-raw ${shellSingleQuote(bodyJson)}`
    ].join('\n');
}

function upsertTermFilter(filterArray, field, value) {
    if (!Array.isArray(filterArray)) {
        return;
    }

    const existing = filterArray.find((item) => item?.term && Object.hasOwn(item.term, field));
    if (existing) {
        existing.term[field] = value;
        return;
    }

    filterArray.push({ term: { [field]: value } });
}

function applyPageScopeToBody(body, { sourceDocId, pageNumber }) {
    const scopedBody = deepClone(body);
    const topFilters = scopedBody?.query?.bool?.filter;
    upsertTermFilter(topFilters, 'source_doc_id', sourceDocId);
    upsertTermFilter(topFilters, 'page_number', pageNumber);

    const shouldClauses = scopedBody?.query?.bool?.should;
    if (Array.isArray(shouldClauses)) {
        for (const clause of shouldClauses) {
            const neuralFilter = clause?.neural?.embedding?.filter;
            if (!neuralFilter) {
                continue;
            }

            if (Array.isArray(neuralFilter?.bool?.filter)) {
                upsertTermFilter(neuralFilter.bool.filter, 'source_doc_id', sourceDocId);
                upsertTermFilter(neuralFilter.bool.filter, 'page_number', pageNumber);
                continue;
            }

            if (neuralFilter.term && Object.hasOwn(neuralFilter.term, 'source_doc_id')) {
                neuralFilter.term.source_doc_id = sourceDocId;
            }
            if (neuralFilter.term && Object.hasOwn(neuralFilter.term, 'page_number')) {
                neuralFilter.term.page_number = pageNumber;
            }
        }
    }

    return scopedBody;
}

function collectPageScopes(hits) {
    const scopes = new Map();

    for (const hit of hits) {
        const sourceDocId = hit?._source?.source_doc_id;
        const pageNumber = hit?._source?.page_number;
        if (!sourceDocId || pageNumber === undefined || pageNumber === null) {
            continue;
        }

        const key = `${sourceDocId}::${pageNumber}`;
        const existing = scopes.get(key) || {
            sourceDocId,
            pageNumber,
            baseCount: 0
        };
        existing.baseCount += 1;
        scopes.set(key, existing);
    }

    return [...scopes.values()].sort((a, b) => {
        if (a.sourceDocId === b.sourceDocId) {
            return Number(a.pageNumber) - Number(b.pageNumber);
        }
        return a.sourceDocId.localeCompare(b.sourceDocId);
    });
}

function scopeKey(sourceDocId, pageNumber) {
    return `${sourceDocId}::${pageNumber}`;
}

function buildScopedBaseKeySets(hits) {
    const scopedSets = new Map();

    for (const hit of hits) {
        const sourceDocId = hit?._source?.source_doc_id;
        const pageNumber = hit?._source?.page_number;
        if (!sourceDocId || pageNumber === undefined || pageNumber === null) {
            continue;
        }

        const key = scopeKey(sourceDocId, pageNumber);
        if (!scopedSets.has(key)) {
            scopedSets.set(key, new Set());
        }
        scopedSets.get(key).add(keyFromHit(hit));
    }

    return scopedSets;
}

async function run() {
    const args = parseArgs(process.argv);
    const appDatabaseUrl = process.env.APP_DATABASE_URL || DEFAULT_OPENSEARCH_URL;

    const baseDslPath = path.resolve(args.baseDslPath);
    const pageDslPath = path.resolve(args.pageDslPath);

    const [baseDsl, pageDsl] = await Promise.all([
        readJsonFile(baseDslPath),
        readJsonFile(pageDslPath)
    ]);

    const baseSearchParams = buildSearchParams(baseDsl, args.index);
    const pageSearchParams = buildSearchParams(pageDsl, args.index || baseSearchParams.index);
    const baseQueryInputs = extractQueryInputsFromDsl(baseDsl);
    const pageQueryInputs = extractQueryInputsFromDsl(pageDsl);
    const baseQueryConfig = extractQueryConfigFromDsl(baseDsl, baseSearchParams);
    const pageQueryConfig = extractQueryConfigFromDsl(pageDsl, pageSearchParams);
    const outputPath =
        args.outputPath || buildTimestampedOutputPath(baseQueryInputs.neuralQueryText);

    const client = new Client({ node: appDatabaseUrl });

    console.log(`OpenSearch URL: ${appDatabaseUrl}`);
    console.log(`Fallback index: ${args.index}`);
    console.log('Base query inputs:', baseQueryInputs);
    console.log('Page query inputs:', pageQueryInputs);

    const baseDslCurlCommand = buildSearchCurlCommand({
        nodeUrl: appDatabaseUrl,
        index: baseSearchParams.index,
        preference: baseSearchParams.preference,
        body: baseSearchParams.body
    });
    console.log('\nBase DSL curl command:');
    console.log(baseDslCurlCommand);

    console.log('Running base search (fetching all pages)...');
    const {
        firstResponse: baseResponse,
        allHits: baseHits,
        totalValue: baseTotalValue,
        fetchedAllHits
    } = await fetchAllBaseHits(client, baseSearchParams);
    const pageScopes = collectPageScopes(baseHits);

    console.log(`Running page-filtered searches across ${pageScopes.length} scope(s)...`);

    const baseKeys = new Set(baseHits.map(keyFromHit));
    const scopedBaseKeySets = buildScopedBaseKeySets(baseHits);
    const baseHitByKey = new Map(baseHits.map((hit) => [keyFromHit(hit), hit]));

    const scopeResults = [];
    const allMissingFromBase = [];
    const allOutsideScope = [];
    const allMissingFromPage = [];
    let aggregateReturnedHits = 0;

    for (const scope of pageScopes) {
        const scopedBody = applyPageScopeToBody(pageSearchParams.body, scope);
        const scopedParams = {
            ...pageSearchParams,
            body: scopedBody
        };

        const pageResponse = await client.search(scopedParams);
        const pageHits = extractHits(pageResponse);
        aggregateReturnedHits += pageHits.length;
        const pageKeys = new Set(pageHits.map(keyFromHit));

        const currentScopeKey = scopeKey(scope.sourceDocId, scope.pageNumber);
        const scopedBaseKeys = scopedBaseKeySets.get(currentScopeKey) || new Set();

        const missingFromBase = pageHits
            .map((hit) => ({ hit, key: keyFromHit(hit), scope }))
            .filter(({ key }) => !baseKeys.has(key));

        const outsideScope = pageHits
            .map((hit) => ({ hit, key: keyFromHit(hit), scope }))
            .filter(({ key }) => !scopedBaseKeys.has(key));

        const missingFromPage = [...scopedBaseKeys]
            .filter((key) => !pageKeys.has(key))
            .map((key) => ({
                key,
                hit: baseHitByKey.get(key),
                scope
            }));

        allMissingFromBase.push(...missingFromBase);
        allOutsideScope.push(...outsideScope);
        allMissingFromPage.push(...missingFromPage);

        const exactMatchPass = missingFromPage.length === 0 && outsideScope.length === 0;
        const returnedChunkIds = uniqueChunkIdsFromHits(pageHits);
        const baseChunkIds = uniqueChunkIdsFromHits(
            [...scopedBaseKeys].map((key) => baseHitByKey.get(key)).filter(Boolean)
        );

        scopeResults.push({
            source_doc_id: scope.sourceDocId,
            page_number: scope.pageNumber,
            baseHits: scope.baseCount,
            returnedHits: pageHits.length,
            base_chunk_ids: baseChunkIds,
            returned_chunk_ids: returnedChunkIds,
            subsetPass: missingFromBase.length === 0,
            scopeFilterPass: outsideScope.length === 0,
            missingCount: missingFromBase.length,
            outsideScopeCount: outsideScope.length,
            missingFromPageCount: missingFromPage.length,
            additionalHitsCount: outsideScope.length,
            exactMatchPass
        });
    }

    const failingScopeCount = scopeResults.filter((scope) => scope.exactMatchPass === false).length;

    const missingExamples = allMissingFromBase
        .slice(0, args.showExamples)
        .map(({ hit, key, scope }) => ({
            key,
            scoped_doc_id: scope.sourceDocId,
            scoped_page_number: scope.pageNumber,
            score: hit?._score,
            source_doc_id: hit?._source?.source_doc_id,
            page_number: hit?._source?.page_number,
            chunk_index: hit?._source?.chunk_index,
            chunk_id: hit?._source?.chunk_id,
            chunk_text_preview: String(hit?._source?.chunk_text || '').slice(0, 140)
        }));

    const outsideScopeExamples = allOutsideScope
        .slice(0, args.showExamples)
        .map(({ hit, key, scope }) => ({
            key,
            scoped_doc_id: scope.sourceDocId,
            scoped_page_number: scope.pageNumber,
            source_doc_id: hit?._source?.source_doc_id,
            page_number: hit?._source?.page_number,
            chunk_index: hit?._source?.chunk_index,
            chunk_id: hit?._source?.chunk_id,
            chunk_text_preview: String(hit?._source?.chunk_text || '').slice(0, 140)
        }));

    const missingFromPageExamples = allMissingFromPage
        .slice(0, args.showExamples)
        .map(({ hit, key, scope }) => ({
            key,
            scoped_doc_id: scope.sourceDocId,
            scoped_page_number: scope.pageNumber,
            source_doc_id: hit?._source?.source_doc_id,
            page_number: hit?._source?.page_number,
            chunk_index: hit?._source?.chunk_index,
            chunk_id: hit?._source?.chunk_id,
            chunk_text_preview: String(hit?._source?.chunk_text || '').slice(0, 140)
        }));

    const result = {
        meta: {
            generatedAt: new Date().toISOString(),
            generatedAtEuropeLondon: new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Europe/London',
                dateStyle: 'full',
                timeStyle: 'long'
            }).format(new Date()),
            outputPath,
            baseDslPath,
            pageDslPath,
            opensearchUrl: appDatabaseUrl,
            fallbackIndex: args.index,
            queryInputs: {
                base: baseQueryInputs,
                page: pageQueryInputs
            },
            queryConfig: {
                base: baseQueryConfig,
                page: pageQueryConfig
            }
        },
        base: {
            index: baseSearchParams.index,
            totalHits: baseResponse?.body?.hits?.total,
            totalHitsValue: baseTotalValue,
            returnedHits: baseHits.length,
            returnedHitsMeaning:
                'Number of hits returned for the executed query window (affected by size/from/min_score).',
            fetchedAllHits,
            byPage: summarizeByPage(baseHits)
        },
        pageValidation: {
            index: pageSearchParams.index,
            scopesTested: pageScopes.length,
            aggregateReturnedHits,
            failingScopeCount,
            sampleScopes: scopeResults.slice(0, 20)
        },
        checks: {
            subsetPass: allMissingFromBase.length === 0,
            scopeFilterPass: allOutsideScope.length === 0,
            missingCount: allMissingFromBase.length,
            outsideScopeCount: allOutsideScope.length,
            exactSetPass: allMissingFromPage.length === 0 && allOutsideScope.length === 0,
            missingFromPageCount: allMissingFromPage.length,
            additionalHitsCount: allOutsideScope.length,
            pageDslContainsNeural: hasNeuralClause(pageDsl),
            baseDslContainsNeural: hasNeuralClause(baseDsl)
        },
        examples: {
            missingFromBase: missingExamples,
            missingFromPage: missingFromPageExamples,
            outsideRequestedScope: outsideScopeExamples
        }
    };

    console.log('\n=== Validation Summary ===');
    console.log(JSON.stringify(result, null, 2));

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(`\nReport written to: ${outputPath}`);

    if (allMissingFromBase.length > 0) {
        console.log('\n=== Examples missing from base set ===');
        console.log(JSON.stringify(missingExamples, null, 2));
    }

    if (allOutsideScope.length > 0) {
        console.log('\n=== Examples outside requested page scope ===');
        console.log(JSON.stringify(outsideScopeExamples, null, 2));
    }

    if (allMissingFromPage.length > 0) {
        console.log('\n=== Examples missing from page results (present in base scope) ===');
        console.log(JSON.stringify(missingFromPageExamples, null, 2));
    }

    if (
        (allMissingFromBase.length > 0 || allOutsideScope.length > 0) &&
        result.checks.pageDslContainsNeural
    ) {
        console.log(
            '\nNote: Page DSL contains a neural clause; check neural filter semantics if subset/scope violations appear.'
        );
    }

    if ((allMissingFromPage.length > 0 || allOutsideScope.length > 0) && args.failOnSubsetBreach) {
        process.exit(2);
    }

    console.log('\nSubset validation passed.');
}

run().catch((err) => {
    console.error('Validation script failed:', err.message);
    process.exit(1);
});
