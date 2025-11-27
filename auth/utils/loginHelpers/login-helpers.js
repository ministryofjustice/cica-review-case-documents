import createTemplateEngineService from '../../../templateEngine/index.js';

/**
 * Renders the login response using a template engine and sends it to the client.
 *
 * @param {import('express').Response} res - The Express response object.
 * @param {Object} options - Options for rendering the login page.
 * @param {string} options.csrfToken - CSRF token for form protection.
 * @param {string} [options.error] - General error message to display.
 * @param {string} [options.usernameError] - Error message related to the username field.
 * @param {string} [options.passwordError] - Error message related to the password field.
 * @param {string} [options.username] - The username entered by the user.
 * @param {number} [options.attemptsLeft] - Number of login attempts left before lockout.
 * @param {string} [options.lockoutWarning] - Warning message about imminent lockout.
 * @param {number} [options.status=400] - HTTP status code for the response.
 * @returns {void}
 */
export function renderLoginResponse(
    res,
    {
        csrfToken,
        error,
        usernameError,
        passwordError,
        username,
        attemptsLeft,
        lockoutWarning,
        status = 400
    }
) {
    const templateEngineService = createTemplateEngineService();
    const { render } = templateEngineService;
    const html = render('index/login.njk', {
        csrfToken,
        error,
        usernameError,
        passwordError,
        username,
        attemptsLeft,
        lockoutWarning
    });
    return res.status(status).send(html);
}

/**
 * Generates context information for a login attempt, including remaining attempts and lockout warnings.
 *
 * @param {Object} req - The Express request object, expected to contain rateLimit information.
 * @param {string} username - The username provided by the user.
 * @param {string} password - The password provided by the user.
 * @param {string} usernameError - Error message related to the username input.
 * @param {string} passwordError - Error message related to the password input.
 * @returns {{ attemptsLeft: number|undefined, lockoutWarning: string|undefined }}
 *   An object containing the number of attempts left and a lockout warning message if applicable.
 */
export function getLoginAttemptContext(req, username, password, usernameError, passwordError) {
    const attemptsLeft =
        typeof req.rateLimit?.remaining === 'number' ? req.rateLimit.remaining : undefined;

    const hasBoth = username && password;
    const isInvalid =
        usernameError === 'Enter a valid username and password' && passwordError === '';

    let lockoutWarning;
    if (hasBoth && isInvalid) {
        lockoutWarning = `Enter a valid username and password. You have ${attemptsLeft} attempts remaining before you are locked out.`;
    }

    return { attemptsLeft, lockoutWarning };
}
