var schema = require('./schema'),
  db = require('./db'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  bluebird = require('bluebird');

describe('schema', function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('read basic schema', function () {
    var textSchema = schema.getSchema('test/fixtures/text');

    expect(textSchema).to.deep.equal({
      name: {
        _type: 'text',
        _required: true
      },
      areas: {
        body: {
          _type: 'component-list'
        }
      }
    });
  });

  describe('getComponentNameFromPath', function () {
    it('finds /components/name', function () {
      var result = schema.getComponentNameFromPath('/components/name');

      expect(result).to.equal('name');
    });
    it('finds /components/name/', function () {
      var result = schema.getComponentNameFromPath('/components/name/');

      expect(result).to.equal('name');
    });
    it('finds /components/name/instances/id', function () {
      var result = schema.getComponentNameFromPath('/components/name/instances/id');

      expect(result).to.equal('name');
    });
    it('finds /components/name.ext', function () {
      var result = schema.getComponentNameFromPath('/components/name.ext');

      expect(result).to.equal('name');
    });
  });

  it('getSchemaComponents gets all components', function () {
    var result = schema.getSchemaComponents('test/fixtures/text');

    expect(result).to.deep.equal([
      {
        _type:'text',
        _required: true
      },
      {
        _type:'component-list'
      }
    ]);
  });

  it('resolveDataReferences looks up references', function (done) {
    var mock,
      data = {
        a: {_ref:'b'},
        c: {d: {_ref:'e'}}
      };

    mock = sandbox.mock(db);
    mock.expects('get').withArgs('b').once().returns(bluebird.resolve(JSON.stringify({g: 'h'})));
    mock.expects('get').withArgs('e').once().returns(bluebird.resolve(JSON.stringify({i: 'j'})));

    schema.resolveDataReferences(data).done(function (result) {
      sandbox.verify();
      expect(result).to.deep.equal({
        a: { _ref: 'b', g: 'h' },
        c: { d: { _ref: 'e', i: 'j' } }
      });
      done()
    });
  });

  it('resolveDataReferences looks up references recursively', function (done) {
    var mock,
      data = {
        a: {_ref:'b'},
        c: {d: {_ref:'e'}}
      };

    mock = sandbox.mock(db);
    mock.expects('get').withArgs('b').once().returns(bluebird.resolve(JSON.stringify({g: 'h'})));
    mock.expects('get').withArgs('e').once().returns(bluebird.resolve(JSON.stringify({i: 'j', 'k': {_ref:'m'}})));
    mock.expects('get').withArgs('m').once().returns(bluebird.resolve(JSON.stringify({n: 'o'})));

    schema.resolveDataReferences(data).done(function (result) {
      sandbox.verify();
      expect(result).to.deep.equal({
        a: { _ref: 'b', g: 'h' },
        c: { d: {
          _ref: 'e',
          i: 'j' ,
          k: {
            _ref: 'm',
            n: 'o' //we just recursively looked this up from another lookup
          }
        } }
      });
      done()
    });
  });
});