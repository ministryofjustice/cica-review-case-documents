'use strict';

const caseSelected = (req, res, next) => {
    if (req.session.caseSelected !== true) {
        return res.redirect('/case');
    }
    next();
};

export {
    caseSelected
};
