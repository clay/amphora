'use strict';

var _ = require('lodash'),
  assertions = require('./assertions'),
  db = require('./db'),
  references = require('./references'),
  schema = require('./schema'),
  files = require('./files'),
  bluebird = require('bluebird'),
  log = require('./log'),
  chalk = require('chalk'),
  Flake = require('flake-idgen'),
  flake = new Flake();

_.mixin(require('lodash-ny-util'));

/**
 * Returns base64 unique id that's also sortable (by creation time)
 * @returns {String}
 */
function getUniqueId() {
  return flake.next().toString('base64');
}

/**
 * @param {string} ref
 * @returns {Function}
 */
function normalizeResults(ref) {
  return function (list) {
    if (!_.isArray(list)) {
      list = [list];
    }

    //put parent after children (parent could verify children exist, but children never has reference to parent)
    return bluebird.all(list).map(function (item) {
      assertions.isObject(item, item);

      //if just a value, make op
      if (!item.key && !item.value) {
        item = {
          type: 'put',
          key: ref,
          value: item
        };
      }

      if (!_.isString(item.type)) {
        item.type = 'put';
      }

      //if missing key, use ref
      if (!_.isString(item.key)) {
        item.key = ref;
      }

      //if they've given us an operation with a value
      if (_.isObject(item.value)) {
        item.value = JSON.stringify(item.value);
      } else {
        throw new Error('value must be object in ' + JSON.stringify(item));
      }
      return item;
    }).then(_.flattenDeep);
  };
}

function callImport(fn, ref, locals, err) {
  log.info(chalk.yellow(' --> Attempting import of ' + ref));
  return assertions.isPromise(fn(ref, locals, err), ref).then(normalizeResults(ref));
}

function getImporter(ref, data) {
  var componentName = schema.getComponentNameFromPath(ref),
    componentModule = files.getComponentModule(componentName),
    fn = componentModule && componentModule.import;

  if (fn) {
    return callImport.bind(null, fn, ref, data);
  } else {
    return _.constant({ type: 'put', key: ref, value: data });
  }
}


/**
 * @param ref
 * @param data
 * @returns Promise|Object
 */
function addComponent(ref, data) {
  assertions.exists(ref, 'reference');
  assertions.exists(data, 'data');

  var result,
    hasInstance = !!ref.match(/\/instances\//);

  //if no instance, add one
  if (!hasInstance) {
    ref += '/instances/' + getUniqueId();
  }

  if (hasInstance) {
    //if referring to an instance component, if it doesn't already exist, import it.
    result = references.getComponentData(ref, data)
      .then(_.constant([])) //exists; no import needed
      .catch(getImporter(ref, data)); //missing; import from component
  } else {
    //no chance this already exists, so no need to check for existence
    result = getImporter(ref, data)();
  }

  return result;
}

/**
 * @param {string} url
 * @param {string} layoutRef
 * @param {object} pageSpecific
 * @param {object} [locals]
 */
function addPage(url, layoutRef, pageSpecific, locals) {
  assertions.exists(url, 'uri');
  assertions.exists(layoutRef, 'layout reference', url);
  assertions.isObject(pageSpecific, 'page specific data', url);

  locals = _.defaults(locals || {}, {});

  console.log('addPage', arguments);

  return bluebird.join(
    references.getComponentData(layoutRef),
    bluebird.props(_.mapValues(pageSpecific, function (componentRef) {
      return addComponent(componentRef, locals);
    }))
  ).spread(function (layoutData, componentData) {
      var ops = [],
        pageData = _.defaults({layout: layoutRef}, _.mapValues(pageSpecific, function (value, key) {
          //the last thing in the array (if it exists) is the key of this thing.
          return _.last(componentData[key]).key;
        })),
        uri64 = new Buffer(url).toString('base64');



      //assert all positive
      assertions.isObject(layoutData, 'layout data');
      _.all(componentData, assertions.isObject);

      //components
      ops = ops.concat(_.flattenDeep(_.values(componentData)));

      //page
      ops.push({
        type: 'put',
        key: '/pages/' + uri64,
        value: JSON.stringify(pageData)
      });

      log.info('ops', require('util').inspect(ops));

      //all in batch, so one failure breaks all
      db.batch(ops, {}).then(function () {
        log.info('batch' + require('util').inspect(arguments, true, 5));
      });
    });
}

module.exports.addComponent = addComponent;
module.exports.addPage = addPage;
