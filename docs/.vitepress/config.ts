import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(defineConfig({
  title: 'AT Protocol MCP Server',
  description: 'Comprehensive MCP server for AT Protocol integration',
  base: '/atproto-mcp/',
  ignoreDeadLinks: true, // Ignore dead links during development
  
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/atproto-mcp/favicon.svg' }],
    ['link', { rel: 'icon', type: 'image/png', href: '/atproto-mcp/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#1d4ed8' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'en' }],
    ['meta', { property: 'og:title', content: 'AT Protocol MCP Server' }],
    ['meta', { property: 'og:site_name', content: 'AT Protocol MCP Server' }],
    ['meta', { property: 'og:image', content: '/atproto-mcp/og-image.svg' }],
    ['meta', { property: 'og:url', content: 'https://cameronrye.github.io/atproto-mcp/' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API Reference', link: '/api/' },
      { text: 'Examples', link: '/examples/basic-usage' },
      {
        text: 'Resources',
        items: [
          { text: 'FAQ', link: '/FAQ' },
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
            { text: 'Deployment', link: '/guide/deployment' },
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          ],
        },
        {
          text: 'Diagrams',
          items: [
            { text: 'Architecture', link: '/diagrams/architecture' },
            { text: 'Flows', link: '/diagrams/flows' },
            { text: 'Sequences', link: '/diagrams/sequences' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
          ],
        },
        {
          text: 'Social Operations',
          collapsed: true,
          items: [
            { text: 'Create Post', link: '/api/tools/create-post' },
            { text: 'Create Rich Text Post', link: '/api/tools/create-rich-text-post' },
            { text: 'Reply to Post', link: '/api/tools/reply-to-post' },
            { text: 'Like Post', link: '/api/tools/like-post' },
            { text: 'Unlike Post', link: '/api/tools/unlike-post' },
            { text: 'Repost', link: '/api/tools/repost' },
            { text: 'Unrepost', link: '/api/tools/unrepost' },
          ],
        },
        {
          text: 'User Management',
          collapsed: true,
          items: [
            { text: 'Follow User', link: '/api/tools/follow-user' },
            { text: 'Unfollow User', link: '/api/tools/unfollow-user' },
            { text: 'Get User Profile', link: '/api/tools/get-user-profile' },
            { text: 'Update Profile', link: '/api/tools/update-profile' },
            { text: 'Block User', link: '/api/tools/block-user' },
            { text: 'Unblock User', link: '/api/tools/unblock-user' },
            { text: 'Mute User', link: '/api/tools/mute-user' },
            { text: 'Unmute User', link: '/api/tools/unmute-user' },
          ],
        },
        {
          text: 'Data Retrieval',
          collapsed: true,
          items: [
            { text: 'Search Posts', link: '/api/tools/search-posts' },
            { text: 'Get Timeline', link: '/api/tools/get-timeline' },
            { text: 'Get Followers', link: '/api/tools/get-followers' },
            { text: 'Get Follows', link: '/api/tools/get-follows' },
            { text: 'Get Notifications', link: '/api/tools/get-notifications' },
            { text: 'Get Thread', link: '/api/tools/get-thread' },
            { text: 'Get Custom Feed', link: '/api/tools/get-custom-feed' },
          ],
        },
        {
          text: 'Content Management',
          collapsed: true,
          items: [
            { text: 'Delete Post', link: '/api/tools/delete-post' },
            { text: 'Upload Image', link: '/api/tools/upload-image' },
            { text: 'Upload Video', link: '/api/tools/upload-video' },
            { text: 'Generate Link Preview', link: '/api/tools/generate-link-preview' },
          ],
        },
        {
          text: 'OAuth Authentication',
          collapsed: true,
          items: [
            { text: 'Start OAuth Flow', link: '/api/tools/start-oauth-flow' },
            { text: 'Handle OAuth Callback', link: '/api/tools/handle-oauth-callback' },
            { text: 'Refresh OAuth Tokens', link: '/api/tools/refresh-oauth-tokens' },
            { text: 'Revoke OAuth Tokens', link: '/api/tools/revoke-oauth-tokens' },
          ],
        },
        {
          text: 'Moderation',
          collapsed: true,
          items: [
            { text: 'Report Content', link: '/api/tools/report-content' },
            { text: 'Report User', link: '/api/tools/report-user' },
          ],
        },
        {
          text: 'Real-time Streaming',
          collapsed: true,
          items: [
            { text: 'Start Streaming', link: '/api/tools/start-streaming' },
            { text: 'Stop Streaming', link: '/api/tools/stop-streaming' },
            { text: 'Get Streaming Status', link: '/api/tools/get-streaming-status' },
            { text: 'Get Recent Events', link: '/api/tools/get-recent-events' },
          ],
        },
        {
          text: 'Lists Management',
          collapsed: true,
          items: [
            { text: 'Create List', link: '/api/tools/create-list' },
            { text: 'Add to List', link: '/api/tools/add-to-list' },
            { text: 'Remove from List', link: '/api/tools/remove-from-list' },
            { text: 'Get List', link: '/api/tools/get-list' },
          ],
        },
        {
          text: 'Resources',
          collapsed: true,
          items: [
            { text: 'Timeline', link: '/api/resources/timeline' },
            { text: 'Profile', link: '/api/resources/profile' },
            { text: 'Notifications', link: '/api/resources/notifications' },
          ],
        },
        {
          text: 'Types',
          collapsed: true,
          items: [
            { text: 'Core Types', link: '/api/types/core' },
            { text: 'Configuration Types', link: '/api/types/configuration' },
            { text: 'Parameter Types', link: '/api/types/parameters' },
            { text: 'Error Types', link: '/api/types/errors' },
            { text: 'Utility Types', link: '/api/types/utilities' },
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
      copyright: 'Copyright © 2025 <a href="https://rye.dev/" target="_blank" rel="noopener noreferrer">Cameron Rye</a>',
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

  // Mermaid configuration
  mermaid: {
    // Optional: Configure mermaid theme and other options
    theme: 'default',
  },

  // Optional: Configure mermaid plugin options
  mermaidPlugin: {
    class: 'mermaid',
  },
}));
