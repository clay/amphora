'use strict';

const _ = require('lodash'),
  h = require('highland'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  /**
   * Return a fake plugin
   * @return {Object}
   */
  function pluginMock() {
    return {
      init: _.noop,
      save: _.noop,
      delete: _.noop
    };
  }

  describe('registerPlugins', function () {
    const fn = lib[this.title];

    it('assigns an object passed in to the `plugins` value on module.exports', function () {
      const pluginSample = [{ a: _.noop }, { b: _.noop }];

      fn(pluginSample);
      expect(lib.plugins).to.eql(pluginSample);
    });
  });

  describe('executeHook', function () {
    it('calls', function () {
      const plugin = sandbox.stub(pluginMock());

      lib.registerPlugins([plugin]);
      sinon.assert.calledOnce(plugin.init);
    });

    it('writes to Streams', function (done) {
      const stream = h(),
        streamPlugin = [{publishStream: stream}],
        payload = {uri: 'fake/uri', ops: [{}]};

      lib.registerPlugins(streamPlugin);
      lib.executeHook('publish', payload);

      stream
        .collect()
        .toPromise(Promise)
        .then(function (resp) {
          expect(resp).to.eql([payload]); // wrap in Array because of `.collect`
          done();
        });
    });
  });
});
