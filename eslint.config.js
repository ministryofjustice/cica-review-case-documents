export default (async () => [
    {
        files: ['**/*.js'],
        ignores: ['**/bundle.js'],
        plugins: {
            jsdoc: (await import('eslint-plugin-jsdoc')).default
        },
        rules: {
            'jsdoc/require-description': 'error',
            'jsdoc/require-param-description': 'error',
            'jsdoc/require-jsdoc': 'error'
        }
    }
])();
