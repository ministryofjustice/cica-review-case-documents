import createTemplateEngineService from '../../../templateEngine/index.js';

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

export function getLoginAttemptContext(req, username, password, usernameError, passwordError) {
    const attemptsLeft =
        typeof req.rateLimit?.remaining === 'number' ? req.rateLimit.remaining : undefined;

    const hasBoth = username && password;
    const isInvalid =
        usernameError === 'Enter a valid username and password' && passwordError === '';

    let lockoutWarning;
    if (hasBoth && isInvalid) {
        lockoutWarning =
            'Enter a valid username and password. You will be locked out for 2 hours if you enter the wrong details 5 times';
    }

    return { attemptsLeft, lockoutWarning };
}
