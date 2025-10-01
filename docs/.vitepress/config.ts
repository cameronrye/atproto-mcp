import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'AT Protocol MCP Server',
  description: 'Comprehensive MCP server for AT Protocol integration',
  base: '/atproto-mcp/',
  ignoreDeadLinks: true, // Ignore dead links during development
  
  head: [
    ['link', { rel: 'icon', href: '/atproto-mcp/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#1d4ed8' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'en' }],
    ['meta', { property: 'og:title', content: 'AT Protocol MCP Server' }],
    ['meta', { property: 'og:site_name', content: 'AT Protocol MCP Server' }],
    ['meta', { property: 'og:image', content: '/atproto-mcp/og-image.png' }],
    ['meta', { property: 'og:url', content: 'https://cameronrye.github.io/atproto-mcp/' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API Reference', link: '/api/tools' },
      { text: 'Examples', link: '/examples/basic-usage' },
      {
        text: 'v0.1.0',
        items: [
          { text: 'Changelog', link: '/changelog' },
          { text: 'Contributing', link: '/contributing' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Authentication', link: '/guide/authentication' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'MCP Protocol', link: '/guide/mcp-protocol' },
            { text: 'AT Protocol', link: '/guide/at-protocol' },
            { text: 'Tools & Resources', link: '/guide/tools-resources' },
            { text: 'Error Handling', link: '/guide/error-handling' },
          ],
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Custom Tools', link: '/guide/custom-tools' },
            { text: 'Rate Limiting', link: '/guide/rate-limiting' },
            { text: 'Security', link: '/guide/security' },
            { text: 'Performance', link: '/guide/performance' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Tools', link: '/api/tools' },
            { text: 'Resources', link: '/api/resources' },
            { text: 'Prompts', link: '/api/prompts' },
            { text: 'Types', link: '/api/types' },
            { text: 'Errors', link: '/api/errors' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Basic Usage', link: '/examples/basic-usage' },
            { text: 'Social Operations', link: '/examples/social-operations' },
            { text: 'Content Management', link: '/examples/content-management' },
            { text: 'Real-time Data', link: '/examples/real-time-data' },
            { text: 'Custom Integration', link: '/examples/custom-integration' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/cameronrye/atproto-mcp' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 Cameron Rye',
    },

    editLink: {
      pattern: 'https://github.com/cameronrye/atproto-mcp/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    search: {
      provider: 'local',
    },

    outline: {
      level: [2, 3],
    },
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    lineNumbers: true,
  },

  vite: {
    define: {
      __VUE_OPTIONS_API__: false,
    },
  },
});
