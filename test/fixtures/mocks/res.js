'use strict';

var _ = require('lodash'),
  Transform = require('stream').Transform;

module.exports = function (options) {
  options = options || {};
  var pipeData = '',
    res = new Transform();
  //if they pipe to here, pretend they're just doing a send for testing ease.
  res._transform = function (chunk, encoding, done) {
    pipeData += chunk;
    done();
  };
  res._flush = function (done) {
    res.send(pipeData);
    done();
  };

  //mock these methods
  res.status = _.constant(res);
  res.send = _.constant(res);
  res.json = function (json) {
    res.send(json);
    return res;
  };
  res.set = _.constant(res);
  res.pipe = _.constant(res);
  res.locals = {site: 'someSite'};

  //send status is a shortcut of express, pretend they're sending for testing ease
  res.sendStatus = function (code) {
    res.status(code);
    res.send('sendStatus: whatever');
    return res;
  };

  //options selects a formatter
  res.format = function (formatters) {
    formatters[options.formatter || 'default']();
    return res;
  };
  return res;
};


