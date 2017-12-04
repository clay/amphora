'use strict';
const _ = require('lodash'),
  bluebird = require('bluebird'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  rest = require('../rest'),
  sinon = require('sinon');


describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(rest);
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
        eventName = 'someEvent';

      rest.fetch.returns(bluebird.resolve());

      return fn(site, eventName).then(function () {
        sinon.assert.calledWith(rest.fetch, hookUrl, { headers: { 'X-Event': 'someEvent' }, method: 'POST' });
      });
    });

    it('notifies with string value', function () {
      const hookUrl = 'some-url',
        site = {notify: {webhooks: {someEvent: [hookUrl]}}},
        data = 'some-string',
        eventName = 'someEvent';

      rest.fetch.returns(bluebird.resolve());

      return fn(site, eventName, data).then(function () {
        sinon.assert.calledWith(rest.fetch, hookUrl, {
          body: data,
          headers: {
            'Content-type': 'text/plain',
            'X-Event': eventName
          },
          method: 'POST'
        });
      });
    });

    it('notifies with object value', function () {
      const hookUrl = 'some-url',
        site = {notify: {webhooks: {someEvent: [hookUrl]}}},
        data = {a:'b'},
        eventName = 'someEvent';

      rest.fetch.returns(bluebird.resolve());

      return fn(site, eventName, data).then(function () {
        sinon.assert.calledWith(rest.fetch, hookUrl, {
          body: JSON.stringify(data),
          headers: {
            'Content-type': 'application/json',
            'X-Event': eventName
          },
          method: 'POST'
        });
      });
    });

    it('logs', function () {
      const hookUrl = 'some_url',
        site = {notify: {webhooks: {someEvent: [hookUrl]}}},
        eventName = 'someEvent';

      rest.fetch.returns(bluebird.resolve());

      return fn(site, eventName).then(function () {
        sinon.assert.calledWith(rest.fetch, hookUrl, { headers: { 'X-Event': 'someEvent' }, method: 'POST' });
      });
    });
  });
});
