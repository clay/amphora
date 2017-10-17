'use strict';

const _ = require('lodash'),
  files = require('./files'),
  path = require('path'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./bootstrap'),
  db = require('./services/db'),
  siteService = require('./services/sites'),
  expect = require('chai').expect,
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  let sandbox,
    bootstrapFake, // eslint-disable-line
    sitesFake,
    fakeLog;

  before(function () {
    this.timeout(400);
    sitesFake = [{
      host: 'example1.com',
      dir: 'example1',
      prefix: 'example1.com'
    }, {
      host: 'example2.com',
      path: '/',
      dir: 'example2',
      prefix: 'example1.com'
    }, {
      host: 'example3.com',
      path: '/some-path',
      dir: 'example3',
      prefix: 'example1.com/some-path'
    }];
    bootstrapFake = files.getYaml(path.resolve('./test/fixtures/config/bootstrap'));
  });

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    fakeLog = sandbox.stub();

    lib.setLog(fakeLog);
    sandbox.stub(db, 'formatBatchOperations').returns([]);
    sandbox.stub(siteService);
    siteService.sites.returns(_.cloneDeep(sitesFake));

    return db.clear();
  });

  afterEach(function () {
    sandbox.restore();
  });

  after(function () {
    // clean up
    return db.clear();
  });

  describe('lib', function () {
    const fn = lib;

    beforeEach(function () {
      sandbox.stub(path, 'resolve', _.identity);
      sandbox.stub(files, 'isDirectory');
      sandbox.stub(files, 'getYaml');
      sandbox.stub(files, 'getComponents');
      sandbox.stub(files, 'getComponentPath', _.identity);
    });

    it('bootstraps', function () {
      files.getComponents.returns(['a', 'b', 'c']);
      files.getYaml.withArgs('example1').returns({});

      return fn();
    });

    it('hits the `then` function when bootstrapPath is run successfully', function () {
      files.getComponents.returns(['a', 'b', 'c']);
      files.getYaml.withArgs('example1').returns({});
      sandbox.stub(lib, 'bootstrapPath').returns(Promise.resolve({}));
      return fn();
    });

    it('skips running the bootstrap process if the `runBootstrap` bool is false', function () {
      return fn(false)
        .then(function () {
          sinon.assert.calledWith(fakeLog,'info', 'Skipping bootstrapping sites and components');
        });
    });
  });

  describe('bootstrapPath', function () {
    const fn = lib[this.title];


    it('missing bootstrap', function (done) {
      fn('./jfkdlsa', sitesFake[0])
        .then(done.bind(null, 'should throw'))
        .catch(function () {
          done();
        });
    });

    it('reads from bootstrap', function () {
      // this is doing IO, so give it more time.
      this.slow(50);
      this.timeout(400);

      return fn('./test/fixtures/config/bootstrap', sitesFake[0]).then(function () {
        function expectKittehs(results) {
          expect(results).to.deep.equal({
            src: 'http://placekitten.com/400/600',
            alt: 'adorable kittens'
          });
        }

        return db.get(sitesFake[0].prefix + '/components/image/instances/0')
          .then(JSON.parse)
          .then(expectKittehs);
      });
    });

    it('reads from bootstrap without bootstrap in path', function () {
      // this is doing IO, so give it more time.
      this.slow(50);
      this.timeout(400);

      return fn('./test/fixtures/config', sitesFake[0]);
    });

    it('reads from bootstrap with extension in path', function () {
      // this is doing IO, so give it more time.
      this.slow(50);
      this.timeout(400);

      return fn('./test/fixtures/config/bootstrap.yaml', sitesFake[0]);
    });

    it('reads uris from bootstrap', function () {
      // this is doing IO, so give it more time.
      this.slow(50);
      this.timeout(400);

      return fn('./test/fixtures/config/bootstrap.yaml', sitesFake[0]).then(function () {
        return db.pipeToPromise(db.list({prefix: sitesFake[0].prefix + '/uris', limit: -1}));
      }).then(JSON.parse).then(function (results) {
        expect(results).to.deep.equal({
          'example1.com/uris/YQ==': 'b',
          'example1.com/uris/Yw==': 'example1.com/d',
          'example1.com/uris/ZXhhbXBsZTEuY29tL2U=': 'f',
          'example1.com/uris/ZXhhbXBsZTEuY29tL2c=': 'example1.com/h'
        });
      });
    });

    it('reads pages from bootstrap', function () {
      // this is doing IO, so give it more time.
      this.slow(50);
      this.timeout(400);

      return fn('./test/fixtures/config/bootstrap.yaml', sitesFake[0]).then(function () {
        return db.pipeToPromise(db.list({prefix: 'example1.com/pages', limit: -1}));
      }).then(JSON.parse).then(function (results) {
        expect(results).to.deep.equal({
          'example1.com/pages/0': JSON.stringify({
            layout: 'example1.com/a/b',
            url: 'http://example1.com/x/y',
            body: 'example1.com/c/d',
            head: ['example1.com/e/f']
          })
        });
      });
    });

    it('reads components from bootstrap', function () {
      // this is doing IO, so give it more time.
      this.slow(50);
      this.timeout(400);

      return fn('./test/fixtures/config/bootstrap.yaml', sitesFake[0]).then(function () {
        return db.pipeToPromise(db.list({prefix: 'example1.com/components', limit: -1}));
      }).then(JSON.parse).then(function (results) {
        expect(results).to.deep.include({
          // instance data of components (prefixes all the way down)
          'example1.com/components/image/instances/0': '{"src":"http://placekitten.com/400/600","alt":"adorable kittens"}',

          // note the prefix added
          'example1.com/components/image/instances/1': '{"_ref":"example1.com/components/image2"}',

          // note the prefix NOT added
          'example1.com/components/image/instances/2': '{"_ref":"localhost/components/what"}',

          // base data of components
          'example1.com/components/image2': '{"src":"http://placekitten.com/400/600","alt":"adorable kittens"}'
        });
      });
    });
  });
});
