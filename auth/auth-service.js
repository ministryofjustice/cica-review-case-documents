import { getAuthConfig } from './utils/getAuthConfig/index.js';

export function validateLogin(username, password) {
    const { secret, usernames } = getAuthConfig();
    const normalizedUsername = (username || '').toLowerCase();

    let error = '';
    let usernameError = '';
    let passwordError = '';

    if (!username && !password) {
        error = 'Enter your username';
        usernameError = 'Enter your username';
        passwordError = 'Enter your password';
    } else if (!username) {
        error = 'Enter your username';
        usernameError = 'Enter your username';
    } else if (!password) {
        error = 'Enter your password';
        passwordError = 'Enter your password';
    } else if (
        typeof username !== 'string' ||
        !username.includes('@') ||
        username.lastIndexOf('.') < username.indexOf('@') + 2
    ) {
        error = 'Enter a valid username and password';
        usernameError = 'Enter a valid username and password';
    } else if (password !== secret || !usernames.includes(normalizedUsername)) {
        error = 'Enter a valid username and password';
        usernameError = 'Enter a valid username and password';
    }

    return { error, usernameError, passwordError };
}
