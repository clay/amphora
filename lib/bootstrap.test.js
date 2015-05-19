'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  bootstrap = require('./bootstrap'),
  db = require('./services/db'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  winston = require('winston');

describe(_.startCase(filename), function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    return db.clear();
  });

  afterEach(function () {
    sandbox.restore();
  });

  after(function () {
    //clean up
    return db.clear();
  });

  it('read basic components from bootstrap', function (done) {
    //report to the screen
    sandbox.mock(winston).expects('info').exactly(10);

    bootstrap('./test/fixtures/config/bootstrap.yaml').then(function (results) {
      expect(results).to.deep.equal([]);
      db.get('/components/image/instances/0').then(JSON.parse).done(function (results) {
        expect(results).to.deep.equal({
          src: 'http://placekitten.com/400/600',
          alt: 'adorable kittens'
        });
        sandbox.verify();
        done();
      });
    });
  });
});