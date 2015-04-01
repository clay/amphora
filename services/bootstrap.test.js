var bootstrap = require('./bootstrap'),
  db = require('./db'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  winston = require('winston');

describe('bootstrap', function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('read basic components from bootstrap', function (done) {
    //report to the screen
    sandbox.mock(winston).expects('info').exactly(10);

    bootstrap('./test/fixtures/config/bootstrap.yaml').then(function (results) {
      expect(results).to.deep.equal([]);
      db.get('/components/image/instances/0').then(JSON.parse).done(function (results) {
        expect(results).to.deep.equal({
          src: 'http://placekitten.com/400/600',
          alt: 'adorable kittens',
          _ref: '/components/image/instances/0'
        });
        sandbox.verify();
        done();
      });
    });
  });
});