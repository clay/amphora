'use strict';
const _ = require('lodash'),
  bluebird = require('bluebird'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  winston = require('winston'),
  rest = require('../rest'),
  sinon = require('sinon');


describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(rest);
    sandbox.stub(winston);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('notify', function () {
    const fn = lib[this.title];

    it('does not throw when event not defined in site', function () {
      const site = {},
        eventName = 'someEvent';

      expect(function () {
        fn(site, eventName);
      }).to.not.throw();
    });

    it('does not throw when event is empty', function () {
      const site = {notify: {webhooks: {someEvent: []}}},
        eventName = 'someEvent';

      expect(function () {
        fn(site, eventName);
      }).to.not.throw();
    });

    it('notifies without value', function () {
      const hookUrl = 'some_url',
        site = {notify: {webhooks: {someEvent: [hookUrl]}}},
        pageUri = 'nymag.com/thecut/pages/cjivlalajdkf',
        eventName = 'someEvent';

      rest.fetch.returns(bluebird.resolve());

      return fn(site, eventName, null, pageUri).then(function () {
        sinon.assert.calledWith(rest.fetch, hookUrl, { headers: { 'X-Event': 'someEvent', 'page-uri': 'nymag.com/thecut/pages/cjivlalajdkf'}, method: 'POST' });
      });
    });

    it('notifies with string value', function () {
      const hookUrl = 'some-url',
        site = {notify: {webhooks: {someEvent: [hookUrl]}}},
        data = 'some-string',
        pageUri = 'nymag.com/thecut/pages/cjivlalajdkf',
        eventName = 'someEvent';

      rest.fetch.returns(bluebird.resolve());

      return fn(site, eventName, data, pageUri).then(function () {
        sinon.assert.calledWith(rest.fetch, hookUrl, {
          body: data,
          headers: {
            'Content-type': 'text/plain',
            'X-Event': eventName,
            'page-uri': pageUri
          },
          method: 'POST'
        });
      });
    });

    it('notifies with object value', function () {
      const hookUrl = 'some-url',
        site = {notify: {webhooks: {someEvent: [hookUrl]}}},
        data = {a:'b'},
        pageUri = 'nymag.com/thecut/pages/cjivlalajdkf',
        eventName = 'someEvent';

      rest.fetch.returns(bluebird.resolve());

      return fn(site, eventName, data, pageUri).then(function () {
        sinon.assert.calledWith(rest.fetch, hookUrl, {
          body: JSON.stringify(data),
          headers: {
            'Content-type': 'application/json',
            'X-Event': eventName,
            'page-uri': pageUri
          },
          method: 'POST'
        });
      });
    });

    it('logs', function () {
      const hookUrl = 'some_url',
        site = {notify: {webhooks: {someEvent: [hookUrl]}}},
        pageUri = 'nymag.com/thecut/pages/cjivlalajdkf',
        eventName = 'someEvent';

      rest.fetch.returns(bluebird.resolve());

      return fn(site, eventName, null, pageUri).then(function () {
        sinon.assert.calledWith(rest.fetch, hookUrl, { headers: { 'X-Event': 'someEvent', 'page-uri': 'nymag.com/thecut/pages/cjivlalajdkf' }, method: 'POST' });
      });
    });
  });
});
