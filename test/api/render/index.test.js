'use strict';

const sinon = require('sinon'),
  render = require('../../../lib/render'),
  componentsRoutes = require('../../../lib/routes/_components'),
  pagesRoutes = require('../../../lib/routes/_pages'),
  layoutRoutes = require('../../../lib/routes/_layouts');

describe('Custom Rendering', function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(render, 'rendererExists');
    sandbox.stub(render, 'renderComponent');
    sandbox.stub(render, 'renderPage');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('Components Render', function () {
    it('calls the render function if a renderer is found to match the extension', function () {
      const fn = componentsRoutes.route.getExtension;

      render.rendererExists.returns(true);
      sandbox.stub(componentsRoutes.route, 'render');
      fn({ params: {ext: 'html' }});
      sinon.assert.calledOnce(componentsRoutes.route.render);
    });

    it('calls the `renderComponent` function', function () {
      const fn = componentsRoutes.route.render,
        typeSpy = sinon.spy(),
        sendSpy = sinon.spy();

      render.renderComponent.returns(Promise.resolve({type: 'text/html', output: 'some html' }));
      fn({ query: {} }, { type: typeSpy, send: sendSpy });
      sinon.assert.calledOnce(render.renderComponent);
    });
  });

  describe('Page Render', function () {
    it('calls the render function if a renderer is found to match the extension', function () {
      const fn = pagesRoutes.route.extension;

      render.rendererExists.returns(true);
      sandbox.stub(pagesRoutes.route, 'render');
      fn({ params: {ext: 'html' }});
      sinon.assert.calledOnce(pagesRoutes.route.render);
    });

    it('calls the `renderComponent` function', function () {
      const fn = pagesRoutes.route.render,
        typeSpy = sinon.spy(),
        sendSpy = sinon.spy();

      render.renderPage.returns(Promise.resolve({type: 'text/html', output: 'some html' }));
      fn({}, { type: typeSpy, send: sendSpy });
      sinon.assert.calledOnce(render.renderPage);
    });
  });

  describe('Layout Render', function () {
    it('calls the render function if a renderer is found to match the extension', function () {
      const fn = layoutRoutes.route.getExtension;

      render.rendererExists.returns(true);
      sandbox.stub(layoutRoutes.route, 'render');
      fn({ params: {ext: 'html' }});
      sinon.assert.calledOnce(layoutRoutes.route.render);
    });

    it('calls the `renderComponent` function', function () {
      const fn = layoutRoutes.route.render,
        typeSpy = sinon.spy(),
        sendSpy = sinon.spy();

      render.renderComponent.returns(Promise.resolve({type: 'text/html', output: 'some html' }));
      fn({}, { type: typeSpy, send: sendSpy });
      sinon.assert.calledOnce(render.renderComponent);
    });
  });
});
