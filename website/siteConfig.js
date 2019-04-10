/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const repoUrl = 'https://github.com/clay/amphora';

const siteConfig = {
  title: 'Amphora', // Title for your website.
  tagline: 'A new way to organize, edit, and deliver the web, one component at a time',
  url: 'https://clay.github.io', // Your website URL
  baseUrl: '/amphora/', // Base URL for your project */

  // Used for publishing and more
  projectName: 'Amphora',
  organizationName: 'amphoraplatform',

  // For no header links in the top nav bar -> headerLinks: [],
  headerLinks: [
    { doc: 'intro', label: 'Introduction' },
    { href: repoUrl, label: 'Github' }
  ],

  /* path to images for header/footer */
  headerIcon: 'img/amphora-logo.svg',
  footerIcon: '',
  favicon: '',

  /* Colors for website */
  colors: {
    primaryColor: '#99D3DF',
    secondaryColor: '#99D3DF',
  },

  // This copyright info is used in /core/Footer.js and blog RSS/Atom feeds.
  copyright: `Copyright © ${new Date().getFullYear()} New York Media`,

  highlight: {
    // Highlight.js theme to use for syntax highlighting in code blocks.
    theme: 'default',
  },

  // Add custom scripts here that would be placed in <script> tags.
  scripts: ['https://buttons.github.io/buttons.js'],

  docsSideNavCollapsible: true,
  // On page navigation for the current documentation page.
  onPageNav: 'separate',
  // No .html extensions for paths.
  cleanUrl: true,

  // Open Graph and Twitter card images.
  ogImage: '',
  twitterImage: ''
};

module.exports = siteConfig;
