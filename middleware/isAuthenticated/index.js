import jwt from 'jsonwebtoken';

export default function isAuthenticated(req, res, next) {
    // Check session first (for backward compatibility)
    if (req.session?.loggedIn) {
        return next();
    }

    // Check JWT cookie
    const token =
        req.cookies.jwtToken ||
        (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token) {
        req.log?.warn({ url: req.originalUrl }, 'Missing authentication token');
        req.session.returnTo = req.originalUrl;
        return res.redirect('/auth/login');
    }

    try {
        const user = jwt.verify(token, process.env.APP_JWT_SECRET);
        req.user = user;
        return next();
    } catch (err) {
        req.log?.warn({ url: req.originalUrl, error: err.message }, 'Invalid authentication token');
        req.session.returnTo = req.originalUrl;
        return res.redirect('/auth/login');
    }
}
