'use strict';

/**
 * Base-64 encode a string
 *
 * @param  {String} string
 * @return {String}
 */
function encode(string) {
  const buf = Buffer.from(string, 'utf8');

  return buf.toString('base64');
}

/**
 * Decode a Base-64 string to UTF-8
 *
 * @param  {String} string
 * @return {String}
 */
function decode(string) {
  const buf = Buffer.from(string, 'base64');

  return buf.toString('utf8');
}

module.exports.encode = encode;
module.exports.decode = decode;
