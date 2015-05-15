'use strict';
var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  composer = require('./composer'),
  db = require('./db'),
  bluebird = require('bluebird'),
  log = require('./log'),
  plex = require('multiplex-templates'),
  components = require('./controllers/components'),
  references = require('./references'),
  createMockReq = require('../test/fixtures/mocks/req'),
  createMockRes = require('../test/fixtures/mocks/res');

describe(_.startCase(filename), function () {
  var sandbox,
    mockSite = 'mockSite';

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  function expectNoLogging() {
    var mock = sandbox.mock(log);
    mock.expects('info').never();
    mock.expects('warn').never();
    mock.expects('error').never();
  }

  describe('renderComponent', function () {
    it('data not found', function (done) {
      //not called for 404 Not Found
      expectNoLogging();

      //should not fetch template if there is no data, that would be a waste
      sandbox.mock(components).expects('getTemplate').never();

      //should attempt to fetch the data, for sure.
      sandbox.mock(components).expects('get').once().returns(bluebird.reject(new Error('thing')));

      var mockRes = createMockRes();

      composer.renderComponent('/components/whatever', mockRes).done(function (result) {
        //should not be
        done(result);
      }, function () {
        sandbox.verify();
        done();
      });
    });

    it('data found', function (done) {
      //report what was served
      sandbox.mock(log).expects('info').once();

      //get the template that will be composed
      sandbox.mock(components).expects('getTemplate').once();

      //get the data that will be composed in the template
      sandbox.mock(components).expects('get').once().returns(bluebird.resolve({site: mockSite}));

      var mockRes = createMockRes();

      composer.renderComponent('/components/whatever', mockRes).done(function () {
        sandbox.verify();
        done();
      }, function (err) {
        done(err);
      });
    });
  });

  describe('renderPage', function () {
    it('basic case', function (done) {
      var res = createMockRes(),
        componentsMock = sandbox.mock(components);

      //THIS IS WHAT WE EXPECT FROM THE BASIC PROCESS:

      //1. look up page
      sandbox.mock(db).expects('get').once().returns(bluebird.resolve('{"layout":"/components/hey"}'));

      //2. get the data that will be composed in the template
      componentsMock.expects('get').once().returns(bluebird.resolve({}));

      //3. get the template that will be composed
      componentsMock.expects('getTemplate').once().returns('asdf');

      //4. rendering should happen (they should NOT try to send this on their own)
      sandbox.mock(plex).expects('render').once();
      sandbox.mock(res).expects('send').never();

      //5. log success
      sandbox.mock(log).expects('info').once();

      composer.renderPage('/pages/whatever', res).done(function () {
        sandbox.verify();
        done();
      }, function (error) {
        done(error);
      });
    });
  });

  describe('renderUri', function () {
    it('basic case', function (done) {
      var res = createMockRes(),
        resultRef = 'whatever or something';

      // when we find the new reference
      sandbox.mock(references).expects('getUriData').returns(bluebird.resolve(resultRef));

      //with these uri handlers
      composer.setUriRouteHandlers([
        {
          when: /^whatever/,
          handler: function (ref, res) {
            expect(ref).to.equal(resultRef);
            expect(res).to.equal(res);

            //it should handle it
            done();
          }
        }
      ]);

      composer.renderUri('/uris/asdf', res);
    });
  });

  it('passes Errors to Express', function (done) {
    var req = createMockReq(),
      res = createMockRes(),
      pathOnBase64 = '/uris/' + new Buffer(req.url).toString('base64');

    sandbox.mock(references).expects('getUriData')
      .once().withArgs(pathOnBase64)
      .returns(bluebird.reject(new Error('whatever')));

    composer(req, res, function (result) {
      expect(result).to.be.instanceOf(Error);
      sandbox.verify();
      done();
    });
  });


  it('gets page without query string', function (done) {
    var req = createMockReq(),
      res = createMockRes(),
      pathOnBase64 = '/uris/' + new Buffer('/some/url/here').toString('base64');

    req.url = '/some/url/here?some=query';
    sandbox.mock(references).expects('getUriData')
      .once().withArgs(pathOnBase64)
      .returns(bluebird.reject(new Error('not under test')));

    composer(req, res, function (result) {
      expect(result).to.be.instanceOf(Error);
      sandbox.verify();
      done();
    });
  });
});