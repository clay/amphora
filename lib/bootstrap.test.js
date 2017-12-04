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
      prefix: 'example1.com',
      slug: 'ex1'
    }, {
      host: 'example2.com',
      path: '/',
      dir: 'example2',
      prefix: 'example1.com',
      slug: 'ex2'
    }, {
      host: 'example3.com',
      path: '/some-path',
      dir: 'example3',
      prefix: 'example1.com/some-path',
      slug: 'ex3'
    }];
    bootstrapFake = files.getYaml(path.resolve('./test/fixtures/config/bootstrap'));
  });

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    fakeLog = sandbox.stub();

    lib.setLog(fakeLog);
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
          sinon.assert.calledWith(fakeLog, 'info', sinon.match('Skipping bootstrapping sites and components'));
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

        return db.get(`${sitesFake[0].slug}/_components/image/instances/0`)
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
        return db.pipeToPromise(db.list({prefix: `${sitesFake[0].slug}/_uris`, limit: -1}));
      }).then(JSON.parse).then(function (results) {
        expect(results).to.deep.equal({
          'ex1/_uris/YQ==': 'b',
          'ex1/_uris/Yw==': 'ex1/d',
          'ex1/_uris/ZXgxL2U=': 'f',
          'ex1/_uris/ZXgxL2c=': 'ex1/h'
        });
      });
    });

    it('reads pages from bootstrap', function () {
      // this is doing IO, so give it more time.
      this.slow(50);
      this.timeout(400);

      return fn('./test/fixtures/config/bootstrap.yaml', sitesFake[0]).then(function () {
        return db.pipeToPromise(db.list({prefix: 'ex1/_pages', limit: -1}));
      }).then(JSON.parse).then(function (results) {
        expect(results).to.deep.equal({
          'ex1/_pages/0': JSON.stringify({
            layout: 'ex1/a/b',
            url: 'http://example1.com/x/y',
            body: 'ex1/c/d',
            head: ['ex1/e/f']
          })
        });
      });
    });

    it('reads components from bootstrap', function () {
      // this is doing IO, so give it more time.
      this.slow(50);
      this.timeout(400);

      return fn('./test/fixtures/config/bootstrap.yaml', sitesFake[0]).then(function () {
        return db.pipeToPromise(db.list({prefix: 'ex1/_components', limit: -1}));
      }).then(JSON.parse).then(function (results) {
        expect(results).to.deep.include({
          // instance data of components (prefixes all the way down)
          'ex1/_components/image/instances/0': '{"src":"http://placekitten.com/400/600","alt":"adorable kittens"}',

          // note the prefix added
          'ex1/_components/image/instances/1': '{"_ref":"ex1/_components/image2"}',

          // note the prefix NOT added
          'ex1/_components/image/instances/2': '{"_ref":"localhost/_components/what"}',

          // base data of components
          'ex1/_components/image2': '{"src":"http://placekitten.com/400/600","alt":"adorable kittens"}'
        });
      });
    });
  });
});
