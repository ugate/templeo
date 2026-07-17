import { defineConfig } from 'vitepress';

export default defineConfig({
 lang: 'en-US',
 title: 'templeo',
 description: 'Zero-dependency template engine built on native JavaScript template literals.',
 base: '/templeo/',
 cleanUrls: true,
 head: [
  ['link', { rel: 'icon', type: 'image/png', href: '/templeo/favicon-32x32.png' }]
 ],
//  ignoreDeadLinks: [
//   /^\/?api\/.*$/,
//   /^\.\/(Engine|Cachier|Director|Sandbox\.)/
//  ],
 themeConfig: {
  logo: '/favicon-32x32.png',
  siteTitle: 'templeo',
  nav: [
   { text: 'Guide', link: '/guide/1-basics' },
   { text: 'API', link: '/api/' },
   { text: 'GitHub', link: 'https://github.com/ugate/templeo' },
   { text: 'npm', link: 'https://www.npmjs.com/package/templeo' }
  ],
  sidebar: [
   {
    text: 'Guide',
    items: [
     { text: 'Overview', link: '/' },
     { text: 'The Basics', link: '/guide/1-basics' },
     { text: 'Cache', link: '/guide/2-cache' },
     { text: 'Examples', link: '/guide/3-examples' }
    ]
   },
   {
    text: 'API',
    items: [
     { text: 'API Reference', link: '/api/' }
    ]
   }
  ],
  socialLinks: [
   { icon: 'github', link: 'https://github.com/ugate/templeo' }
  ],
  search: {
   provider: 'local'
  },
  footer: {
   message: 'Released under the MIT License.',
   copyright: 'Copyright © ugate'
  }
 }
});
