'use strict';

var _ = require('lodash'),
  files = require('./files'),
  path = require('path'),
  bluebird = require('bluebird'),
  filename = __filename.split('/').pop().split('.').shift(),
  bootstrap = require('./bootstrap'),
  db = require('./services/db'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  log = require('./log');

describe(_.startCase(filename), function () {
  var sandbox,
    bootstrapFake;

  /**
   * @param {Stream} pipe
   * @returns {Promise}
   */
  function pipeToPromise(pipe) {
    var str = '',
      d = bluebird.defer();
    pipe.on('data', function (data) { str += data; })
      .on('error', d.reject)
      .on('end', function () {
        d.resolve(str);
      });
    return d.promise;
  }

  before(function () {
    this.timeout(400);
    bootstrapFake = files.getYaml(path.resolve('./test/fixtures/config/bootstrap'));
  });

  beforeEach(function () {

    sandbox = sinon.sandbox.create();
    sandbox.stub(log);
    sandbox.stub(db, 'formatBatchOperations').returns([]);

    return db.clear();
  });

  afterEach(function () {
    sandbox.restore();
  });

  after(function () {
    // clean up
    return db.clear();
  });


  it('missing bootstrap', function (done) {
    bootstrap('./jfkdlsa').then(function () {
      done('should throw');
    }).catch(function () {
      done();
    });
  });

  it('reads from bootstrap', function () {
    // this is doing IO, so give it more time.
    this.slow(50);
    this.timeout(400);

    return bootstrap('./test/fixtures/config/bootstrap').then(function () {
      return db.get('/components/image/instances/0')
        .then(JSON.parse)
        .then(function (results) {
          expect(results).to.deep.equal({
            src: 'http://placekitten.com/400/600',
            alt: 'adorable kittens'
          });
        });
    });
  });

  it('reads from bootstrap without bootstrap in path', function () {
    // this is doing IO, so give it more time.
    this.slow(50);
    this.timeout(400);

    return bootstrap('./test/fixtures/config');
  });

  it('reads from bootstrap with extension in path', function () {
    // this is doing IO, so give it more time.
    this.slow(50);
    this.timeout(400);

    return bootstrap('./test/fixtures/config/bootstrap.yaml');
  });

  it('reads uris from bootstrap', function () {
    // this is doing IO, so give it more time.
    this.slow(50);
    this.timeout(400);

    return bootstrap('./test/fixtures/config/bootstrap.yaml', 'test').then(function () {
      return pipeToPromise(db.list({prefix: 'test/uris', limit: -1}));
    }).then(JSON.parse).then(function (results) {
      expect(results).to.deep.equal({
        'test/uris/YQ==': 'b',
        'test/uris/Yw==': 'test/d',
        'test/uris/dGVzdC9l': 'f',
        'test/uris/dGVzdC9n': 'test/h'
      });
    });
  });

  it('reads pages from bootstrap', function () {
    // this is doing IO, so give it more time.
    this.slow(50);
    this.timeout(400);

    return bootstrap('./test/fixtures/config/bootstrap.yaml', 'test').then(function () {
      return pipeToPromise(db.list({prefix: 'test/pages', limit: -1}));
    }).then(JSON.parse).then(function (results) {
      expect(results).to.deep.equal({
        'test/pages/0': '{"layout":"test/a/b","head":"test/c/d"}',
        'test/pages/0@published': '{"layout":"test/a/b","head":"test/c/d"}'
      });
    });
  });

  it('reads components from bootstrap', function () {
    // this is doing IO, so give it more time.
    this.slow(50);
    this.timeout(400);

    return bootstrap('./test/fixtures/config/bootstrap.yaml', 'test').then(function () {
      return pipeToPromise(db.list({prefix: 'test/components', limit: -1}));
    }).then(JSON.parse).then(function (results) {
      expect(results).to.deep.include({
        // instance data of components (prefixes all the way down)
        'test/components/image/instances/0': '{"src":"http://placekitten.com/400/600","alt":"adorable kittens"}',
        'test/components/image/instances/0@published': '{"src":"http://placekitten.com/400/600","alt":"adorable kittens"}',

        // note the prefix added
        'test/components/image/instances/1': '{"_ref":"test/components/image2"}',
        'test/components/image/instances/1@published': '{"_ref":"test/components/image2"}',

        // note the prefix NOT added
        'test/components/image/instances/2': '{"_ref":"localhost/components/what"}',
        'test/components/image/instances/2@published': '{"_ref":"localhost/components/what"}',

        // base data of components
        'test/components/image2': '{"src":"http://placekitten.com/400/600","alt":"adorable kittens"}',
        'test/components/image2@published': '{"src":"http://placekitten.com/400/600","alt":"adorable kittens"}' });
    });
  });
});