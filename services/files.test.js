var files = require('./files'),
  expect = require('chai').expect;

describe('files', function () {
  var textSchema;

  before(function () {
    textSchema = files.getSchema('test/fixtures/text')
  });

  it('read basic schema', function () {
    console.log(textSchema);
  });
});