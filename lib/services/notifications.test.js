'use strict';
var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  sinon = require('sinon'),
  lib = require('./' + filename),
  log = require('../log'),
  restler = require('restler'),
  mockRestler = require('../../test/fixtures/mocks/restler');

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

  describe('define', function () {
    const fn = lib[this.title];

    it('returns function even when given nothing', function () {
      const notify = fn();

      notify();
    });

    it('returns function when given empty array', function () {
      const definition = {
          webhooks: []
        },
        notify = fn(definition);

      notify();
    });

    it('does not notify when not correct op', function () {
      const definition = {
          webhooks: [
            { url: 'some-url', event: 'event-name', op: 'del', match: 'url' }
          ]
        },
        notify = fn(definition);

      notify({type: 'put', key: 'some-url'});

      sinon.assert.notCalled(restler.request);
    });

    it('does not notify when not a match', function () {
      const opType = 'put',
        definition = {
          webhooks: [
            { url: 'some-url', event: 'event-name', op: opType, match: 'some-regex' }
          ]
        },
        notify = fn(definition);

      notify({type: opType, key: 'some-key'});

      sinon.assert.notCalled(restler.request);
    });

    it('notifies without value', function () {
      const hookUrl = 'some-url',
        key = 'some-key',
        opType = 'put',
        eventName = 'some-event',
        definition = {webhooks: [{ url: hookUrl, event: eventName, op: opType, match: 'key' }]},
        notify = fn(definition);

      restler.request.returns(mockRestler.createRequest());

      notify({type: opType, key: key});

      sinon.assert.calledWith(restler.request, hookUrl, {
          body: JSON.stringify({ event: eventName, type: opType, key: key }),
          headers: { 'Content-type': 'application/json' },
          method: 'POST'
        });
    });

    it('notifies with string value', function () {
      const hookUrl = 'some-url',
        key = 'some-key',
        opType = 'put',
        eventName = 'some-event',
        value = 'some-string-value',
        definition = {webhooks: [{ url: hookUrl, event: eventName, op: opType, match: 'key' }]},
        notify = fn(definition);

      restler.request.returns(mockRestler.createRequest());

      notify({type: opType, key: key, value: value});

      sinon.assert.calledWith(restler.request, hookUrl, {
        body: JSON.stringify({ event: eventName, type: opType, key: key, value: value }),
        headers: { 'Content-type': 'application/json' },
        method: 'POST'
      });
    });

    it('notifies with object value', function () {
      const hookUrl = 'some-url',
        key = 'some-key',
        opType = 'put',
        eventName = 'some-event',
        value = {a: 'b'},
        definition = {webhooks: [{ url: hookUrl, event: eventName, op: opType, match: 'key' }]},
        notify = fn(definition);

      restler.request.returns(mockRestler.createRequest());

      notify({type: opType, key: key, value: value});

      sinon.assert.calledWith(restler.request, hookUrl, {
        body: JSON.stringify({ event: eventName, type: opType, key: key, value: value }),
        headers: { 'Content-type': 'application/json' },
        method: 'POST'
      });
    });

    it('logs when complete', function () {
      const hookUrl = 'some-url',
        key = 'some-key',
        opType = 'put',
        eventName = 'some-event',
        value = {a: 'b'},
        definition = {webhooks: [{ url: hookUrl, event: eventName, op: opType, match: 'key' }]},
        notify = fn(definition),
        request = mockRestler.createRequest();

      sinon.stub(request, 'on');
      request.on.yields();
      restler.request.returns(request);

      notify({type: opType, key: key, value: value});

      sinon.assert.calledOnce(log.info);
    });
  });
});
