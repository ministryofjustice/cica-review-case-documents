'use strict';

import path from 'path';
const __dirname = import.meta.dirname;

const config = {
    mode: 'development',
    entry: [path.resolve(__dirname, 'src/js/scripts.babel.generated.js')],
    output: {
        path: path.resolve(__dirname, 'public/js/'),
        filename: 'bundle.js'
    },
    devtool: false
};

export default config;
