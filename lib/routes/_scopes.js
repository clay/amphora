'use strict';

const scopes = require('../services/scopes');

/**
 * Mount routes to the specified router.
 * @param  {Object} router
 */
function routes(router) {
  router.post('/', (req, res) => {
    const data = Array.isArray(req.body) ? {_: req.body} : req.body;

    return scopes.resolveScopes(data, res.locals)
      .map(JSON.stringify)
      .pipe(res);
  });
}

module.exports = routes;
