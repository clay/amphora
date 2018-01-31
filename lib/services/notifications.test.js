'use strict';
const _ = require('lodash'),
  bluebird = require('bluebird'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  rest = require('../rest'),
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  let sandbox, fakeLog;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    fakeLog = sinon.spy();
    lib.setLog(fakeLog);
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

    it('logs a successful notification', function () {
      const hookUrl = 'some_url',
        site = {notify: {webhooks: {someEvent: [hookUrl]}}},
        eventName = 'someEvent',
        successResp = { status: 200, statusText: 'created', json: Promise.resolve() };

      rest.fetch.returns(bluebird.resolve(successResp));

      return fn(site, eventName).then(() => {
        sinon.assert.calledWith(fakeLog, 'info');
      });
    });

    it('logs an error if the service returns a non 200/300 response', function () {
      const hookUrl = 'some_url',
        site = {notify: {webhooks: {someEvent: [hookUrl]}}},
        eventName = 'someEvent',
        successResp = { status: 404, statusText: 'does not exist', json: Promise.resolve() };

      rest.fetch.returns(bluebird.resolve(successResp));

      return fn(site, eventName).then(() => {
        sinon.assert.calledWith(fakeLog, 'error');
      });
    });

    it('logs errors if the fetch fails', function () {
      const hookUrl = 'some_url',
        site = {notify: {webhooks: {someEvent: [hookUrl]}}},
        eventName = 'someEvent';

      rest.fetch.returns(bluebird.reject(Error('foo')));
      return fn(site, eventName).then(() => {
        sinon.assert.calledWith(fakeLog, 'error');
      });
    });
  });
});
