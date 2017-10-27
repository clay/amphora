'use strict';
const _ = require('lodash'),
  bluebird = require('bluebird'),
  buf = require('./buffer'),
  db = require('./db'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  notifications = require('./notifications'),
  plugins = require('../plugins'),
  lib = require('./' + filename);

describe(_.startCase(filename), function () {
  let sandbox,
    fakeSite = {
      slug: 'something',
      host: 'something.com',
      path: '',
      prefix: 'something.com'
    };

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(db, 'get');
    sandbox.stub(db, 'del');
    sandbox.stub(notifications, 'notify');
    sandbox.stub(plugins, 'executeHook');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('del', function () {
    const fn = lib[this.title];

    it('notifies', function () {
      const pageUrl = 'something.com/cool/page',
        uri = `something.com/_uris/${buf.encode(pageUrl)}`,
        oldData = 'something/_pages/1',
        expectedData = 'something.com/_pages/1';

      db.del.returns(bluebird.resolve());
      db.get.returns(bluebird.resolve(oldData));

      return fn(uri, fakeSite).then(function () {
        sinon.assert.calledWith(notifications.notify, fakeSite, 'unpublished', {
          url: pageUrl
        });
      });
    });

    it('plugin unpublish hook', function () {
      const uri = 'something.com/_uris/c29tZS11cmk=',
        oldData = 'something/_pages/1',
        expectedData = 'something.com/_pages/1';

      db.del.returns(bluebird.resolve());
      db.get.returns(bluebird.resolve(oldData));

      return fn(uri, fakeSite).then(function () {
        sinon.assert.calledWith(plugins.executeHook, 'unpublish');
      });
    });

    it('deletes', function () {
      const uri = 'something.com/_uris/some-uri',
        dbUri = 'something/_uris/some-uri',
        oldData = 'something/_pages/1',
        expectedData = 'something.com/_pages/1';

      db.del.returns(bluebird.resolve());
      db.get.returns(bluebird.resolve(oldData));

      return fn(uri, fakeSite).then(function () {
        sinon.assert.calledWith(db.del, dbUri);
      });
    });

    it('returns old data', function () {
      const uri = 'something.com/_uris/some-uri',
        oldData = 'something/_pages/1',
        expectedData = 'something.com/_pages/1';

      db.get.returns(bluebird.resolve(oldData));
      db.del.returns(bluebird.resolve());

      return fn(uri, fakeSite).then(function (result) {
        expect(result).to.deep.equal(expectedData);
      });
    });
  });
});
