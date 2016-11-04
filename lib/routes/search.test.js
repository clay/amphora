'use strict';
const _ = require('lodash'),
  bluebird = require('bluebird'),
  search = require('../services/search'),
  responses = require('../responses'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon');


describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(search);
    sandbox.stub(responses, 'expectJSON');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('elasticPassthrough', function () {
    const fn = lib[this.title];

    it('calls the RESTQuery search service function', function () {
      const callback = fn();

      search.RESTQuery.returns(Promise.resolve('womp'));

      callback({test: true})
        .then(function(resp) {
          expect(search.RESTQuery.calledOnce).to.be.true;
        });
    });
  });

  describe('response', function () {
    const fn = lib[this.title];

    it('calls the `expectJSON` response method', function () {
      fn({body: '{"test": true}'});
      expect(responses.expectJSON.calledOnce).to.be.true;
    });
  });
});
