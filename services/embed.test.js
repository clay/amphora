'use strict';
var embed = require('./embed'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  glob = require('glob'),
  engines = require('./engines');

describe('Embed Service', function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('should render nunjucks', function () {
    var html = '<strong>foo</strong>';

    sandbox.stub(glob, 'sync').returns(['foo.nunjucks']);
    sandbox.stub(engines.nunjucks, 'render').returns(html);

    expect(embed.render('foo', 'foo')).to.equal(html);
  });
});