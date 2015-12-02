'use strict';
var _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  log = require('../log'),
  mockRestler = require('../../test/fixtures/mocks/restler'),
  restler = require('restler'),
  sinon = require('sinon');


describe(_.startCase(filename), function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(restler);
    sandbox.stub(log);
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

      restler.request.returns(mockRestler.createRequest());

      fn(site, eventName);

      sinon.assert.calledWith(restler.request, hookUrl, { headers: { 'X-Event': 'someEvent' }, method: 'POST' });
    });

    it('notifies with string value', function () {
      const hookUrl = 'some-url',
        site = {notify: {webhooks: {someEvent: [hookUrl]}}},
        data = 'some-string',
        eventName = 'someEvent';

      restler.request.returns(mockRestler.createRequest());

      fn(site, eventName, data);

      sinon.assert.calledWith(restler.request, hookUrl, {
        body: data,
        headers: {
          'Content-type': 'text/plain',
          'X-Event': eventName
        },
        method: 'POST'
      });
    });

    it('notifies with object value', function () {
      const hookUrl = 'some-url',
        site = {notify: {webhooks: {someEvent: [hookUrl]}}},
        data = {a:'b'},
        eventName = 'someEvent';

      restler.request.returns(mockRestler.createRequest());

      fn(site, eventName, data);

      sinon.assert.calledWith(restler.request, hookUrl, {
        body: JSON.stringify(data),
        headers: {
          'Content-type': 'application/json',
          'X-Event': eventName
        },
        method: 'POST'
      });
    });

    it('logs', function () {
      const hookUrl = 'some_url',
        site = {notify: {webhooks: {someEvent: [hookUrl]}}},
        eventName = 'someEvent',
        request = mockRestler.createRequest();

      sinon.stub(request, 'on');
      request.on.yields();
      restler.request.returns(request);

      fn(site, eventName);

      sinon.assert.calledWith(restler.request, hookUrl, { headers: { 'X-Event': 'someEvent' }, method: 'POST' });
    });
  });
});
