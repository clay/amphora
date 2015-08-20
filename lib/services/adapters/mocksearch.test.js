'use strict';

var _ = require('lodash'),
  bluebird = require('bluebird'),
  expect = require('chai').expect,
  mock = require("./mocksearch");

describe('Mock search tests', function () {

  it('can get mock value', function (done) {
    mock.get('', '', '1').then(function(r){
      expect(r).to.deep.equal({});
      done();
    });
  });

  it('can get put', function (done) {
    mock.put('', '', '1', {}).then(function(){
      done();
    });
  });

  it('can get delete', function (done) {
    mock.delete('', '', '1').then(function(){
      done();
    });
  });

  it('can get delete indices', function (done) {
    mock.deleteIndices('').then(function(){
      done();
    });
  });

  it('can search', function (done) {
    mock.search('', '', {}, {}).then(function(r){
      expect(r).to.deep.equal({items:[], total:0});
      done();
    });
  });

  it('can check if index exists', function (done) {
    mock.hasIndex('').then(function(r){
      expect(r).to.be.true;
      done();
    });
  });

  it('can create index', function (done) {
    mock.createIndex('', {}).then(function(){
      done();
    });
  });


  it('can batch', function (done) {
    mock.batch({}).then(function(){
      done();
    });
  });



});