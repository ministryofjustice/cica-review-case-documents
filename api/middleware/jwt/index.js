import jwt from 'jsonwebtoken';

function authenticateToken(req, res, next) {
    const token =
        req.cookies.jwtToken ||
        (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token) {
        req.log?.warn({ url: req.originalUrl }, 'Missing authentication token');
        return res.status(401).send('Missing authentication token');
    }

    try {
        const user = jwt.verify(token, process.env.APP_JWT_SECRET);
        req.user = user;
        next();
    } catch (err) {
        req.log?.warn({ url: req.originalUrl, error: err.message }, 'Invalid authentication token');
        return res.status(403).send('Invalid authentication token');
    }
}

export default authenticateToken;
