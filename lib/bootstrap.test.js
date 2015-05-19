'use strict';

var _ = require('lodash'),
  fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  filename = __filename.split('/').pop().split('.').shift(),
  bootstrap = require('./bootstrap'),
  db = require('./services/db'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  winston = require('winston');

describe(_.startCase(filename), function () {
  var sandbox,
    bootstrapFake;

  before(function () {
    this.timeout(400);
    bootstrapFake = yaml.safeLoad(fs.readFileSync(path.resolve('./test/fixtures/config/bootstrap.yaml'), 'utf8'));
  });

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

  it('read basic components from bootstrap', function () {
    //this is doing IO, so give it more time.
    this.slow(50);
    this.timeout(400);

    sandbox.stub(winston);
    sandbox.stub(fs, 'readFileSync', '');
    sandbox.stub(path, 'resolve', '');
    sandbox.mock(yaml).expects('safeLoad').returns(bootstrapFake);

    return bootstrap('./test/fixtures/config/bootstrap.yaml').then(function () {
      return db.get('/components/image/instances/0')
        .then(JSON.parse)
        .then(function (results) {
          expect(results).to.deep.equal({
            src: 'http://placekitten.com/400/600',
            alt: 'adorable kittens'
          });
          sandbox.verify();
        });
    });
  });
});