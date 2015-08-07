'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  var sandbox,
    basicHtml = '<html><head></head><body></body></html>',
    basicSection = '<section><header></header><footer></footer></section>',
    componentStyleHtml = '<html><head><link rel="stylesheet" type="text/css" href="a" /></head><body></body></html>',
    componentStyleSection = '<section><link rel="stylesheet" type="text/css" href="a" /><header></header><footer></footer></section>',
    componentScriptHtml = '<html><head></head><body><script type="text/javascript" src="a"></script></body></html>',
    componentScriptSection = '<section><header></header><footer></footer><script type="text/javascript" src="a"></script></section>';

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('appendTop', function () {
    var fn = lib[this.title];

    it('adds nothing to bottom of head when no components', function () {
      var result,
        data = [basicHtml];

      result = fn({components:[]})(data);

      expect(result).to.deep.equal(data);
    });

    it('adds nothing to top of root when no components', function () {
      var result,
        data = [basicSection];

      result = fn({components:[]})(data);

      expect(result).to.deep.equal(data);
    });

    it('adds to bottom of head', function () {
      var result,
        data = [basicHtml],
        expectedResult = [componentStyleHtml];

      result = fn({components:['a']})(data);

      expect(result).to.deep.equal(expectedResult);
    });

    it('adds to top of root', function () {
      var result,
        data = [basicSection],
        expectedResult = [componentStyleSection];

      result = fn({components:['a']})(data);

      expect(result).to.deep.equal(expectedResult);
    });
  });

  describe('appendBottom', function () {
    var fn = lib[this.title];

    it('adds nothing to bottom of body when no components', function () {
      var result,
        data = [basicHtml];

      result = fn({components:[]})(data);

      expect(result).to.deep.equal(data);
    });

    it('adds nothing to bottom of root when no components', function () {
      var result,
        data = [basicSection];

      result = fn({components:[]})(data);

      expect(result).to.deep.equal(data);
    });

    it('adds to bottom of body', function () {
      var result,
        data = [basicHtml],
        expectedResult = [componentScriptHtml];

      result = fn({components:['a']})(expectedResult);

      expect(result).to.deep.equal(data);
    });

    it('adds to bottom of root', function () {
      var result,
        data = [basicSection],
        expectedResult = [componentScriptSection];

      result = fn({components:['a']})(data);

      expect(result).to.deep.equal(expectedResult);
    });
  });
});