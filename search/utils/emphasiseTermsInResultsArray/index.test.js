'use strict';

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";

import emphasiseTermsInStringArray from './index.js';
import searchResultsFixture from './fixtures/search-results.json' with { type: 'json' };

let searchResultsArray;

describe('emphasiseTermsInStringArray', () => {
    beforeEach(() => {
        searchResultsArray = JSON.parse(JSON.stringify(searchResultsFixture));
    });
    
    it('Should emphasise individual words across all strings', () => {
        const actual = emphasiseTermsInStringArray(searchResultsArray, ['foo', 'plugh']);
        assert.match(actual[0]._source.chunk_text, new RegExp('<strong>foo</strong>'));
        assert.match(actual[0]._source.chunk_text, new RegExp('<strong>plugh</strong>'));
        assert.match(actual[1]._source.chunk_text, new RegExp('<strong>plugh</strong>'));
        assert.match(actual[2]._source.chunk_text, new RegExp('<strong>foo</strong>'));
    });

    it('Should emphasise compound terms across all strings', () => {
        const actual = emphasiseTermsInStringArray(searchResultsArray, ['chunk baz']);
        assert.match(actual[1]._source.chunk_text, new RegExp('<strong>chunk baz</strong>'));
    });

    it('Should emphasise individual words of a compound term search across all strings if the full compound term is not found in the string', () => {
        const actual = emphasiseTermsInStringArray(searchResultsArray, ['foo bar']);
        assert.match(actual[0]._source.chunk_text, new RegExp('<strong>foo bar</strong>'));
        assert.match(actual[1]._source.chunk_text, new RegExp('<strong>foo</strong>'));
        assert.match(actual[2]._source.chunk_text, new RegExp('<strong>foo bar</strong>'));
    });
});