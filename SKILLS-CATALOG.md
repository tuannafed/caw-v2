# Caw Skills Catalog

Auto-generated from `template/skills/` via `scripts/generate-catalog.sh`. Do not edit manually.

**Total:** 65 skills

## Format

LLM (`setup` agent) parses the YAML block below to map detected stack → available skill.
Each entry has:
- `name` — skill folder name in `template/skills/<name>/`
- `source` — origin GitHub repo (for provenance)
- `triggers` — npm/pip dep names or file patterns that should activate this skill
- `domain` — product / backend / frontend / mobile / edge / workflow / devops
- `description` — one-line summary from SKILL.md frontmatter

## Catalog

```yaml
skills:

  # === product ===
  - name: business-analyst
    source: aj-geddes/claude-code-bmad-skills
    domain: product
    triggers: []
    description: "Product discovery and requirements analysis specialist. Conducts stakeholder interviews, market research, problem discovery, and creates product briefs. Use for product brief, brai"
  - name: create-specification
    source: github/awesome-copilot
    domain: product
    triggers: []
    description: "'Create a new specification file for the solution, optimized for Generative AI consumption.'"
  - name: prd-development
    source: deanpeters/product-manager-skills
    domain: product
    triggers: []
    description: "Build a structured PRD that connects problem, users, solution, and success criteria. Use when turning discovery notes into an engineering-ready document for a major initiative."
  - name: prioritization-advisor
    source: deanpeters/product-manager-skills
    domain: product
    triggers: []
    description: "Choose a prioritization framework based on stage, team context, and stakeholder needs. Use when deciding between RICE, ICE, value/effort, or another scoring approach."
  - name: roadmap-planning
    source: deanpeters/product-manager-skills
    domain: product
    triggers: []
    description: "Plan a strategic roadmap across prioritization, epic definition, stakeholder alignment, and sequencing. Use when turning strategy into a release plan that teams can execute."
  - name: user-story
    source: deanpeters/product-manager-skills
    domain: product
    triggers: []
    description: "Create user stories with Mike Cohn format and Gherkin acceptance criteria. Use when turning user needs into development-ready work with clear outcomes and testable conditions."
  - name: user-story-splitting
    source: deanpeters/product-manager-skills
    domain: product
    triggers: []
    description: "Break a large story or epic into smaller deliverable stories using proven split patterns. Use when backlog items are too big for estimation, sequencing, or independent release."

  # === backend ===
  - name: drizzle-best-practices
    source: honra-io/drizzle-best-practices
    domain: backend
    triggers: ["drizzle-orm", "drizzle-kit"]
    description: ""
  - name: nestjs-best-practices
    source: kadajett/agent-nestjs-skills
    domain: backend
    triggers: ["@nestjs/core", "@nestjs/common"]
    description: "NestJS best practices and architecture patterns for building production-ready applications. This skill should be used when writing, reviewing, or refactoring NestJS code to ensure"
  - name: prisma-client-api
    source: prisma/skills
    domain: backend
    triggers: ["@prisma/client", "prisma"]
    description: "Prisma Client API reference covering model queries, filters, operators, and client methods. Use when writing database queries, using CRUD operations, filtering data, or configuring"
  - name: prisma-postgres
    source: prisma/skills
    domain: backend
    triggers: ["@prisma/client", "prisma", "pg"]
    description: "Prisma Postgres setup and operations guidance across Console, create-db CLI, Management API, and Management API SDK. Use when creating Prisma Postgres databases, working in Prisma"
  - name: redis-development
    source: redis/agent-skills
    domain: backend
    triggers: ["ioredis", "redis", "@keyv/redis"]
    description: "Redis performance optimization and best practices. Use this skill when working with Redis data structures, Redis Query Engine (RQE), vector search with RedisVL, semantic caching wi"
  - name: stripe-best-practices
    source: stripe/agent-toolkit
    domain: backend
    triggers: ["stripe"]
    description: ""
  - name: stripe-projects
    source: stripe/agent-toolkit
    domain: backend
    triggers: ["stripe"]
    description: ""
  - name: supabase
    source: supabase/agent-skills
    domain: backend
    triggers: ["@supabase/supabase-js", "@supabase/ssr"]
    description: "Use when doing ANY task involving Supabase. Triggers: Supabase products (Database, Auth, Edge Functions, Realtime, Storage, Vectors, Cron, Queues); client libraries and SSR integr"
  - name: supabase-postgres-best-practices
    source: supabase/agent-skills
    domain: backend
    triggers: ["@supabase/supabase-js", "pg"]
    description: "Postgres performance optimization and best practices from Supabase. Use this skill when writing, reviewing, or optimizing Postgres queries, schema designs, or database configuratio"
  - name: websocket-engineer
    source: jeffallan/claude-skills
    domain: backend
    triggers: ["socket.io", "@nestjs/websockets", "ws"]
    description: "Use when building real-time communication systems with WebSockets or Socket.IO. Invoke for bidirectional messaging, horizontal scaling with Redis, presence tracking, room managemen"

  # === frontend ===
  - name: auth0-nextjs
    source: auth0/agent-skills
    domain: frontend
    triggers: ["@auth0/nextjs-auth0"]
    description: "Use when adding authentication to Next.js applications (login, logout, protected pages, middleware, server components) - supports App Router and Pages Router with @auth0/nextjs-aut"
  - name: auth0-react
    source: auth0/agent-skills
    domain: frontend
    triggers: ["@auth0/auth0-react"]
    description: "Use when adding authentication to React applications (login, logout, user sessions, protected routes) - integrates @auth0/auth0-react SDK for SPAs with Vite or Create React App"
  - name: authjs-skills
    source: gocallum/nextjs16-agent-skills
    domain: frontend
    triggers: ["next-auth", "@auth/core"]
    description: "Auth.js v5 setup for Next.js authentication including Google OAuth, credentials provider, environment configuration, and core API integration"
  - name: next-best-practices
    source: vercel-labs/next-skills
    domain: frontend
    triggers: ["next"]
    description: "Next.js best practices - file conventions, RSC boundaries, data patterns, async APIs, metadata, error handling, route handlers, image/font optimization, bundling"
  - name: next-cache-components
    source: vercel-labs/next-skills
    domain: frontend
    triggers: ["next"]
    description: "Next.js 16 Cache Components - PPR, use cache directive, cacheLife, cacheTag, updateTag"
  - name: shadcn
    source: shadcn/ui
    domain: frontend
    triggers: ["components.json", "@radix-ui/react-slot"]
    description: "Manages shadcn components and projects — adding, searching, fixing, debugging, styling, and composing UI. Provides project context, component docs, and usage examples. Applies when"
  - name: tailwind-design-system
    source: wshobson/agents
    domain: frontend
    triggers: ["tailwindcss", "class-variance-authority"]
    description: "Build scalable design systems with Tailwind CSS v4, design tokens, component libraries, and responsive patterns. Use when creating component libraries, implementing design systems,"
  - name: tanstack-query
    source: tanstack-skills/tanstack-skills
    domain: frontend
    triggers: ["@tanstack/react-query"]
    description: "Powerful asynchronous state management, server-state utilities, and data fetching for TS/JS, React, Vue, Solid, Svelte & Angular."
  - name: tanstack-router
    source: tanstack-skills/tanstack-skills
    domain: frontend
    triggers: ["@tanstack/react-router"]
    description: "Type-safe routing for React and Solid applications with first-class search params, data loading, and seamless integration with the React ecosystem."
  - name: tanstack-start
    source: tanstack-skills/tanstack-skills
    domain: frontend
    triggers: ["@tanstack/react-start"]
    description: "Full-stack React framework powered by TanStack Router with SSR, streaming, server functions, and deployment to any hosting provider."
  - name: tanstack-table
    source: tanstack-skills/tanstack-skills
    domain: frontend
    triggers: ["@tanstack/react-table"]
    description: "Headless UI for building powerful tables & datagrids for TS/JS, React, Vue, Solid, Svelte, Qwik, Angular, and Lit."
  - name: vercel-composition-patterns
    source: vercel-labs/agent-skills
    domain: frontend
    triggers: ["react"]
    description: "React composition patterns that scale. Use when refactoring components with"
  - name: vercel-react-best-practices
    source: vercel-labs/agent-skills
    domain: frontend
    triggers: ["react", "next"]
    description: "React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.js code to ensure optima"

  # === mobile ===
  - name: auth0-expo
    source: auth0/agent-skills
    domain: mobile
    triggers: ["react-native-auth0", "expo"]
    description: "Use when adding authentication to Expo (React Native) mobile apps — login, logout, user sessions, protected routes, biometrics, or token management. Integrates react-native-auth0 S"
  - name: auth0-react-native
    source: auth0/agent-skills
    domain: mobile
    triggers: ["react-native-auth0"]
    description: "Use when adding authentication to React Native or Expo mobile apps (iOS/Android) with biometric support - integrates react-native-auth0 SDK with native deep linking"
  - name: building-native-ui
    source: expo/skills
    domain: mobile
    triggers: ["expo-router", "expo"]
    description: "Complete guide for building beautiful apps with Expo Router. Covers fundamentals, styling, components, navigation, animations, patterns, and native tabs."
  - name: eas-update-insights
    source: expo/skills
    domain: mobile
    triggers: ["expo-updates"]
    description: "Check the health of published EAS Updates: crash rates, install/launch counts, unique users, payload size, and the split between embedded and OTA users per channel. Use when the u"
  - name: expo-deployment
    source: expo/skills
    domain: mobile
    triggers: ["expo", "eas-cli"]
    description: "Deploying Expo apps to iOS App Store, Android Play Store, web hosting, and API routes"
  - name: expo-tailwind-setup
    source: expo/skills
    domain: mobile
    triggers: ["expo", "nativewind"]
    description: "Set up Tailwind CSS v4 in Expo with react-native-css and NativeWind v5 for universal styling"
  - name: native-data-fetching
    source: expo/skills
    domain: mobile
    triggers: ["expo-router", "@tanstack/react-query"]
    description: "Use when implementing or debugging ANY network request, API call, or data fetching. Covers fetch API, React Query, SWR, error handling, caching, offline support, and Expo Router da"
  - name: react-native-best-practices
    source: software-mansion-labs/skills
    domain: mobile
    triggers: ["react-native", "expo"]
    description: "Software Mansion's best practices for production React Native and Expo apps on the New Architecture. MUST USE before writing, reviewing, or debugging ANY code in a React Native or"
  - name: vercel-react-native-skills
    source: vercel-labs/agent-skills
    domain: mobile
    triggers: ["react-native", "expo"]
    description: "React Native and Expo best practices for building performant mobile apps. Use"

  # === edge ===
  - name: agents-sdk
    source: cloudflare/skills
    domain: edge
    triggers: ["@cloudflare/agents"]
    description: "Build AI agents on Cloudflare Workers using the Agents SDK. Load when creating stateful agents, durable workflows, real-time WebSocket apps, scheduled tasks, MCP servers, chat appl"
  - name: cloudflare
    source: cloudflare/skills
    domain: edge
    triggers: ["wrangler", "@cloudflare/workers-types"]
    description: "Comprehensive Cloudflare platform skill covering Workers, Pages, storage (KV, D1, R2), AI (Workers AI, Vectorize, Agents SDK), feature flags (Flagship), networking (Tunnel, Spectru"
  - name: durable-objects
    source: cloudflare/skills
    domain: edge
    triggers: ["@cloudflare/workers-types"]
    description: "Create and review Cloudflare Durable Objects. Use when building stateful coordination (chat rooms, multiplayer games, booking systems), implementing RPC methods, SQLite storage, al"
  - name: workers-best-practices
    source: cloudflare/skills
    domain: edge
    triggers: ["wrangler"]
    description: "Reviews and authors Cloudflare Workers code against production best practices. Load when writing new Workers, reviewing Worker code, configuring wrangler.jsonc, or checking for com"
  - name: wrangler
    source: cloudflare/skills
    domain: edge
    triggers: ["wrangler"]
    description: "Cloudflare Workers CLI for deploying, developing, and managing Workers, KV, R2, D1, Vectorize, Hyperdrive, Workers AI, Containers, Queues, Workflows, Pipelines, and Secrets Store."

  # === workflow ===
  - name: accessibility
    source: addyosmani/web-quality-skills
    domain: workflow
    triggers: []
    description: "Audit and improve web accessibility following WCAG 2.2 guidelines. Use when asked to \"improve accessibility\", \"a11y audit\", \"WCAG compliance\", \"screen reader support\", \"keyboard na"
  - name: code-review-excellence
    source: wshobson/agents
    domain: workflow
    triggers: []
    description: "Master effective code review practices to provide constructive feedback, catch bugs early, and foster knowledge sharing while maintaining team morale. Use when reviewing pull reque"
  - name: find-skills
    source: vercel-labs/skills
    domain: workflow
    triggers: []
    description: "Helps users discover and install agent skills when they ask questions like \"how do I do X\", \"find a skill for X\", \"is there a skill that can...\", or express interest in extending c"
  - name: improve-codebase-architecture
    source: mattpocock/skills
    domain: workflow
    triggers: []
    description: "Find deepening opportunities in a codebase, informed by the domain language in CONTEXT.md and the decisions in docs/adr/. Use when the user wants to improve architecture, find refa"
  - name: javascript-testing-patterns
    source: wshobson/agents
    domain: workflow
    triggers: ["jest", "vitest", "@testing-library/react"]
    description: "Implement comprehensive testing strategies using Jest, Vitest, and Testing Library for unit tests, integration tests, and end-to-end testing with mocking, fixtures, and test-driven"
  - name: performance
    source: addyosmani/web-quality-skills
    domain: workflow
    triggers: []
    description: "Optimize web performance for faster loading and better user experience. Use when asked to \"speed up my site\", \"optimize performance\", \"reduce load time\", \"fix slow loading\", \"impro"
  - name: playwright-best-practices
    source: currents-dev/playwright-best-practices-skill
    domain: workflow
    triggers: ["playwright", "@playwright/test"]
    description: "Use when writing Playwright tests, fixing flaky tests, debugging failures, implementing Page Object Model, configuring CI/CD, optimizing performance, mocking APIs, handling authent"
  - name: refactor
    source: github/awesome-copilot
    domain: workflow
    triggers: []
    description: "'Surgical code refactoring to improve maintainability without changing behavior. Covers extracting functions, renaming variables, breaking down god functions, improving type safety"
  - name: systematic-debugging
    source: obra/superpowers
    domain: workflow
    triggers: []
    description: "Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes"
  - name: test-driven-development
    source: obra/superpowers
    domain: workflow
    triggers: ["jest", "vitest", "@testing-library/react", "playwright"]
    description: "Use when implementing any feature or bugfix, before writing implementation code"
  - name: to-prd
    source: mattpocock/skills
    domain: workflow
    triggers: []
    description: "Turn the current conversation context into a PRD and publish it to the project issue tracker. Use when user wants to create a PRD from the current context."
  - name: typescript-advanced-types
    source: wshobson/agents
    domain: workflow
    triggers: ["typescript"]
    description: "Master TypeScript's advanced type system including generics, conditional types, mapped types, template literals, and utility types for building type-safe applications. Use when imp"
  - name: validate-skills
    source: callstackincubator/agent-skills
    domain: workflow
    triggers: []
    description: "Validates skills in this repo against agentskills.io spec and Claude Code best practices. Use via /validate-skills command."
  - name: verification-before-completion
    source: obra/superpowers
    domain: workflow
    triggers: []
    description: "Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any succ"
  - name: webapp-testing
    source: anthropics/skills
    domain: workflow
    triggers: ["playwright"]
    description: "Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, a"

  # === devops ===
  - name: github
    source: callstackincubator/agent-skills
    domain: devops
    triggers: []
    description: "GitHub patterns using gh CLI for pull requests, stacked PRs, code review, branching strategies, and repository automation. Use when working with GitHub PRs, merging strategies, or"
  - name: github-actions
    source: callstackincubator/agent-skills
    domain: devops
    triggers: [".github/workflows"]
    description: "GitHub Actions workflow patterns for React Native iOS simulator and Android emulator cloud builds with downloadable artifacts. Use when setting up CI build pipelines or downloading"
  - name: sentry-react-sdk
    source: getsentry/sentry-for-ai
    domain: devops
    triggers: ["@sentry/react"]
    description: "Full Sentry SDK setup for React. Use when asked to \"add Sentry to React\", \"install @sentry/react\", or configure error monitoring, tracing, session replay, profiling, or logging for"
  - name: sentry-sdk-setup
    source: getsentry/sentry-for-ai
    domain: devops
    triggers: ["@sentry/node", "@sentry/react", "@sentry/browser", "@sentry/nextjs"]
    description: "Set up Sentry in any language or framework. Detects the user's platform and loads the right SDK skill. Use when asked to add Sentry, install an SDK, or set up error monitoring in a"
  - name: sentry-workflow
    source: getsentry/sentry-for-ai
    domain: devops
    triggers: ["@sentry/node", "@sentry/react", "@sentry/browser"]
    description: "Fix production issues and review code with Sentry context. Use when asked to fix Sentry errors, debug issues, triage exceptions, review PR comments from Sentry, or resolve bugs."
  - name: turborepo
    source: vercel/turborepo
    domain: devops
    triggers: ["turbo", "turbo.json"]
    description: ""
```
