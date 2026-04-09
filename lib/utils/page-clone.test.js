'use strict';

const _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  { normalizePageCloneData } = require('./' + filename);

describe(_.startCase(filename), function () {
  describe('normalizePageCloneData', function () {
    it('resets top-level fields from schema values', function () {
      const result = normalizePageCloneData({
        headline: 'Original headline',
        publishDate: '2020-01-01T00:00:00.000Z',
        nested: {
          publishDate: 'leave nested values alone'
        }
      }, {
        _resetOnPageClone: {
          publishDate: null,
          headline: 'Copied headline'
        }
      });

      expect(result).to.deep.equal({
        data: {
          headline: 'Copied headline',
          publishDate: null,
          nested: {
            publishDate: 'leave nested values alone'
          }
        },
        conflictingFields: []
      });
    });

    it('omits top-level fields from cloned data', function () {
      const result = normalizePageCloneData({
        headline: 'Original headline',
        publishDate: '2020-01-01T00:00:00.000Z',
        firstPublishedAt: '2020-01-02T00:00:00.000Z'
      }, {
        _omitOnPageClone: ['publishDate', 'firstPublishedAt']
      });

      expect(result).to.deep.equal({
        data: {
          headline: 'Original headline'
        },
        conflictingFields: []
      });
    });

    it('applies resets before omits and reports conflicting fields', function () {
      const result = normalizePageCloneData({
        publishDate: '2020-01-01T00:00:00.000Z',
        teaser: 'copy me'
      }, {
        _resetOnPageClone: {
          publishDate: null,
          teaser: 'reset before omit'
        },
        _omitOnPageClone: ['publishDate', 'teaser']
      });

      expect(result).to.deep.equal({
        data: {},
        conflictingFields: ['publishDate', 'teaser']
      });
    });

    it('ignores invalid clone schema directives', function () {
      const data = {
        publishDate: '2020-01-01T00:00:00.000Z'
      };

      expect(normalizePageCloneData(data, {
        _resetOnPageClone: [],
        _omitOnPageClone: 'publishDate'
      })).to.deep.equal({
        data,
        conflictingFields: []
      });
    });
  });
});
