import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(
  defineConfig({
    title: 'AT Protocol MCP Server',
    description: 'Comprehensive MCP server for AT Protocol integration',
    base: '/atproto-mcp/',
    ignoreDeadLinks: false, // Fail the build on broken internal links

    head: [
      // Favicons
      ['link', { rel: 'icon', type: 'image/svg+xml', href: '/atproto-mcp/favicon.svg' }],
      ['link', { rel: 'icon', type: 'image/png', href: '/atproto-mcp/logo.svg' }],
      ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/atproto-mcp/logo.svg' }],

      // Theme and viewport
      ['meta', { name: 'theme-color', content: '#1d4ed8' }],
      ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1.0' }],

      // SEO Meta Tags
      [
        'meta',
        {
          name: 'description',
          content:
            'Comprehensive MCP server for AT Protocol integration, enabling LLMs to interact directly with the AT Protocol ecosystem. Build intelligent social media bots and applications.',
        },
      ],
      [
        'meta',
        {
          name: 'keywords',
          content:
            'MCP, Model Context Protocol, AT Protocol, Bluesky, LLM, AI, TypeScript, social networking, API integration',
        },
      ],
      ['meta', { name: 'author', content: 'Cameron Rye' }],
      ['meta', { name: 'robots', content: 'index, follow' }],
      ['link', { rel: 'canonical', href: 'https://cameronrye.github.io/atproto-mcp/' }],

      // Open Graph / Facebook
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:locale', content: 'en_US' }],
      ['meta', { property: 'og:site_name', content: 'AT Protocol MCP Server' }],
      [
        'meta',
        { property: 'og:title', content: 'AT Protocol MCP Server - Comprehensive LLM Integration' },
      ],
      [
        'meta',
        {
          property: 'og:description',
          content:
            'Enable LLMs to interact directly with the AT Protocol ecosystem through a powerful Model Context Protocol server. Build intelligent social media bots and applications.',
        },
      ],
      ['meta', { property: 'og:url', content: 'https://cameronrye.github.io/atproto-mcp/' }],
      [
        'meta',
        { property: 'og:image', content: 'https://cameronrye.github.io/atproto-mcp/og-image.png' },
      ],
      ['meta', { property: 'og:image:width', content: '1200' }],
      ['meta', { property: 'og:image:height', content: '630' }],
      ['meta', { property: 'og:image:alt', content: 'AT Protocol MCP Server Logo' }],
      ['meta', { property: 'og:image:type', content: 'image/png' }],

      // Twitter Card
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['meta', { name: 'twitter:site', content: '@cameronrye' }],
      ['meta', { name: 'twitter:creator', content: '@cameronrye' }],
      [
        'meta',
        {
          name: 'twitter:title',
          content: 'AT Protocol MCP Server - Comprehensive LLM Integration',
        },
      ],
      [
        'meta',
        {
          name: 'twitter:description',
          content:
            'Enable LLMs to interact directly with the AT Protocol ecosystem through a powerful Model Context Protocol server.',
        },
      ],
      [
        'meta',
        { name: 'twitter:image', content: 'https://cameronrye.github.io/atproto-mcp/og-image.png' },
      ],
      ['meta', { name: 'twitter:image:alt', content: 'AT Protocol MCP Server Logo' }],

      // JSON-LD Structured Data
      [
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'AT Protocol MCP Server',
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'Cross-platform',
          description:
            'Comprehensive MCP server for AT Protocol integration, enabling LLMs to interact directly with the AT Protocol ecosystem',
          url: 'https://cameronrye.github.io/atproto-mcp/',
          author: {
            '@type': 'Person',
            name: 'Cameron Rye',
            url: 'https://rye.dev/',
          },
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
          softwareVersion: '0.3.0',
          programmingLanguage: 'TypeScript',
          codeRepository: 'https://github.com/cameronrye/atproto-mcp',
          license: 'https://opensource.org/licenses/MIT',
        }),
      ],

      // Additional JSON-LD for Organization
      [
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'AT Protocol MCP Server',
          url: 'https://cameronrye.github.io/atproto-mcp/',
          description: 'Documentation for AT Protocol MCP Server',
          publisher: {
            '@type': 'Person',
            name: 'Cameron Rye',
            url: 'https://rye.dev/',
          },
        }),
      ],
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
            text: 'Deployment & Operations',
            items: [
              { text: 'Deployment', link: '/guide/deployment' },
              { text: 'Troubleshooting', link: '/guide/troubleshooting' },
            ],
          },
          {
            text: 'Reference',
            items: [
              { text: 'Experimental & Roadmap', link: '/guide/experimental' },
              { text: 'Architecture & Diagrams', link: '/diagrams/architecture' },
            ],
          },
        ],
        '/api/': [
          {
            text: 'API Reference',
            items: [{ text: 'Overview', link: '/api/' }],
          },
          {
            text: 'Social Operations',
            collapsed: true,
            items: [
              { text: 'Create Post', link: '/api/tools/create-post' },
              { text: 'Create Thread', link: '/api/tools/create-thread' },
              { text: 'Reply to Post', link: '/api/tools/reply-to-post' },
              { text: 'Like Post', link: '/api/tools/like-post' },
              { text: 'Unlike Post', link: '/api/tools/unlike-post' },
              { text: 'Repost', link: '/api/tools/repost' },
              { text: 'Unrepost', link: '/api/tools/unrepost' },
            ],
          },
          {
            text: 'Users & Graph',
            collapsed: true,
            items: [
              { text: 'Follow User', link: '/api/tools/follow-user' },
              { text: 'Unfollow User', link: '/api/tools/unfollow-user' },
              { text: 'Get User Profile', link: '/api/tools/get-user-profile' },
              { text: 'Update Profile', link: '/api/tools/update-profile' },
              { text: 'Search Actors', link: '/api/tools/search-actors' },
              { text: 'Get User Connections', link: '/api/tools/get-user-connections' },
              { text: 'Block User', link: '/api/tools/block-user' },
              { text: 'Unblock User', link: '/api/tools/unblock-user' },
              { text: 'Mute User', link: '/api/tools/mute-user' },
              { text: 'Unmute User', link: '/api/tools/unmute-user' },
            ],
          },
          {
            text: 'Content & Feeds',
            collapsed: true,
            items: [
              { text: 'Search Posts', link: '/api/tools/search-posts' },
              { text: 'Get Timeline', link: '/api/tools/get-timeline' },
              { text: 'Get Author Feed', link: '/api/tools/get-author-feed' },
              { text: 'Get Custom Feed', link: '/api/tools/get-custom-feed' },
              { text: 'Get Notifications', link: '/api/tools/get-notifications' },
              {
                text: 'Mark Notifications Seen',
                link: '/api/tools/mark-notifications-seen',
              },
              { text: 'Delete Post', link: '/api/tools/delete-post' },
            ],
          },
          {
            text: 'Direct Messages',
            collapsed: true,
            items: [
              { text: 'List Conversations', link: '/api/tools/list-conversations' },
              {
                text: 'Get Conversation Messages',
                link: '/api/tools/get-conversation-messages',
              },
              { text: 'Send Direct Message', link: '/api/tools/send-direct-message' },
            ],
          },
          {
            text: 'Bookmarks',
            collapsed: true,
            items: [
              { text: 'Add Bookmark', link: '/api/tools/add-bookmark' },
              { text: 'Remove Bookmark', link: '/api/tools/remove-bookmark' },
              { text: 'Get Bookmarks', link: '/api/tools/get-bookmarks' },
            ],
          },
          {
            text: 'Media',
            collapsed: true,
            items: [
              { text: 'Upload Image', link: '/api/tools/upload-image' },
              { text: 'Upload Video', link: '/api/tools/upload-video' },
              { text: 'Generate Link Preview', link: '/api/tools/generate-link-preview' },
              { text: 'Analyze Image', link: '/api/tools/analyze-image' },
            ],
          },
          {
            text: 'Lists',
            collapsed: true,
            items: [
              { text: 'Create List', link: '/api/tools/create-list' },
              { text: 'Add to List', link: '/api/tools/add-to-list' },
              { text: 'Remove from List', link: '/api/tools/remove-from-list' },
              { text: 'Get List', link: '/api/tools/get-list' },
            ],
          },
          {
            text: 'Moderation',
            collapsed: true,
            items: [
              { text: 'Report Content', link: '/api/tools/report-content' },
              { text: 'Report User', link: '/api/tools/report-user' },
              { text: 'Analyze Moderation Status', link: '/api/tools/analyze-moderation-status' },
            ],
          },
          {
            text: 'Analytics',
            collapsed: true,
            items: [
              { text: 'Analyze Account', link: '/api/tools/analyze-account' },
              { text: 'Find Influential Users', link: '/api/tools/find-influential-users' },
            ],
          },
          {
            text: 'Discovery',
            collapsed: true,
            items: [
              { text: 'Discover', link: '/api/tools/discover' },
              { text: 'Discover Communities', link: '/api/tools/discover-communities' },
              { text: 'Find Similar Users', link: '/api/tools/find-similar-users' },
              { text: 'Search Starter Packs', link: '/api/tools/search-starter-packs' },
              { text: 'Get Starter Pack', link: '/api/tools/get-starter-pack' },
            ],
          },
          {
            text: 'Insights',
            collapsed: true,
            items: [
              { text: 'Get User Summary', link: '/api/tools/get-user-summary' },
              { text: 'Get Post Context', link: '/api/tools/get-post-context' },
            ],
          },
          {
            text: 'Batch Operations',
            collapsed: true,
            items: [{ text: 'Batch Action', link: '/api/tools/batch-action' }],
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
            text: 'Experimental & Roadmap',
            collapsed: true,
            items: [{ text: 'Overview', link: '/guide/experimental' }],
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
              { text: 'Custom Integration', link: '/examples/custom-integration' },
            ],
          },
        ],
      },

      socialLinks: [{ icon: 'github', link: 'https://github.com/cameronrye/atproto-mcp' }],

      footer: {
        message:
          'Released under the MIT License. | <a href="/atproto-mcp/llms.txt" target="_blank">llms.txt</a> | <a href="/atproto-mcp/llms-full.txt" target="_blank">llms-full.txt</a>',
        copyright:
          'Copyright © 2025 <a href="https://rye.dev/" target="_blank" rel="noopener noreferrer">Cameron Rye</a>',
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
  })
);
