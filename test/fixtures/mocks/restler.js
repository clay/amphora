'use strict';

function createRequest() {
  var request;

  request = {
    on() {
      return request;
    }
  };

  return request;
}

module.exports.createRequest = createRequest;