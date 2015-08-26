'use strict';
module.exports = class UriParser {
  /**
   uri in the format ...<prefix>/components/<component_name>/instances/...@...
   */
  constructor(uri) {
    this.uri = uri;
    //First remove :// from the uri to simplify
    this.groups = /\/(.+\/)?components\/(.+)\/instances/.exec(uri.replace('://', ''));
  }

  /**
   * returns the version -uid, published-
   */
  version() {
    var atIndex = this.uri.indexOf('@');
    if (atIndex > 0) {
      return this.uri.substr(atIndex + 1);
    } else {
      return null;
    }
  }

  /**
   * returns the prefix or null
   */
  prefix() {
    if (this.groups && this.groups.length > 1 && this.groups[1]) {
      return this.groups[1].replace('/', '');
    } else {
      return null;
    }
  }

  /**
   * returns the component name
   */
  component() {
    if (this.groups && this.groups.length > 2 && this.groups[2]) {
      return this.groups[2];
    } else {
      return null;
    }
  }
};
