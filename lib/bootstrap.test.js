'use strict';

const _ = require('lodash'),
  files = require('./files'),
  path = require('path'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./bootstrap'),
  siteService = require('./services/sites'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  storage = require('../test/fixtures/mocks/storage');

describe(_.startCase(filename), function () {
  let sandbox,
    bootstrapFake, // eslint-disable-line
    db,
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
    sandbox.stub(siteService);
    siteService.sites.returns(_.cloneDeep(sitesFake));
    db = storage();
    lib.setDb(db);
    db.batch.callsFake(db.batchToInMem); // we want to make sure to send to the actual in-mem batch

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
      sandbox.stub(path, 'resolve').callsFake(_.identity);
      sandbox.stub(files, 'isDirectory');
      sandbox.stub(files, 'getYaml');
      sandbox.stub(files, 'getComponents');
      sandbox.stub(files, 'getComponentPath').callsFake(_.identity);
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

        return db.getFromInMem(sitesFake[0].prefix + '/_components/image/instances/0')
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
        return db.pipeToPromise(db.list({prefix: sitesFake[0].prefix + '/_uris', limit: -1}));
      }).then(JSON.parse).then(function (results) {
        expect(results).to.deep.equal({
          'example1.com/_uris/YQ==': 'b',
          'example1.com/_uris/Yw==': 'example1.com/d',
          'example1.com/_uris/ZXhhbXBsZTEuY29tL2U=': 'f',
          'example1.com/_uris/ZXhhbXBsZTEuY29tL2c=': 'example1.com/h'
        });
      });
    });

    it('reads pages from bootstrap', function () {
      // this is doing IO, so give it more time.
      this.slow(50);
      this.timeout(400);

      return fn('./test/fixtures/config/bootstrap.yaml', sitesFake[0]).then(function () {
        return db.pipeToPromise(db.list({prefix: 'example1.com/_pages', limit: -1}));
      }).then(JSON.parse).then(function (results) {
        expect(results).to.deep.equal({
          'example1.com/_pages/0': JSON.stringify({
            layout: 'example1.com/a/b',
            url: 'http://example1.com/x/y',
            body: 'example1.com/c/d',
            head: ['example1.com/e/f']
          })
        });
      });
    });

    it('reads users from bootstrap', function () {
      // this is doing IO, so give it more time.
      this.slow(50);
      this.timeout(400);

      return fn('./test/fixtures/config/bootstrap.yaml', sitesFake[0]).then(function () {
        return db.pipeToPromise(db.list({prefix: '/_users', limit: -1}));
      }).then(JSON.parse).then(function (results) {
        expect(results).to.deep.equal({
          '/_users/Zm9vQGJhci5jb21AYmF6': JSON.stringify({
            username: 'foo@bar.com',
            provider: 'baz',
            auth: 'foobarbaz'
          })
        });
      });
    });

    it('reads components from bootstrap', function () {
      // this is doing IO, so give it more time.
      this.slow(50);
      this.timeout(400);

      return fn('./test/fixtures/config/bootstrap.yaml', sitesFake[0]).then(function () {
        return db.pipeToPromise(db.list({prefix: 'example1.com/_components', limit: -1}));
      }).then(JSON.parse).then(function (results) {
        expect(results).to.deep.include({
          // instance data of components (prefixes all the way down)
          'example1.com/_components/image/instances/0': '{"src":"http://placekitten.com/400/600","alt":"adorable kittens"}',

          // note the prefix added
          'example1.com/_components/image/instances/1': '{"_ref":"example1.com/_components/image2"}',

          // note the prefix NOT added
          'example1.com/_components/image/instances/2': '{"_ref":"localhost/_components/what"}',

          // base data of components
          'example1.com/_components/image2': '{"src":"http://placekitten.com/400/600","alt":"adorable kittens"}'
        });
      });
    });
  });
});
