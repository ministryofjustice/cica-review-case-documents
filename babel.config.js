'use strict';

const presets = [
    [
        '@babel/preset-env',
        {
            // debug: true,
            useBuiltIns: 'entry',
            corejs: 3.8,
            // https://github.com/babel/babel/issues/9515
            modules: false,
            targets: {
                browsers: [
                    // npx browserslist --mobile-to-desktop "last 2 versions, not dead"
                    'last 2 versions', // Last 2 versions of all browsers
                    'not dead' // Exclude browsers that are considered "dead"
                ]
            }
        }
    ]
];

export default {presets};

