'use strict';

function createAppError({name, message, error}) {
    const err = Error(message, {cause: error});
    err.name = name;
    return err;
}

module.exports = {createAppError};
