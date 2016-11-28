'use strict';

const bluebird = require('bluebird'),
  sinon = require('sinon'),
  _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  db = require('../services/db');

describe(_.startCase(filename), function () {
  describe(filename, function () {
    var sandbox;

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      sandbox.stub(db);
      db.get.returns(bluebird.resolve(null));
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('filterRefs', function () {
      let fn = lib[this.title];

      it('takes an operation and removes refs from it', function () {
        let op = {
          type: 'put',
          key: 'www.vulture.com/components/article/instances/section-test',
          value: { primaryHeadline: 'some headline', content: [], tags: {}, sideShare: {}, section: 'some-section', slug: 'some-slug', _ref: 'Reference thing' }
        };

        expect(fn(op)).to.deep.equal({
          type: 'put',
          key: 'www.vulture.com/components/article/instances/section-test',
          value: { primaryHeadline: 'some headline', content: [], tags: {}, sideShare: {}, section: 'some-section', slug: 'some-slug' }
        });
      });
    });

    describe('isOpForInstance', function () {
      let fn = lib[this.title];

      it('takes an operation and returns true if its key is an article component ref', function () {
        let op = {
          type: 'put',
          key: 'www.vulture.com/components/article/instances/section-test',
          value: '{}'
        };

        expect(fn(op)).to.equal(true);
      });

      it('takes an operation and returns false if its key is not an article component ref', function () {
        let op = {
          type: 'put',
          key: 'www.vulture.com/components/sailthru-personalization-pixel',
          value: '{}'
        };

        expect(fn(op)).to.equal(false);
      });
    });

    describe('isOpForPage', function () {
      let fn = lib[this.title];

      it('takes an operation and returns true if its key is a page ref', function () {
        let op = {
          type: 'put',
          key: 'www.nymag.com/scienceofus/pages/cit0k8p6x0000r7reetki2i6k@published',
          value: '{}'
        };

        expect(fn(op)).to.equal(true);
      });

      it('takes an operation and returns false if its key is not a page ref', function () {
        let op = {
          type: 'put',
          key: 'www.vulture.com/components/sailthru-personalization-pixel',
          value: '{}'
        };

        expect(fn(op)).to.equal(false);
      });
    });

    describe('isOpForPut', function () {
      let fn = lib[this.title];

      it('takes an operation and returns true if its type is a put operation', function () {
        let op = {
          type: 'put',
          key: 'www.nymag.com/scienceofus/pages/cit0k8p6x0000r7reetki2i6k@published',
          value: '{}'
        };

        expect(fn(op)).to.equal(true);
      });

      it('takes an operation and returns false if its key is not a put operation', function () {
        let op = {
          type: 'get',
          key: 'www.vulture.com/components/sailthru-personalization-pixel',
          value: '{}'
        };

        expect(fn(op)).to.equal(false);
      });
    });

    describe('isPublished', function () {
      let fn = lib[this.title];

      it('takes an operation and returns true if its key has a published ref', function () {
        let op = {
          type: 'put',
          key: 'www.nymag.com/scienceofus/pages/cit0k8p6x0000r7reetki2i6k@published',
          value: '{}'
        };

        expect(fn(op)).to.equal(true);
      });

      it('takes an operation and returns false if its key does not have a published ref', function () {
        let op = {
          type: 'get',
          key: 'www.vulture.com/components/sailthru-personalization-pixel',
          value: '{}'
        };

        expect(fn(op)).to.equal(false);
      });
    });

    describe('isScheduled', function () {
      let fn = lib[this.title];

      it('takes an operation and returns true if its key has a scheduled ref', function () {
        let op = {
          type: 'put',
          key: 'www.nymag.com/scienceofus/pages/cit0k8p6x0000r7reetki2i6k@scheduled',
          value: '{}'
        };

        expect(fn(op)).to.equal(true);
      });

      it('takes an operation and returns false if its key does not have a scheduled ref', function () {
        let op = {
          type: 'get',
          key: 'www.vulture.com/components/sailthru-personalization-pixel',
          value: '{}'
        };

        expect(fn(op)).to.equal(false);
      });
    });

    describe('isEditable', function () {
      let fn = lib[this.title];

      it('takes an operation and returns true if its key has an editable ref (no version)', function () {
        let op = {
          type: 'put',
          key: 'www.nymag.com/scienceofus/pages/cit0k8p6x0000r7reetki2i6k',
          value: '{}'
        };

        expect(fn(op)).to.equal(true);
      });

      it('takes an operation and returns false if its key has a published ref', function () {
        let op = {
          type: 'put',
          key: 'www.vulture.com/components/sailthru-personalization-pixel@published',
          value: '{}'
        };

        expect(fn(op)).to.equal(false);
      });
    });

  });
});
