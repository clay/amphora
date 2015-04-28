'use strict';

var _ = require('lodash'),
  is = require('./assert-is'),
  db = require('./db'),
  references = require('./references'),
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
      is.object(item, item);

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

function callImport(fn, ref, data, locals, err) {
  log.info(chalk.yellow(' --> Attempting import of ' + ref));
  return is.promise(fn(ref, data, locals, err), ref).then(normalizeResults(ref));
}

/**
 * Get a function that will import their data
 * @param ref
 * @param data
 * @param [locals]  Extra information that components might need.
 * @returns {*}
 */
function getImporter(ref, data, locals) {
  var result,
    componentName = references.getComponentName(ref),
    componentModule = files.getComponentModule(componentName),
    fn = componentModule && componentModule.import;



  if (fn) {
    //run import function with everything we were given
    result =  callImport.bind(null, fn, ref, data, locals);
  } else if (data) {
    //if they do not provide an import function, but provide data, assume that's what they want to import
    result = _.constant({ type: 'put', key: ref, value: data });
  } else {
    //pretend, because it will simplify their assumptions in import scripts
    result = _.noop;
  }

  return result;
}


/**
 * @param ref
 * @param [data]  Data provided for this _specific_ component.
 * @param [locals]  Extra data that all imported components might need.
 * @returns Promise|Object
 */
function addComponent(ref, data, locals) {
  is(ref, 'reference');

  var result, importer,
    hasInstance = !!ref.match(/\/instances\//);

  //if no instance, add one
  if (!hasInstance) {
    ref += '/instances/' + getUniqueId();
  }

  importer = getImporter(ref, data, locals);

  if (hasInstance) {
    //if referring to an instance component, if it doesn't already exist, import it.
    result = references.getComponentData(ref, locals)
      .then(_.constant([])) //exists; no import needed
      .catch(importer); //missing; import from component
  } else {
    //no chance this already exists, so no need to check for existence
    result = importer();
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
  is(url, 'uri');
  is(layoutRef, 'layout reference', url);
  is.object(pageSpecific, 'page specific data', url);

  locals = _.defaults(locals || {}, {});

  return bluebird.join(
    references.getComponentData(layoutRef),
    bluebird.props(_.mapValues(pageSpecific, function (componentRef) {
      //at the root level of a layout there is no data yet, just locals; They'll have to fetch it themselves if they need to.
      return addComponent(componentRef, null, locals);
    }))
  ).spread(function (layoutData, componentData) {
      var ops = [],
        pageData = _.defaults({layout: layoutRef}, _.mapValues(pageSpecific, function (value, key, obj) {
          //the last thing in the array (if it exists) is the key of this thing.
          var lastOp = is(_.last(componentData[key]), 'return value from import of "' + key + '" and ' + obj[key]);

          is(lastOp, 'return value from import of ' + obj[key]);

          return lastOp.key;
        })),
        uri64 = new Buffer(url).toString('base64');



      //assert all positive
      is.object(layoutData, 'layout data');
      _.all(componentData, is.object);

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
