import { publicProducts, publicProductLabel, publicVersionLabel } from './docsVersions';
export { LANGS, localePath } from './locales';
export type { Lang } from './locales';
import { localePath, type Lang } from './locales';

// Single source of truth for site copy in both locales.
// Text is drawn from the awaken / managed-agents / awaken-flow product repos so
// the site stays consistent with the products it describes.

export const AWAKEN_GITHUB_URL = 'https://github.com/AwakenWorks/awaken';
// Website illustration identity; it uses the existing request-context contract.
export const REFUND_SCENARIO_KEY = 'customer-exception-refund';

// Non-localized release facts have one owner; both language projections reuse
// the same application revision, archive bytes and source-access route.
const caseSources = {
  'pilot': { sourceBaseline: '973dc96aa2041b20e1e377aa876178dfe0a1d8b1', sourceArchive: { href: '/cases/pilot/source-973dc96aa2041b20e1e377aa876178dfe0a1d8b1.zip', sha256: '17c8303bd6f45955be26ddeeb709b7778d101978d4a5250c9794a2ef48396a02' }, sourceAccessHref: '/enterprise?product=agents&reference_case=pilot#apply' },
  'deepseek-harness': { sourceBaseline: '3faa59acc1265695bfba15fc19d4a7786e81c641', sourceArchive: { href: '/cases/deepseek-harness/source-3faa59acc1265695bfba15fc19d4a7786e81c641.zip', sha256: '47ac3434ad229ba7a2abaf12808355edc5f162a5aa977aed2efa12d05f3665a5' }, sourceAccessHref: '/enterprise?product=agents&reference_case=deepseek-harness#apply', walkthroughSrc: '/cases/deepseek-harness/deterministic-demo.mp4' },
  'design': { sourceBaseline: '1c63eb95ac29ebdd24ac271b23c136df8ebbb1ac', sourceArchive: null, sourceAccessHref: '/enterprise?product=agents&reference_case=design#apply' },
} as const;

// Canonical public entity definitions. Homepage, product metadata, and
// structured data reuse these exact sentences so company, product, and Runtime
// cannot silently collapse into one category.
export const canonicalEntities = {
  en: {
    company: 'AwakenWorks makes AI a governed part of enterprise production.',
    agents: 'Awaken Agents is open-source, self-hostable infrastructure designed for building and operating production AI Agent applications.',
    workforce: 'Awaken Workforce connects business data and permitted actions, then coordinates Agents and people through accepted work.',
    runtime: 'Awaken Runtime is the Rust execution core inside Awaken Agents. It runs Agent loops, tools, typed state, permissions, and atomic step commits.',
    composition: 'Awaken Agents brings together Agent publishing, continued work, permissions, isolated execution, and interruption recovery so teams can operate Agent applications on infrastructure they control.',
  },
  zh: {
    company: 'AwakenWorks 让 AI 成为受控的生产力。',
    agents: 'Awaken Agents 是开源、可自托管的 Agent 应用基础设施，用于构建和运营生产级 AI Agent 应用。',
    workforce: 'Awaken Workforce 连接业务资料与允许的操作，组织 Agent 和人按流程持续完成可验收的工作。',
    runtime: 'Awaken Runtime 是 Awaken Agents 内部的 Rust 执行内核，负责 Agent loop、工具、类型化状态、权限与原子 step commit。',
    composition: 'Awaken Agents 把 Agent 发布、持续运行、权限控制、隔离执行和中断恢复组合在一起，让团队可以在自己掌控的基础设施上运营 Agent 应用。',
  },
} as const satisfies Record<Lang, Record<'company' | 'agents' | 'workforce' | 'runtime' | 'composition', string>>;

export const content = {
  en: {
    meta: {
      title: 'AwakenWorks | Make AI a governed part of enterprise production',
      description: 'Build and run AI with Awaken Agents. Use Awaken Workforce to connect business data, carry out permitted actions, and coordinate work through acceptance.',
    },
    nav: {
      awaken: 'Awaken internals',
      products: 'Products',
      resources: 'Resources',
      enterprise: 'Deployment & support',
      cases: 'Reference builds',
      integrations: 'Integrations',
      blog: 'Blog',
      book: 'Book',
      principles: 'Reliability',
      docs: 'Docs',
      github: 'GitHub',
      run: 'Get started',
      menu: 'Menu',
    },
    waitlist: {
      placeholder: 'you@company.com',
      fields: {
        email: 'Work email',
        company: 'Company (optional)',
        role: 'Your role (optional)',
        stage: 'How far along are you? (optional)',
        scenario: 'What would you like AI to help you do?',
        loss: 'What is getting in the way? (optional)',
        systems: 'What is involved? Select all that apply. (optional)',
        frequency: 'How often will this job run? (optional)',
        timing: 'When would you like to start? (optional)',
        additional: 'Anything else we should know? (optional)',
      },
      jobPlaceholder: 'For example: review daily support tickets and flag the ones that need a person.',
      draftBlocked: 'Your browser cannot retain this draft. Your entries are still here; submit or clear them before changing language.',
      draftRestored: 'Your entries were kept when you changed language.',
      additionalPlaceholder: 'Add a constraint, expected result, or question.',
      privacyPrefix: 'I agree that AwakenWorks may use this information to evaluate and follow up on this request. See the',
      privacyLabel: 'privacy notice',
      error: 'We could not submit this application. Try again, or email hello@awakenworks.com.',
      variants: {
        cooperation: {
          button: 'Contact the team',
          submitting: 'Submitting…',
          subject: 'AwakenWorks product request',
          success: 'Request received',
          successBody: 'We aim to reply within one business day.',
          successSteps: ["We read your request.", "We reply with questions or a self-service path.", "Before implementation, we agree on scope, fees and responsibilities."],
        },
      },
    },
    home: {
      hero: {
        eyebrow: 'AwakenWorks · Agents + Workforce',
        title: 'Make AI part of',
        titleHighlight: 'enterprise production.',
        definition: "Business teams use Workforce to connect information and keep work moving. Developers use Agents to build and run AI applications. People keep important decisions.",
        ctaPrimary: "Business teams: see the workflow",
        ctaSecondary: 'Developer quickstart',
      },
      workflow: {
        eyebrow: "Customer exceptions and refunds",
        title: "From a delivery delay to a confirmed refund.",
        body: "Use one customer exception to see how connected work moves from a request to a result. Expand the steps for the details."
      },

      cta: {
        eyebrow: 'Get started',
        title: 'Tell us what work you want AI to handle.',
        body: 'Tell us what you want AI to do. Developers can also try the Agents quickstart independently.',
        primary: 'Describe your work',
        secondary: 'Developer quickstart',
        questions: 'See preparation, setup and cost questions',
      },
    },
    enterprise: {
      partner: {
        title: "For solution providers and delivery teams",
        body: "Use the same Agents foundation across customer projects. Agree on the customer-facing experience, integrations, delivery lead and support responsibility for each scope.",
        action: "Discuss a delivery partnership",
        href: "/enterprise?product=agents&scenario=solution-delivery#apply"
      },

      questions: {
        eyebrow: "Before you start",
        title: "What you need to know before contacting us.",
        items: [
          {
            key: "agent",
            question: "Do I need an Agent already?",
            answer: "You can start with the work you want done. We will discuss suitable capabilities and setup; developers can create or connect an Agent through the existing Agents guides."
          },
          {
            key: "prepare",
            question: "What should I prepare?",
            answer: "Describe one recurring job, the systems and information it uses, its responsible person and a result your team can check. Other details can follow after the first conversation."
          },
          {
            key: "setup",
            question: "Who connects the systems and configures the work?",
            answer: "For self-managed evaluation, your technical team handles setup. For an implementation, we agree on system access, configuration, deployment and support responsibilities before starting."
          },
          {
            key: "cost",
            question: "How are costs agreed?",
            answer: "Software and model usage, infrastructure, system integration and implementation support are scoped separately. We agree on fees and responsibilities before a paid implementation starts."
          }
        ]
      },

      contextLabels: {
        "agent-product": "AI application development",
        "enterprise-private-agent": "Business work",
        "solution-delivery": "Solution delivery"
      },

      meta: {
        title: 'Describe your work or Agent application | AwakenWorks',
        description: 'Agree on one job, its systems, responsible owner, quality baseline, full cost, and acceptance condition.',
      },
      hero: {
        eyebrow: 'Discuss your work',
        title: 'Evaluate one job with a result you can check.',
        body: 'Tell us about an application you want to build or a job you want AI to handle. We will help you choose the product, deployment and next step.',
        primary: 'Describe your work',
        secondary: 'Run Agents independently',
      },
      deliveryModes: {
        eyebrow: 'Where it runs', title: 'Choose who operates your deployment.',
        body: 'Run Agents yourself, plan an enterprise deployment, or ask about Cloud hosting. Product access and operating responsibility are agreed separately.',
        scopeLabel: 'Current access', operatorLabel: 'Who operates it',
        items: [
          { key: 'self-host', name: 'Self-hosted Agents', operator: 'Your team', body: 'Run Agents on your own infrastructure and keep its data and credentials in your environment.', status: publicVersionLabel('platform', 'en'), action: 'Start from source', href: '/docs/agents/get-started' },
          { key: 'private', name: 'Enterprise deployment', operator: 'Responsibilities agreed with your team', body: 'Plan deployment, integrations, backups and support inside an approved enterprise environment.', status: 'Delivery scoped to the available product capabilities', action: 'Discuss deployment', href: '/enterprise?product=agents#apply' },
          { key: 'cloud', name: 'Cloud hosting', operator: 'AwakenWorks operates the platform', body: 'A hosted delivery option for Awaken. Access, available capabilities and support must be confirmed before adoption.', status: 'Hosted preview · access by agreement', action: 'Ask about hosted access', href: '/enterprise?product=agents#apply' },
        ],
      },
      paths: {
        eyebrow: 'Products and availability',
        title: 'Two products. Scope and availability agreed before delivery.',
        bringLabel: 'Bring',
        decisionLabel: 'First decision',
        detailsLabel: 'Preparation and implementation scope',
        boundaryLabel: 'Current boundary',
        items: [
          { body: 'Run the product independently or scope one Agent application inside an approved infrastructure boundary.', bring: 'An application you want to build or already operate, its first task, model and data needs, deployment constraints and technical contact.', decision: 'A scoped 4–6 week implementation uses 2–4 release checks, including a permission decision and interruption-and-recovery path, to reach a go, change, or stop decision.', boundary: 'Further hardening, integrations, rollout, and support require a new bounded service scope on the same Agents foundation.', docsHref: '/docs/agents/concepts/architecture', view: 'View Agents', docs: 'Review implementation detail', apply: 'Discuss an Agents implementation', query: 'agents' },
          { body: 'Connect business data and permitted actions, then coordinate one recurring job through human decisions and acceptance.', bring: 'One real job, its source system, responsible owner, human decisions, current manual effort, full cost, and acceptance condition.', decision: 'Agree on the deliverables and released capabilities needed for one bounded paid validation, then make a go, change, or stop decision from the recorded result.', boundary: 'Request preview access, then confirm available capabilities, integrations, delivery and support for your scope.', docsHref: '/docs/workforce', view: 'View Workforce', docs: 'Review work and acceptance', apply: 'Evaluate a Workforce job', query: 'workforce' },
        ],
      },
      delivery: {
        eyebrow: 'Bounded paid validation',
        title: 'Agree on the work, measures, cost, and acceptance.',
        body: 'The standard validation covers one real application or recurring job, one approved environment, one integration, and 2–4 measures. The signed scope fixes the period, fees, responsibilities, and final decision.',
        facts: [
          { value: 'One application', label: 'One application or recurring job in one approved environment' },
          { value: 'One integration', label: 'One standard system connection; additional systems require a scope change' },
          { value: '2–4 checks', label: 'Result quality, remaining human effort, full cost, and normal, approval, and recovery paths' },
          { value: 'Go / change / stop', label: 'A named acceptor makes the next decision from recorded evidence' },
        ],
        deliverablesTitle: 'What you receive',
        deliverables: ['A running end-to-end path', 'An acceptance record against the agreed checks', 'A risk list with operating and acceptance owners', 'A final report and explicit next decision'],
        responsibilitiesTitle: 'Who owns what',
        responsibilities: [
          { owner: 'AwakenWorks', body: 'Scope the target and boundaries, configure the agreed deployment and integration, run the normal, permission, and recovery paths, and record the result.' },
          { owner: 'Your team', body: 'Provide the job, baseline, environment, restricted access, business rules, technical owner, decision maker, and final acceptor.' },
        ],
        boundary: 'Production SLA, broad rollout, additional integrations, unlimited customization, and long-term operations are not included. They require a separate bounded scope on the same Agents foundation.',
      },

      form: {
        eyebrow: 'Discuss implementation',
        title: 'Tell us what you want to do.',
        body: 'Describe the work and the result you need, then leave your email. Other information can follow later.',
        productHelp: 'Choose Workforce to hand over business work, or Agents to build an AI application. If you are unsure, tell us in the work description.',
        prepareTitle: 'What happens next',
      },
      boundary: 'Current access is shown in the product choices. System connections and delivery scope are confirmed before implementation.',
    },
    privacy: {
      meta: { title: 'Privacy notice | AwakenWorks', description: 'How the AwakenWorks website handles contact, opportunity, attribution, and analytics data.' },
      eyebrow: 'Website privacy',
      title: 'Privacy notice',
      updated: 'Last updated: October 10, 2026',
      intro: 'This notice applies to the AwakenWorks public website and its enterprise-deployment and implementation form. It does not describe data handled inside a customer-operated Awaken deployment.',
      sections: [
        { title: 'Information you provide', paragraphs: ['When you submit a form, we receive the contact details, company and role, work you want to discuss, systems involved, timing, consent, and referral or campaign details you choose to provide.', 'Do not send passwords, credentials, production data, personal records, or other secrets through a website form.'] },
        { title: 'Language changes and unsent forms', paragraphs: ['When you change language in the same browser tab, the website temporarily retains your unsent form in that tab session. The destination form removes the draft when it checks it and restores entries only within ten minutes. Draft contents are never included in analytics or URL parameters.'] },
        { title: 'Website analytics', paragraphs: ['The site uses Umami to record anonymous page and interaction analytics, including page, locale, campaign, named conversion events, and bounded event context such as placement, product, and destination. We use this information to improve navigation and understand which content leads people to documentation, GitHub, or a conversation. The site does not send form contact details or free-text answers to Umami and does not use advertising cookies.'] },
        { title: 'How we use submitted information', paragraphs: ['During one browser session, the site keeps the first and most recent campaign or referral context so a submitted request can retain how the conversation began and which later campaign led to the form. We use form submissions to reply, understand whether self-service evaluation or a scoped implementation is the more useful next step, and prepare for that conversation. A received form is not automatically a qualified opportunity.'] },
        { title: 'Service providers and transfers', paragraphs: ['By default, forms are sent to Formspree and website analytics are processed by Umami Cloud. A deployment may configure a different form endpoint or a self-hosted Umami endpoint. These providers may process information in other jurisdictions under their own terms.', 'Formspree and Umami are not the record for a customer engagement. If a request becomes a qualified opportunity, the working record moves to the company CRM; signed agreements and transaction records remain the formal business record.'] },
        { title: 'Retention and your requests', paragraphs: ['We keep inquiry information only while it is needed to understand and follow up on the request, document a business relationship, or meet an operational or legal requirement. You may ask to access, correct, or delete your information. Records needed for an agreement, dispute, security matter, or legal obligation may need to be kept longer.'] },
        { title: 'Changes and contact', paragraphs: ['Email hello@awakenworks.com with a question or data request. We will update this notice when the website data path, service provider, or purpose changes.'] },
      ],
      contactLabel: 'Email a privacy question or request',
      contactHref: 'mailto:hello@awakenworks.com',
    },
    integrations: {
      meta: {
        title: 'Awaken Agents integrations | AwakenWorks',
        description: 'Choose a verified protocol or application integration path, then follow the canonical Awaken Agents documentation for its current scope.',
      },
      eyebrow: 'Integration paths',
      title: 'Connect through the protocol your application already uses.',
      body: 'Use this directory to choose an entry point. Each card links to the canonical technical guide that owns current behavior, limits, configuration, and verification.',
      boundary: 'This is a navigation surface, not a second compatibility matrix. Linked documentation remains authoritative, and documented support is not evidence of a customer deployment.',
      quickstart: 'Run the Agents quickstart',
      compatibility: 'Review the tested compatibility baseline',
      items: [
        { key: 'managed-agents', name: 'Managed Agents API', body: 'Evaluate an existing Managed Agents client against Awaken’s tested compatibility baseline.', action: 'Open the protocol guide', href: '/docs/agents/protocols/managed-agents' },
        { key: 'ai-sdk', name: 'AI SDK', body: 'Connect a frontend to a published Agent and verify the Session and event path.', action: 'Open the integration guide', href: '/docs/agents/how-to/integrate-ai-sdk-frontend' },
        { key: 'ag-ui', name: 'AG-UI and CopilotKit', body: 'Follow the documented AG-UI path from a published Agent to a CopilotKit client.', action: 'Open the integration guide', href: '/docs/agents/how-to/integrate-copilotkit-ag-ui' },
        { key: 'mcp', name: 'MCP', body: 'Review the current MCP surface and configure the connection and ToolSet policy as one unit.', action: 'Open the protocol guide', href: '/docs/agents/protocols/mcp' },
        { key: 'a2a', name: 'A2A', body: 'Connect an A2A server through the documented Agent and Session ownership boundary.', action: 'Open the protocol guide', href: '/docs/agents/protocols/a2a' },
        { key: 'acp', name: 'ACP', body: 'Select and operate a documented ACP runtime without creating a second Session authority.', action: 'Open the protocol guide', href: '/docs/agents/protocols/acp' },
      ],
    },
    cases: {
      meta: {
        title: 'Built on Awaken: reference applications and implementations',
        description: 'Choose a reference build by product shape, try its smallest useful path, and see what the application keeps versus what Awaken provides.',
      },
      eyebrow: 'Built on Awaken',
      title: 'Reference applications built with Awaken.',
      body: 'See how we use Agents to build task interfaces, workbenches and design tools. Each reference application explains its purpose, source access and current validation scope.',
      items: [
        {
          slug: 'pilot',
          ...caseSources['pilot'],
          walkthrough: null,
          kind: 'Our reference application',
          name: 'Awaken Pilot',
          adoption: 'Create a thin Agent application',
          title: 'A task interface for progress, approvals and deliverables.',
          problem: 'You have the product idea, but the first prototype still needs task state, progress, approval, schedules, files, and recovery.',
          firstWin: 'Run one bounded Mission in Plan or Execute mode, then review its progress and result in the same Session.',
          summary: 'Pilot keeps the product surface thin: a Mission becomes an Awaken Session and a Project chooses the Deployment. Users see the plan, progress, files, approvals, and result without a second task engine underneath.',
          audience: 'Agent product teams that want the shortest path from product UX to durable execution.',
          owned: 'Product copy, Mission interaction flow, acceptance criteria, and UI projections.',
          reused: 'Agent, Deployment, Session, Run, events, files, tools, policy, Worker, Sandbox, and recovery.',
          status: 'Source-archive reference build',
          sourceStatus: 'A fixed committed source archive includes the shared build inputs and passed a clean source installation, local checks and build. This published snapshot still has runtime compatibility gaps and has not passed a full real-Agent journey. It is available as a source reference while that qualification remains pending.',
          proof: [
            { level: 'Tested', claim: 'Execute and Plan paths share one Session log.', owner: 'Pilot web and API test suites' },
            { level: 'Tested', claim: 'Approvals, budgets, Skills, MCP, subagents, artifacts, and schedules use Awaken-owned contracts.', owner: 'pnpm check' },
            { level: 'Live gate pending', claim: 'The real-stack acceptance protocol includes interruption and recovery; its live result is not published yet.', owner: 'docs/real-stack-acceptance.md' },
          ],
          try: ['Start with one Mission and one visible acceptance criterion', 'Interrupt or approve it once, then confirm the same Session continues', 'Keep only the product projections your users need'],
          primary: { label: 'Run the Awaken quickstart', href: '/docs/agents/get-started' },
          secondary: { label: 'Learn Session management', href: '/docs/agents/how-to/manage-a-session' },
          engineeringBlog: { label: 'Read the implementation decisions and failure modes', href: '/blog/2026-08-build-manus-style-agent-product' },
          cta: 'See the Pilot reference build',
        },
        {
          slug: 'deepseek-harness',
          ...caseSources['deepseek-harness'],
          walkthrough: { src: caseSources['deepseek-harness'].walkthroughSrc, caption: 'Deterministic Managed API walkthrough · fixture data, not a live DeepSeek account' },
          kind: 'Independent reference build',
          name: 'DeepSeek workbench on Awaken Agents',
          adoption: 'Build an advanced Agent workbench',
          title: 'Keep the workbench experience and use Agents to run its tasks.',
          problem: 'An interaction-rich workbench needs Presets, Plans, approvals, Trajectory, Threads, and Files. Rebuilding the Agent loop first delays the parts users can actually see and judge.',
          firstWin: 'Start one Preset-driven Session, review its Plan, approve a tool, and reopen the same Trajectory after an interruption.',
          summary: 'This independent build keeps Presets, Trajectory, approvals, Skills, subagents, and deliverables in the workbench. The browser and product API remain projections over Awaken Sessions and committed Events.',
          audience: 'Teams building Agent IDEs, coding workbenches, or other interaction-rich Agent products.',
          owned: 'Preset UX, browser preferences, product projections, and a stateless workbench Session API and Interaction MCP.',
          reused: 'Managed Sessions, events, model routing, credentials, tools, permissions, compaction, resources, subagents, Worker, and Sandbox.',
          status: 'Reference build with fixture and live browser evidence',
          sourceStatus: 'The fixed source includes its shared dependencies. Local checks, desktop and narrow-screen browser workflows, and a fresh real DeepSeek journey on local Kubernetes passed. The video shows the deterministic demo; platform release qualification and customer outcomes are separate.',
          proof: [
            { level: 'Fixture-tested', claim: 'The deterministic Managed API demo exercises the browser, workbench Session API, official SDK, and committed-event projection.', owner: 'e2e/harness.spec.ts' },
            { level: 'Audited contract', claim: 'Native, Equivalent, Presentation, and Unavailable capabilities have explicit boundaries.', owner: 'docs/ui-parity.md' },
            { level: 'Live browser gate passed', claim: 'A fresh local Kubernetes run exercised all four Presets, genuine Skill delivery, permissions, tools, Plan, Creator, questions, delegation and reconnect.', owner: 'e2e/live/harness-live.spec.ts' },
          ],
          try: ['Run the deterministic demo before adding provider credentials', 'Trace one Preset-driven Session from the browser through the product API to committed Events', 'Replace the fixture with your published Agent without adding browser-owned execution state'],
          primary: { label: 'Connect a published Agent', href: '/docs/agents/how-to/connect-a-published-agent' },
          secondary: { label: 'Review the AI SDK boundary', href: '/docs/agents/protocols/ai-sdk' },
          engineeringBlog: null,
          cta: 'See the reference reimplementation',
        },
        {
          slug: 'design',
          ...caseSources['design'],
          walkthrough: null,
          kind: 'Our reference application',
          name: 'Awaken Design',
          adoption: 'Build a domain-rich AI product',
          title: 'Turn one AI-generated design into a reviewable, revisable, explicitly accepted result.',
          problem: 'Chat history is not a product model when a team must compare versions, attach feedback to the exact result, reject unsafe output, and deliver one selected design.',
          firstWin: 'Submit a design brief, review the generated version, request a change, then select and export the design to deliver.',
          summary: 'Design keeps projects, versions, reviews and the selected design. Agents runs the generation tasks and handles files and interruption recovery.',
          audience: 'Development teams turning AI-generated results into products people can revise, review and receive.',
          owned: 'Design projects, versions, review records, safe previews and final deliverables.',
          reused: 'Agent, Environment, Session, Run, execution-stage Files, tools, events, Worker, Sandbox, and recovery.',
          status: 'Locally qualified reference build',
          sourceStatus: 'This first-party reference implementation is currently local. Its fixed application baseline passed 411 tests with no skips, including a real DeepSeek initial-and-child Revision journey, desktop and mobile browser interaction, acceptance and ZIP delivery on a frozen local Kubernetes deployment. A public source package remains unpublished; production login and deployment, and external user outcomes remain unqualified.',
          proof: [
            { level: 'Source-checked', claim: 'The current implementation preserves one immutable Revision and Artifact publication owner.', owner: 'Awaken Design architecture and ADRs' },
            { level: 'Test-covered', claim: 'The dated local qualification passed 411 tests with no skips, including publication, review, acceptance, storage and browser delivery.', owner: 'Awaken Design test suites' },
            { level: 'Real local journey', claim: 'Two naturally ended DeepSeek Runs published an initial and child Revision; independent desktop/mobile browsers exercised the child, acceptance and ZIP export. Production deployment, a 100-case semantic benchmark and customer outcomes remain unqualified.', owner: 'Awaken Design 2026-10-10 qualification record' },
          ],
          try: ['Model the durable result as a domain object, not as chat history', 'Publish execution Files through one immutable Revision and Artifact path', 'Keep review, safe publication, and explicit acceptance in the product experience'],
          primary: { label: 'Build an Agent-backed product', href: '/docs/agents/how-to/build-an-agent-with-the-assistant' },
          secondary: { label: 'Read the architecture guide', href: '/docs/agents/concepts/architecture' },
          engineeringBlog: { label: 'Read the publication and acceptance decisions', href: '/blog/2026-08-build-claude-design-style-workflow' },
          cta: 'See the Awaken Design reference build',
        },
      ],
    },
    products: {
      eyebrow: 'Two products, explicit availability',
      title: 'Choose the product for your work.',
      agents: {
        tone: 'iris',
        layer: 'Managed Agents-compatible platform',
        status: publicVersionLabel('platform', 'en'),
        license: 'Apache-2.0',
        audience: 'For development teams',
        name: 'Awaken Agents',
        role: 'Build and run AI applications',
        tagline: canonicalEntities.en.agents,
        points: [
          'Bring Managed Agents, AI SDK, AG-UI, and A2A clients into the same Session history.',
          'Choose models, Agent runtimes, and tool locations without changing the application-facing contract.',
          'Start in one process, then add Workers and isolated Sandboxes when the operating need is real.',
        ],
        cta: 'See how to start with Agents',
        href: '/agents',
      },
      workforce: {
        tone: 'rust',
        layer: 'Work and acceptance',
        status: publicVersionLabel('flow', 'en'),
        license: 'Early access by request',
        audience: 'For business teams',
        name: 'Awaken Workforce',
        role: 'Complete business work with AI',
        tagline: canonicalEntities.en.workforce,
        points: [
          'Durable Issues preserve intent and responsibility across attempts and hand-offs.',
          'Dependencies and reactions keep ready work moving instead of waiting for manual polling.',
          'People retain authority over intent, exceptions, approval, and consequential action.',
        ],
        cta: 'See how to request preview access',
        href: '/workforce',
      },
    },
    footer: {
      tagline: canonicalEntities.en.company,
      rights: '© 2026 AwakenWorks. Product licenses vary.',
      cols: [
        {
          title: 'Resources',
          links: [
            { label: 'Enterprise deployment and implementation', href: '/enterprise' },
            { label: 'Integrations', href: '/integrations' },
            { label: 'Reference builds', href: '/cases' },
            { label: 'Docs', href: '/docs' },
            { label: 'Blog', href: '/blog' },
            { label: 'Book', href: '/book' },
          ],
        },
        {
          title: 'Community',
          links: [
            { label: 'Star Awaken', href: AWAKEN_GITHUB_URL },
            {
              label: 'Discussions',
              href: 'https://github.com/AwakenWorks/awaken/discussions',
            },
            { label: 'YouTube', href: 'https://www.youtube.com/@awakenworks-ai' },
          ],
        },
        {
          title: 'Contact',
          links: [
            { label: 'hello@awakenworks.com', href: 'mailto:hello@awakenworks.com' },
            { label: 'Reliability and openness', href: '/principles' },
            { label: 'Privacy', href: '/privacy' },
          ],
        },
      ],
    },

    landing: {
      agents: {
        tone: 'iris',
        eyebrow: 'Awaken Agents · Agent application infrastructure',
        status: { label: publicVersionLabel('platform', 'en'), tone: 'iris' },
        title: 'Build and run your AI Agent application.',
        subtitle: 'Publish an Agent, connect your application, and follow its work. Choose where it runs and which data and tools it may use.',
        ctaPrimary: { label: 'Run the Agents quickstart', href: '/docs/agents/get-started' },
        audience:
          'For Agent application developers and enterprise engineering teams.',
        fit: {
          eyebrow: 'When to choose Awaken',
          title: 'Use Awaken when your product needs managed Agent execution.',
          body: 'Start by creating an Agent, adopting a supported Agent, or connecting behavior you already own. Your application keeps its experience and business rules; Awaken runs the Agent.',
          items: [
            { title: 'Embed an Agent in your product', body: 'Connect a backend, web interface, copilot, or Agent-to-Agent client to one published Agent.' },
            { title: 'Keep work beyond one connection', body: 'Create and reopen a durable Session from committed events instead of tying work to one request or browser.' },
            { title: 'Choose execution without forking the product', body: 'Use Native execution, a supported ACP runtime, or a remote A2A Agent behind the same Session authority.' },
            { title: 'Control and grow the operating boundary', body: 'Start all-in-one, then split Control, Coordinator, and Workers when isolation, capacity, or ownership requires it.' },
          ],
          boundary: 'A short-lived prompt, a trusted one-off local script, or a fully delegated managed service may not need Awaken. Choose it when Session continuity, controlled execution, or reusable application infrastructure is part of the product requirement.',
        },
        boundary: {
          eyebrow: 'System ownership',
          title: 'Your application owns the product. Awaken owns Agent execution.',
          body: 'The current Awaken source implements the ownership model below. The documentation defines exact APIs, schemas, deployment procedures, and compatibility versions.',
          owners: [
            { key: 'control', title: 'Control', body: 'Owns Agent and Environment definitions, immutable revisions and publications, IAM, and credential references.' },
            { key: 'coordinator', title: 'Coordinator', body: 'Owns executable projections, durable Sessions and Runs, dispatch, committed events, and public replay.' },
            { key: 'worker', title: 'Worker + Runtime', body: 'The Worker claims fenced work and owns Sandbox and process lifetime. Its embedded Rust Runtime executes Agent loops, tools, permissions, typed state, and atomic steps; it is not a second service authority.' },
          ],
          lifecycleTitle: 'Publication and recovery sequence',
          lifecycle: [
            'Publish immutable Agent and Environment revisions.',
            'Create a Session that freezes the exact executable references.',
            'Record work and project an idempotent dispatch in the Coordinator.',
            'Let an eligible Worker claim the dispatch and execute inside its Sandbox boundary.',
            'Commit events and state through the Session authority before they become public replay.',
            'Reconnect or recover from committed Session facts under the configured policy.',
          ],
          failureTitle: 'Failure outcomes',
          failures: [
            { title: 'Permission required', body: 'Commit an awaiting state and durable resume ticket; continue only after the decision.' },
            { title: 'Worker interrupted', body: 'Use committed facts and claim fences to recover eligible work without creating another Session owner.' },
            { title: 'External outcome ambiguous', body: 'Record an indeterminate terminal cause. Never project uncertain execution as success.' },
          ],
          link: { label: 'Read the full architecture and recovery model', href: '/docs/agents/concepts/architecture' },
        },
        outcomes: {
          eyebrow: 'Product work',
          title: 'Use Awaken for Agent execution and Session management.',
          body: 'Your application owns its experience, domain state, workflow, acceptance, and commercial relationship. Awaken manages the Agent lifecycle.',
          items: [
            { title: 'Ship one real Agent application', body: 'Publish an Agent, create and reopen the same Session, connect resources and permissions, and operate execution without assembling another backend.', proof: 'Agent publication · Session and events · resources · Worker and Sandbox' },
            { title: 'Keep existing application investment', body: 'Retain the tested official SDK model and connect web, copilot, or Agent-to-Agent surfaces to the same published Agent instead of copying it.', proof: 'Managed Agents · AI SDK · AG-UI · A2A' },
            { title: 'Keep differentiated Agent behavior', body: 'Choose Awaken Native execution, a supported ACP runtime, or a remote A2A Agent without creating another Session authority.', proof: 'Native · ACP · outbound A2A' },
            { title: 'Run inside enterprise boundaries', body: 'Place control, Session data, credentials, model routes, Workers, and Sandboxes inside the approved infrastructure and responsibility boundary.', proof: 'Self-hosted · enterprise delivery · hosted preview' },
          ],
        },
        reliability: {
          eyebrow: 'Failure handling',
          title: 'Recover from committed Session state.',
          body: 'Awaken follows committed facts and an explicit recovery policy. It does not assume every external side effect is safe to replay.',
          items: [
            { key: 'reconnect', value: 'A user reconnects', label: 'Reopen the same Session from committed events instead of depending on one browser or process.', proof: 'Durable Session', href: '/docs/agents/concepts/sessions-and-events' },
            { key: 'interrupt', value: 'A Worker or process stops', label: 'Recover eligible work from committed facts and continue under the configured recovery policy.', proof: 'Recovery boundary', href: '/docs/agents/concepts/production-reliability' },
            { key: 'permission', value: 'A tool requests sensitive action', label: 'Allow, deny, or suspend for a human decision before the tool executes.', proof: 'Permission and HITL', href: '/docs/agents/runtime/how-to/enable-tool-permission-hitl' },
            { key: 'inspect', value: 'An operator needs an explanation', label: 'Inspect events, traces, and audit history across the execution path.', proof: 'Observability', href: '/docs/agents/runtime/how-to/enable-observability' },
            { key: 'boundary', value: 'Data and tools must stay inside', label: 'Place control, Session data, credentials, Workers, and Sandboxes in the approved infrastructure boundary.', proof: 'Self-hosting', href: '/docs/agents/how-to/self-host' },
          ],
        },
        advantage: {
          eyebrow: 'Managed Agents compatibility',
          title: 'Keep the application contract and choose how Agents run.',
          body:
            'Anthropic Managed Agents defines a useful application contract. Awaken implements a tested baseline, then adds explicit client, execution, model, and deployment choices around one Agent and Session authority.',
          commonLabel: 'Managed Agents baseline',
          awakenLabel: 'Awaken extension',
          proofLabel: 'What this changes',
          items: [
            {
              title: 'Adopt with the official SDK model',
              common: 'Use the official Managed Agents API and SDK resource model.',
              awaken: 'Point a reviewed SDK version to Awaken, configure Awaken authentication, and keep the named compatible request and response shapes.',
              proof: 'Reduce migration work while keeping exact differences reviewable',
            },
            {
              title: 'Connect more than one application surface',
              common: 'Managed Agents clients enter through the Managed API.',
              awaken: 'Managed Agents, AI SDK, AG-UI, and A2A project the same published Agent and committed Session history.',
              proof: 'Reuse one Agent across backend, web, copilot, and Agent-to-Agent products',
            },
            {
              title: 'Choose the execution behavior',
              common: 'Use a managed sandbox or self-hosted environment worker inside the Anthropic service model.',
              awaken: 'Select Native execution, a supported ACP Agent runtime, or a remote A2A endpoint without changing the client contract.',
              proof: 'Preserve existing Agent behavior and select the right execution path per product',
            },
            {
              title: 'Choose who owns the platform boundary',
              common: 'The service control plane and persistent service are operated by Anthropic.',
              awaken: 'Deploy and operate the API, Session data, credentials, model routes, Workers, and Sandboxes yourself or through an AwakenWorks delivery mode.',
              proof: 'Meet enterprise deployment and operating-responsibility requirements',
            },
          ],
        },
        decisions: {
          eyebrow: 'Technical guides',
          title: 'Choose the guide for your current decision.',
          body: 'Run the quickstart first. Use the documentation to review compatibility, architecture, recovery, deployment, or Runtime internals.',
          items: [
            { key: 'compatibility', title: 'Migrate an existing client', body: 'Check reviewed SDK versions, supported resources, required selectors, and known differences before changing an application.', action: 'Review compatibility', href: '/docs/agents/compatibility' },
            { key: 'architecture', title: 'Review authority and recovery', body: 'Follow publication, Session, dispatch, Worker execution, committed facts, failures, and recovery through their owning boundaries.', action: 'Read the architecture', href: '/docs/agents/concepts/architecture' },
            { key: 'self-host', title: 'Choose a deployment boundary', body: 'Plan AllInOne or split services, data and credential custody, Workers, Sandboxes, observation, backup, and operating ownership.', action: 'Open the self-hosting guide', href: '/docs/agents/how-to/self-host' },
            { key: 'runtime', title: 'Understand the runtime boundary', body: 'Separate Agent execution from the Sessions, Workers, Sandboxes, protocols, and operations around it before choosing an integration path.', action: 'Define Agent Runtime', href: '/docs/agents/concepts/agent-runtime' },
          ],
        },
        closer: {
          title: 'Run one Session before planning a larger deployment.',
          body: 'Evaluate the source code independently; a stable release package is not yet available. Contact us if you need help with integration, deployment or support.',
          cta: { label: 'Enterprise deployment services', href: '/enterprise?product=agents#enterprise-agents' },
        },
      },
      objects: {
        eyebrow: 'Workforce capability · Business Data & Actions (Objects)',
        title: 'Give applications and Agents the same typed business records.',
        subtitle: 'Turn identities, relationships, and allowed changes from existing systems into typed, versioned object records with explicit provenance.',
        audience: 'For data, business-system, operations, and internal-application teams. Choose one important business object and identify the system that already owns it.',
        docs: 'Read the Objects docs',
        star: 'Star the Awaken open foundation',
        example: {
          eyebrow: 'Start with one object',
          title: 'Define one business object before connecting more systems.',
          body: 'Take an Order as an example. Define its identity and fields, connect it to a Customer, record which system supplied each observation, and expose only the actions that system allows. The example is configurable product behavior, not a built-in Order package.',
          items: [
            { title: 'Describe the object', body: 'A Pack fixes the ResourceType schema, relationships, Actions, restrained presentation hints, and exact definition revision.' },
            { title: 'Render all business data', body: 'The generic Objects UI displays declared fields and nested values without provider-specific frontend branches.' },
            { title: 'Offer allowed change', body: 'A Pack-defined Action describes its inputs and impact, then requires authorization, expected revision, and an idempotency boundary.' },
          ],
        },
        model: {
          eyebrow: 'What Objects owns',
          title: 'Objects stores business records separately from Agent memory.',
          body: 'Objects keeps the typed record that applications and Agents may use. It distinguishes platform-owned state from externally controlled state and never turns a Connector observation into exclusive authority.',
          items: [
            ['Type, data, and identity', 'ResourceType defines the data contract and optional presentation hints. Resource preserves identity, complete attributes, exact type revision, and lifecycle.'],
            ['Snapshot and relationship', 'A consumable ResourceSnapshot freezes one revision; Relation connects exact objects while the generic UI resolves human labels without guessing the latest value.'],
            ['Observation and provenance', 'Connector observations retain provider or fallback identity, mechanism, time, and optional provider ordering evidence.'],
            ['Action and receipt', 'The Action owns its field schema and impact copy. Read-only, idempotent, and mutating Actions follow one authorization and revision-fenced execution path.'],
          ],
        },
        change: {
          eyebrow: 'One governed change',
          title: 'Objects records a change after the source system returns a result.',
          steps: [
            ['01', 'Observe', 'A Connector brings back normalized identity, properties, relations, and provenance.'],
            ['02', 'Project', 'Objects exposes an exact typed snapshot rather than an unversioned latest value.'],
            ['03', 'Propose', 'A person, application, or Agent submits one named Action with expected revision and idempotency key.'],
            ['04', 'Authorize and call', 'Objects checks authority and revision before the configured provider boundary is invoked.'],
            ['05', 'Record the result', 'The receipt and next observation make the accepted external result available to every authorized consumer.'],
          ],
        },
        boundary: {
          eyebrow: 'Boundary',
          title: 'Keep the source system authoritative.',
          items: [
            { title: 'Not a data warehouse', body: 'Objects does not replace analytical storage or ingest every source before one useful object can exist.' },
            { title: 'Not Agent memory', body: 'Context assembled for a run is a consumer of the object record, never its lifecycle authority.' },
            { title: 'Not universal write access', body: 'An Agent may propose only declared Actions; current authorization and revision are checked on every call.' },
          ],
        },
        closer: {
          title: 'Define one object, one source, and one allowed action.',
          body: 'Read the current model, then request early access if you have one object and source-system boundary to explore.',
          cooperation: 'Request early preview',
        },
      },
      workforce: {
        eyebrow: 'Awaken Workforce · work, responsibility, and acceptance',
        status: { label: publicVersionLabel('flow', 'en'), tone: 'rust' },
        title: 'Let AI handle everyday work. Keep important decisions with people.',
        subtitle:
          'Set rules for reading information, taking action and requesting approval. Follow progress and check the result before accepting the work.',
        audience: 'For business and operations teams. Start with one recurring job and a result your team can check.',
        ctaPrimary: {
          label: 'See the workflow preview',
          href: '/workforce#workforce-preview',
        },
        ctaDocs: { label: 'Read the Workforce docs', href: '/docs/workforce' },
        ctaSecondary: { label: 'Evaluate one real job', href: `/enterprise?product=workforce&scenario=${REFUND_SCENARIO_KEY}#apply` },
        loop: {
          eyebrow: "Customer exceptions and refunds",
          title: "Resolve a refund request after a missed delivery commitment.",
          body: "An order is overdue and the customer asks to cancel it. AI brings together the delivery commitment, shipment progress, payment and refund terms; a responsible person decides the resolution.",
          stages: [
            [
              "Check the records",
              "Check the promised delivery, shipment progress, payment records and refund terms. If information is missing, wait for it before continuing."
            ],
            [
              "Approve the proposal",
              "A responsible person reviews the delivery evidence, order terms and customer request, then approves the resolution, exact amount and recipient. Execution waits until the proposal is approved."
            ],
            [
              "Carry out the refund",
              "Carry out the approved action. If a request times out, query the payment state before deciding whether a retry is safe."
            ],
            [
              "Confirm and close",
              "Confirm the refund with the payment system, record the customer notification and update the support case before closing it."
            ]
          ],
          rule: "A finished AI task is not enough: work remains open while a required system result, notification or acceptance condition is missing."
        },
        products: {
          eyebrow: "What supports the work",
          title: "Connect records, keep the process moving and run the AI.",
          body: "Workforce connects business information and permitted actions, coordinates the next step, and uses Agents for AI execution.",
          items: [
            {
              name: "Automation & Workflow",
              role: "Keep work moving",
              body: "Start work when a request arrives or a schedule is due. Retain progress while information or approval is missing, then continue.",
              proof: "Trigger · wait · continue · review"
            },
            {
              name: "Business Data & Actions (Objects)",
              role: "Connect records and allowed actions",
              body: "Give AI the order, shipment, payment and policy information it is allowed to use, together with explicitly permitted operations.",
              proof: "Records · relationships · permissions · system results"
            },
            {
              name: "Awaken Agents",
              role: "Run the AI",
              body: "Run the Agent that investigates and acts. Keep its task history, tool permissions and technical recovery attached to the execution.",
              proof: "Models · tools · task history · recovery"
            }
          ],
          path: "Connect records → AI and people follow the process → systems confirm results → review the delivery",
          rule: "Existing systems keep their formal order and payment records. Workforce uses those records and coordinates the work; each connection and action must be configured within the agreed scope."
        },
        scenarios: {
          eyebrow: "Choose a bounded first job",
          title: "Start with one request and a result the team can check.",
          body: "Refund handling is the example above. Other jobs can use the same approach; system access and capabilities are confirmed for each scope.",
          items: [
            {
              label: "Customer exceptions",
              title: "Resolve a refund request after a delivery delay",
              body: "Check the delivery commitment, shipment and refund terms, obtain approval and verify the result before closing the support case."
            },
            {
              label: "Software delivery",
              title: "Implement and review one bounded change",
              body: "Produce a change and its checks, then let the responsible person accept the result."
            },
            {
              label: "Operational exceptions",
              title: "Continue a process waiting on another system",
              body: "Make the missing information, permission or decision visible to the responsible person, then resume when it is available."
            }
          ]
        },
        advantage: {
          eyebrow: "Less manual coordination",
          title: "See the next step and the evidence that completes it.",
          body: "Agree on the work, its owner and completion conditions before execution. Progress, approvals and returned results remain available for review.",
          commonLabel: "Manual follow-up",
          awakenLabel: "With Workforce",
          proofLabel: "What you can check",
          items: [
            {
              title: "Know what still needs attention",
              common: "People piece together messages and system records to learn what remains open.",
              awaken: "Keep the responsible person, current progress and missing information together.",
              proof: "Who is responsible and what is missing"
            },
            {
              title: "Keep important decisions with people",
              common: "Approval requests and supporting information are passed between chats and tickets.",
              awaken: "Present the proposal and its evidence to the responsible person; wait for the decision before the action.",
              proof: "The approved action and its decision record"
            },
            {
              title: "Confirm the actual result",
              common: "Someone checks the payment result, sends the notification and closes the case.",
              awaken: "Collect the system results required by the workflow and retain the completion record for review.",
              proof: "Refund confirmation, notification and case closure"
            }
          ]
        },

      },
    },
  },

  zh: {
    meta: {
      title: 'AwakenWorks｜让 AI 成为受控的生产力',
      description: 'AwakenWorks 构建面向生产级 AI Agent 应用的开放基础设施。当前可从 Awaken Agents 的持久 Session、受控执行与恢复能力开始。',
    },
    nav: {
      awaken: 'Awaken 内部机制',
      products: '产品',
      resources: '资源',
      enterprise: '部署与合作',
      cases: '参考实现',
      integrations: '集成',
      blog: '博客',
      book: '书籍',
      principles: '可靠运行',
      docs: '文档',
      github: 'GitHub',
      run: '快速开始',
      menu: '菜单',
    },
    waitlist: {
      placeholder: 'you@company.com',
      fields: {
        email: '联系邮箱',
        company: '公司（选填）',
        role: '你的角色（选填）',
        stage: '目前进行到哪一步？（选填）',
        scenario: '你希望 AI 帮你完成什么？',
        loss: '目前有什么阻碍？（选填）',
        systems: '涉及哪些系统或约束？可多选（选填）',
        frequency: '这项工作预计多久发生一次？（选填）',
        timing: '希望何时开始（选填）',
        additional: '还有什么需要说明？（选填）',
      },
      jobPlaceholder: '例如：每天整理客户工单，标出需要人工处理的问题。',
      draftBlocked: '浏览器无法暂存草稿。填写内容仍在当前页面，请先提交或清空再切换语言。',
      draftRestored: '已保留切换语言前的填写内容。',
      additionalPlaceholder: '可补充约束、预期结果或问题。',
      privacyPrefix: '我同意 AwakenWorks 使用这些信息评估并跟进本次申请。详见',
      privacyLabel: '隐私说明',
      error: '申请未能提交。请重试，或发送邮件至 hello@awakenworks.com。',
      variants: {
        cooperation: {
          button: '联系团队',
          submitting: '提交中…',
          subject: 'AwakenWorks 需求沟通',
          success: '需求已收到',
          successBody: '我们争取在一个工作日内回复。',
          successSteps: ["我们阅读你的需求。", "回复问题或可自行尝试的路径。", "实施前一起确认范围、费用和责任。"],
        },
      },
    },
    home: {
      hero: {
        eyebrow: 'AwakenWorks · Agents + Workforce',
        title: '让 AI 成为',
        titleHighlight: '受控的生产力。',
        definition: "业务团队用 Workforce 连接资料、按流程推进工作；开发团队用 Agents 构建和运行 AI 应用。重要决定由人掌握。",
        ctaPrimary: "业务团队：看工作流程",
        ctaSecondary: '开发者开始使用',
      },
      workflow: {
        eyebrow: "客户异常与退款闭环",
        title: "从一次交付延期，到退款确认。",
        body: "用一项客户异常，看清跨系统工作怎样从请求走到结果。展开步骤可以查看细节。"
      },

      cta: {
        eyebrow: '开始使用',
        title: '告诉我们你想完成的工作。',
        body: '告诉我们你希望 AI 完成什么。开发者也可以自行运行 Agents 快速开始。',
        primary: '告诉我们你的工作',
        secondary: '开发者开始使用',
        questions: '先了解准备资料、配置与费用',
      },
    },
    enterprise: {
      partner: {
        title: "面向方案商与交付团队",
        body: "在多个客户项目中复用同一 Agents 底座。每次交付分别约定客户体验、系统接入、主交付方和支持责任。",
        action: "沟通方案交付合作",
        href: "/enterprise?product=agents&scenario=solution-delivery#apply"
      },

      questions: {
        eyebrow: "开始前的几个问题",
        title: "先了解怎样开始，再告诉我们你的工作。",
        items: [
          {
            key: "agent",
            question: "需要先有一个 Agent 吗？",
            answer: "可以先从想完成的工作开始。我们会讨论合适的能力与配置；开发者可以按现有 Agents 指南创建或接入 Agent。"
          },
          {
            key: "prepare",
            question: "需要准备哪些资料？",
            answer: "说明一项重复工作、涉及的系统与资料、负责人，以及团队可以检查的结果。其他细节可以在首次沟通后补充。"
          },
          {
            key: "setup",
            question: "谁负责系统接入和配置？",
            answer: "自行评估时由你的技术团队配置；需要实施时，双方在开始前约定系统访问、配置、部署和支持责任。"
          },
          {
            key: "cost",
            question: "费用怎样确认？",
            answer: "软件与模型用量、机器、系统接入和实施支持按范围分别确认。付费实施开始前，双方先约定费用和责任。"
          }
        ]
      },

      contextLabels: {
        "agent-product": "AI 应用开发",
        "enterprise-private-agent": "业务工作",
        "solution-delivery": "方案交付"
      },

      meta: {
        title: '告诉我们你的工作或 Agent 应用｜AwakenWorks',
        description: '约定一项工作、相关系统、负责人、质量基线、完整成本与验收条件。',
      },
      hero: {
        eyebrow: '沟通你的工作',
        title: '评估一项工作，约定可以检查的结果。',
        body: '告诉我们你想构建的应用，或希望 AI 接手的工作。我们会一起确认合适的产品、部署方式和下一步。',
        primary: '说明你的工作',
        secondary: '独立运行 Agents',
      },
      deliveryModes: {
        eyebrow: '运行与交付方式', title: '选择由谁运营你的部署。',
        body: '可以自行运行 Agents，也可以沟通企业部署或 Cloud 托管。产品访问与运营责任分别确认。',
        scopeLabel: '当前可用范围', operatorLabel: '谁负责运营',
        items: [
          { key: 'self-host', name: '自行运行 Agents', operator: '你的团队', body: '在自己的基础设施上运行 Agents，数据与凭据保留在自己的环境中。', status: publicVersionLabel('platform', 'zh'), action: '从源码开始使用', href: '/docs/agents/get-started' },
          { key: 'private', name: '企业部署', operator: '与你的团队约定责任', body: '在获准的企业环境中，确认部署、系统接入、备份和支持安排。', status: '按可用产品能力约定交付范围', action: '沟通部署方式', href: '/enterprise?product=agents#apply' },
          { key: 'cloud', name: 'Cloud 托管', operator: 'AwakenWorks 运营平台', body: 'Awaken 的托管交付方式。采用前先确认访问、可用能力和支持范围。', status: '托管预览 · 访问范围需确认', action: '询问托管可用范围', href: '/enterprise?product=agents#apply' },
        ],
      },
      paths: {
        eyebrow: '产品与可用状态',
        title: '两款产品，交付前确认范围与可用能力。',
        bringLabel: '请带来',
        decisionLabel: '第一个决策',
        detailsLabel: '需要准备的资料与实施范围',
        boundaryLabel: '当前边界',
        items: [
          { body: '自行运行产品，或在获准的基础设施边界内界定一个 Agent 应用。', bring: '一个希望构建或已在使用的应用、首个任务、模型与资料需求、部署约束和技术负责人。', decision: '一次范围受控的 4–6 周实施以 2–4 项发布检查为边界，其中包含权限决定与中断恢复路径，最终形成继续、调整或停止决定。', boundary: '进一步加固、集成、推广与支持，需要基于同一 Agents 底座重新界定服务范围。', docsHref: '/docs/agents/concepts/architecture', view: '查看 Agents', docs: '审阅实施细节', apply: '沟通 Agents 实施', query: 'agents' },
          { body: '连接业务资料和允许的操作，组织 Agent 与人持续完成一项重复工作并验收。', bring: '一项真实工作、源系统、责任人、人工决定、当前人工投入、完整成本与验收条件。', decision: '约定一次范围受控付费验证所需的交付物和可用能力，再根据记录的结果决定继续、调整或停止。', boundary: '申请预览后，先确认可提供的能力、集成、交付和支持范围。', docsHref: '/docs/workforce', view: '查看 Workforce', docs: '审阅工作与验收', apply: '评估一项 Workforce 工作', query: 'workforce' },
        ],
      },
      delivery: {
        eyebrow: '范围受控的付费验证',
        title: '约定工作、指标、完整成本与验收。',
        body: '标准验证围绕一项真实应用或重复工作、一个获准环境、一个集成和 2–4 项指标。周期、费用、责任和最终决定由签署的范围说明固定。',
        facts: [
          { value: '一个应用', label: '一个获准环境中的一个应用或重复 Job' },
          { value: '一个集成', label: '连接一个标准系统；增加系统需要变更范围' },
          { value: '2–4 项检查', label: '结果质量、剩余人工、完整成本，以及正常、批准与恢复路径' },
          { value: '继续 / 调整 / 停止', label: '由具名验收人依据已记录证据作出下一步决定' },
        ],
        deliverablesTitle: '你会收到',
        deliverables: ['一条可以运行的端到端路径', '按约定检查形成的验收记录', '包含运营与验收负责人的风险清单', '最终报告和明确的下一步决定'],
        responsibilitiesTitle: '双方分别负责什么',
        responsibilities: [
          { owner: 'AwakenWorks', body: '界定目标与边界，配置约定部署和集成，跑通正常、权限与恢复路径，并记录结果。' },
          { owner: '你的团队', body: '提供工作、基线、环境、受限访问、业务规则、技术负责人、决策人与最终验收人。' },
        ],
        boundary: '生产 SLA、大范围推广、额外集成、无限定制与长期运维不在本次范围内；这些工作需要在同一 Agents 底座上另行界定。',
      },

      form: {
        eyebrow: '沟通实施',
        title: '告诉我们你想完成什么。',
        body: '说明工作和希望得到的结果，留下邮箱；其他资料可以稍后补充。',
        productHelp: '交办业务工作选 Workforce；开发 AI 应用选 Agents。不确定时，可以在工作描述中告诉我们。',
        prepareTitle: '提交之后',
      },
      boundary: '当前访问方式见产品说明。系统接入与交付范围在实施前确认。',
    },
    privacy: {
      meta: { title: '隐私说明｜AwakenWorks', description: 'AwakenWorks 官网如何处理联系、机会、归因和分析数据。' },
      eyebrow: '网站隐私',
      title: '隐私说明',
      updated: '最近更新：2026 年 10 月 10 日',
      intro: '本说明适用于 AwakenWorks 公开网站及企业部署与实施表单，不涉及客户自行运营的 Awaken 部署中所处理的数据。',
      sections: [
        { title: '你主动提供的信息', paragraphs: ['提交表单时，我们会收到你选择填写的联系方式、公司与角色、希望讨论的工作、涉及系统、时间、同意状态，以及推荐来源或活动信息。', '请勿通过网站表单发送密码、凭据、生产数据、个人档案或其他秘密。'] },
        { title: '语言切换与未提交表单', paragraphs: ['在同一浏览器标签页切换语言时，网站会在标签页会话中暂存尚未提交的填写内容。目标表单检查草稿时立即删除，仅恢复十分钟内的内容。草稿内容不会进入网址参数或网站分析。'] },
        { title: '网站分析', paragraphs: ['网站使用 Umami 记录匿名页面与交互分析，包括页面、语言、活动、具名转化事件，以及位置、产品和目标等有限事件上下文。我们用这些信息改善导航，并了解哪些内容把读者带到文档、GitHub 或合作沟通。网站不会把表单联系方式或自由文本发送给 Umami，也不使用广告 Cookie。'] },
        { title: '如何使用表单信息', paragraphs: ['在一次浏览器会话内，网站会保存首次与最近一次活动或推荐来源，使提交的请求能够保留沟通如何开始，以及后来哪个活动把访问者带到表单。我们使用表单内容回复沟通，判断自行评估还是一次范围受控的实施更适合作为下一步，并为后续交流做准备。表单被接收不会自动成为合格机会。'] },
        { title: '服务商与跨境处理', paragraphs: ['网站默认把表单发送到 Formspree，并由 Umami Cloud 处理分析数据。部署可以改用其他表单端点或自托管 Umami。这些服务商可能依据各自条款，在其他司法辖区处理信息。', 'Formspree 和 Umami 不是正式合作记录。如果申请成为合格机会，工作记录会进入公司 CRM；已签署协议和交易记录仍是正式业务记录。'] },
        { title: '保留期限与你的请求', paragraphs: ['我们只在理解和跟进请求、记录业务关系，或满足运营与法律要求所需的期限内保留询问信息。你可以请求访问、更正或删除；协议、争议、安全事项或法律义务所需的记录可能需要保留更久。'] },
        { title: '变更与联系', paragraphs: ['如有问题或数据请求，请发送邮件至 hello@awakenworks.com。网站的数据路径、服务商或使用目的发生变化时，我们会更新本说明。'] },
      ],
      contactLabel: '发送隐私问题或数据请求',
      contactHref: 'mailto:hello@awakenworks.com',
    },
    integrations: {
      meta: {
        title: 'Awaken Agents 集成｜AwakenWorks',
        description: '选择经过验证的协议或应用集成入口，再进入 Awaken Agents 权威文档查看当前支持范围。',
      },
      eyebrow: '集成入口',
      title: '从应用已经使用的协议接入。',
      body: '这个目录只负责选择入口。每张卡片都链接到拥有当前行为、限制、配置和验证方法的权威技术指南。',
      boundary: '这里不是第二份兼容矩阵。链接的文档仍是权威；文档中的支持范围也不代表已有客户部署。',
      quickstart: '运行 Agents 快速开始',
      compatibility: '查看经测试的兼容基线',
      items: [
        { key: 'managed-agents', name: 'Managed Agents API', body: '根据 Awaken 经测试的兼容基线评估现有 Managed Agents 客户端。', action: '打开协议指南', href: '/docs/agents/protocols/managed-agents' },
        { key: 'ai-sdk', name: 'AI SDK', body: '把前端连接到已发布 Agent，并验证 Session 与事件路径。', action: '打开集成指南', href: '/docs/agents/how-to/integrate-ai-sdk-frontend' },
        { key: 'ag-ui', name: 'AG-UI 与 CopilotKit', body: '沿权威指南把已发布 Agent 通过 AG-UI 连接到 CopilotKit 客户端。', action: '打开集成指南', href: '/docs/agents/how-to/integrate-copilotkit-ag-ui' },
        { key: 'mcp', name: 'MCP', body: '查看当前 MCP 范围，并把连接与 ToolSet 策略作为一个整体配置。', action: '打开协议指南', href: '/docs/agents/protocols/mcp' },
        { key: 'a2a', name: 'A2A', body: '在文档规定的 Agent 与 Session 权威边界内连接 A2A server。', action: '打开协议指南', href: '/docs/agents/protocols/a2a' },
        { key: 'acp', name: 'ACP', body: '选择并运营文档支持的 ACP runtime，不创建第二个 Session 权威。', action: '打开协议指南', href: '/docs/agents/protocols/acp' },
      ],
    },
    cases: {
      meta: {
        title: 'Built on Awaken：参考应用与参考实现',
        description: '按产品形态选择参考实现，尝试最小可用路径，并看清应用保留什么、Awaken 提供什么。',
      },
      eyebrow: 'Built on Awaken',
      title: '基于 Awaken 构建的参考应用。',
      body: '看看我们怎样基于 Agents 构建任务界面、工作台和设计工具。每个参考应用分别说明用途、源码获取方式与当前验证范围。',
      items: [
        {
          slug: 'pilot',
          ...caseSources['pilot'],
          walkthrough: null,
          kind: '自建参考应用',
          name: 'Awaken Pilot',
          adoption: '创建轻量 Agent 应用',
          title: '为任务提供进度、批准和交付物界面。',
          problem: '产品想法已经清楚，但第一个原型仍要处理任务状态、进展、审批、计划任务、文件与恢复。',
          firstWin: '用 Plan 或 Execute 运行一个边界明确的 Mission，再从同一个 Session 查看进展和结果。',
          summary: 'Pilot 保持很薄：Mission 对应 Awaken Session，Project 选择 Deployment。用户可以看到计划、进展、文件、审批与结果，底层不再增加第二套任务引擎。',
          audience: '希望用最短路径把产品体验连接到持久执行的 Agent 产品团队。',
          owned: '产品文案、Mission 交互、验收标准与 UI 投影。',
          reused: 'Agent、Deployment、Session、Run、事件、文件、工具、策略、Worker、Sandbox 与恢复。',
          status: '提供固定源码包的参考实现',
          sourceStatus: '固定版本源码包包含共享构建依赖，已通过独立源码目录安装、本地检查和构建。这个公开版本仍有运行接口兼容缺口，尚未通过完整真实 Agent 验收，目前作为源码参考提供。',
          proof: [
            { level: '测试通过', claim: 'Execute 与 Plan 共用一份 Session 日志。', owner: 'Pilot Web 与 API 测试套件' },
            { level: '测试通过', claim: '审批、预算、Skills、MCP、子 Agent、Artifact 与计划任务复用 Awaken 契约。', owner: 'pnpm check' },
            { level: '真实栈待发布', claim: '真实栈验收协议包含中断与恢复，但 live 结果还没有发布。', owner: 'docs/real-stack-acceptance.md' },
          ],
          try: ['从一个 Mission 和一条可见验收标准开始', '中断或审批一次，再确认同一个 Session 可以继续', '只在应用里保留用户真正需要的产品投影'],
          primary: { label: '运行 Awaken 快速开始', href: '/docs/agents/get-started' },
          secondary: { label: '了解 Session 管理', href: '/docs/agents/how-to/manage-a-session' },
          engineeringBlog: { label: '阅读实现决策与失败边界', href: '/blog/2026-08-build-manus-style-agent-product' },
          cta: '查看 Pilot 参考实现',
        },
        {
          slug: 'deepseek-harness',
          ...caseSources['deepseek-harness'],
          walkthrough: { src: caseSources['deepseek-harness'].walkthroughSrc, caption: '确定性 Managed API 演示 · 使用夹具数据，不代表真实 DeepSeek 账户结果' },
          kind: '独立参考复现',
          name: 'DeepSeek Workbench on Awaken Agents',
          adoption: '开发高级 Agent Workbench',
          title: '保留工作台体验，让 Agents 执行任务。',
          problem: '强交互 Workbench 需要 Preset、Plan、审批、Trajectory、Thread 与 Files。先重做 Agent loop，会推迟用户真正看得见、能够判断的部分。',
          firstWin: '启动一个由 Preset 驱动的 Session，审阅 Plan、批准工具，并在中断后重新打开同一条 Trajectory。',
          summary: '这个独立参考实现拥有 Preset、Trajectory、审批、Skill、子 Agent 与 deliverable 等 Workbench 体验；浏览器和产品 API 只是 Awaken Session 与 committed Events 的投影。',
          audience: '正在开发 Agent IDE、编码工作台或其他强交互 Agent 产品的团队。',
          owned: 'Preset UX、浏览器偏好、产品投影，以及无状态 Workbench Session API 与 Interaction MCP。',
          reused: 'Managed Session、事件、模型路由、凭据、工具、权限、压缩、资源、子 Agent、Worker 与 Sandbox。',
          status: '具有确定性演示与真实浏览器证据的参考实现',
          sourceStatus: '固定源码包含共享依赖，已通过本地检查、桌面与窄屏浏览器流程，以及本地 Kubernetes 上一次新的真实 DeepSeek 验收。视频展示确定性演示；平台发布资格与客户结果另行验收。',
          proof: [
            { level: 'Fixture 测试通过', claim: '确定性 Managed API Demo 贯穿浏览器、Workbench Session API、官方 SDK 与已提交事件投影。', owner: 'e2e/harness.spec.ts' },
            { level: '契约已审计', claim: 'Native、Equivalent、Presentation 与 Unavailable 能力都有明确边界。', owner: 'docs/ui-parity.md' },
            { level: '真实浏览器验收通过', claim: '本地 Kubernetes 的新运行覆盖四种 Preset、实际 Skill 交付、权限、工具、Plan、Creator、提问、委派与重连。', owner: 'e2e/live/harness-live.spec.ts' },
          ],
          try: ['先运行确定性 Demo，再添加模型供应商凭据', '沿浏览器、产品 API 与已提交事件追踪一条 Preset Session', '用自己的已发布 Agent 替换 fixture，不在浏览器增加执行状态'],
          primary: { label: '接入已发布 Agent', href: '/docs/agents/how-to/connect-a-published-agent' },
          secondary: { label: '了解 AI SDK 边界', href: '/docs/agents/protocols/ai-sdk' },
          engineeringBlog: null,
          cta: '查看独立参考实现',
        },
        {
          slug: 'design',
          ...caseSources['design'],
          walkthrough: null,
          kind: '自建参考应用',
          name: 'Awaken Design',
          adoption: '构建领域型 AI 产品',
          title: '把一次 AI 设计生成，变成可评审、可修改、可明确验收的结果。',
          problem: '当团队需要比较版本、把反馈绑定到精确结果、拒绝不安全输出并交付唯一选定设计时，聊天记录不是合适的产品模型。',
          firstWin: '提交设计需求，查看生成的版本，提出修改，再选定并导出要交付的设计。',
          summary: 'Design 保存设计项目、版本、评审和最终选定的设计；Agents 运行生成任务，处理文件与中断恢复。',
          audience: '希望把 AI 生成结果做成可修改、可评审、可交付产品的开发团队。',
          owned: '设计项目、版本、评审记录、安全预览和最终交付物。',
          reused: 'Agent、Environment、Session、Run、执行期 File、工具、事件、Worker、Sandbox 与恢复。',
          status: '已通过本地验收的参考实现',
          sourceStatus: '这个第一方参考实现仍在本地。固定应用基线通过了 411 项测试且无跳过，包括固定本地 Kubernetes 部署上的真实 DeepSeek 初始与子 Revision 生成、桌面和手机浏览器交互、验收及 ZIP 交付。公开源码包仍待发布；生产登录与部署，以及外部用户效果仍待验证。',
          proof: [
            { level: '源码已核对', claim: '当前实现保留唯一的不可变 Revision 与 Artifact 发布 owner。', owner: 'Awaken Design architecture 与 ADR' },
            { level: '已有测试覆盖', claim: '2026-10-10 的本地验收通过 411 项测试且无跳过，覆盖发布、评审、验收、存储与浏览器交付。', owner: 'Awaken Design 测试套件' },
            { level: '真实本地流程', claim: '两个自然结束的 DeepSeek Run 发布初始与子 Revision；独立桌面和手机浏览器验证了子版本交互、验收及 ZIP 导出。生产部署、100 案例语义基准与客户结果仍未通过验收。', owner: 'Awaken Design 2026-10-10 验收记录' },
          ],
          try: ['为项目、版本和最终交付物分别保留清晰记录', '把生成文件保存为可评审的版本，再发布选定结果', '让用户可以修改、评审并明确选定要交付的设计'],
          primary: { label: '构建 Agent 驱动的产品', href: '/docs/agents/how-to/build-an-agent-with-the-assistant' },
          secondary: { label: '阅读架构指南', href: '/docs/agents/concepts/architecture' },
          engineeringBlog: { label: '阅读发布与验收的工程决策', href: '/blog/2026-08-build-claude-design-style-workflow' },
          cta: '查看 Awaken Design 参考实现',
        },
      ],
    },
    products: {
      eyebrow: '两款产品，分别说明可用范围',
      title: '按用途选择产品。',
      agents: {
        tone: 'iris',
        layer: 'Managed Agents 兼容平台',
        status: publicVersionLabel('platform', 'zh'),
        license: 'Apache-2.0',
        audience: '面向开发团队',
        name: 'Awaken Agents',
        role: '构建和运行 AI 应用',
        tagline: canonicalEntities.zh.agents,
        points: [
          '让 Managed Agents、AI SDK、AG-UI 与 A2A 客户端进入同一份 Session 历史。',
          '选择模型、Agent Runtime 与工具位置，不改变应用面对的契约。',
          '先从单进程开始，确有运营需要时再加入 Worker 与隔离 Sandbox。',
        ],
        cta: '了解怎样开始使用',
        href: '/agents',
      },
      workforce: {
        tone: 'rust',
        layer: '工作与验收',
        status: publicVersionLabel('flow', 'zh'),
        license: '可申请提前体验',
        audience: '面向业务团队',
        name: 'Awaken Workforce',
        role: '让 AI 按流程完成业务工作',
        tagline: '让责任、例外与验收始终相连，直到工作完成。',
        points: [
          '持久化 Issue 跨越多次尝试与交接，持续保存意图和责任。',
          '依赖关系与 Reaction 自动唤醒已经具备条件的工作。',
          '人继续掌握意图、例外、审批和重大行动。',
        ],
        cta: '了解怎样申请预览',
        href: '/workforce',
      },
    },
    footer: {
      tagline: canonicalEntities.zh.company,
      rights: '© 2026 AwakenWorks. 产品许可因产品而异。',
      cols: [
        {
          title: '资源',
          links: [
            { label: '企业部署与实施', href: '/enterprise' },
            { label: '集成', href: '/integrations' },
            { label: '参考实现', href: '/cases' },
            { label: '文档', href: '/docs' },
            { label: '博客', href: '/blog' },
            { label: '书籍', href: '/book' },
          ],
        },
        {
          title: '社区',
          links: [
            { label: 'Star Awaken', href: AWAKEN_GITHUB_URL },
            {
              label: '讨论区',
              href: 'https://github.com/AwakenWorks/awaken/discussions',
            },
            { label: 'YouTube', href: 'https://www.youtube.com/@awakenworks-ai' },
          ],
        },
        {
          title: '联系',
          links: [
            { label: 'hello@awakenworks.com', href: 'mailto:hello@awakenworks.com' },
            { label: '可靠运行与开放原则', href: '/principles' },
            { label: '隐私说明', href: '/privacy' },
          ],
        },
      ],
    },

    landing: {
      agents: {
        tone: 'iris',
        eyebrow: 'Awaken Agents · Agent 应用基础设施',
        status: { label: publicVersionLabel('platform', 'zh'), tone: 'iris' },
        title: '构建并运行你的 AI Agent 应用。',
        subtitle: '发布 Agent、接入应用、查看任务进度与结果。运行环境、资料访问和工具权限由你选择。',
        ctaPrimary: { label: '运行 Agents 快速开始', href: '/docs/agents/get-started' },
        audience:
          '面向 Agent 应用开发者与企业技术团队。',
        fit: {
          eyebrow: '何时选择 Awaken',
          title: '当产品需要统一管理 Agent 执行时，使用 Awaken。',
          body: '可以创建 Agent、采用受支持的 Agent，或接入已有行为。应用保留产品体验和业务规则，Awaken 负责运行 Agent。',
          items: [
            { title: '把 Agent 接入自己的产品', body: '让后端、Web 界面、Copilot 或 Agent-to-Agent 客户端连接同一个已发布 Agent。' },
            { title: '让工作跨越单次连接', body: '从已提交事件创建并重新打开持久 Session，不把工作绑定到一次请求或一个浏览器。' },
            { title: '改变执行方式而不分叉产品', body: '在同一个 Session 权威背后使用 Native 执行、受支持的 ACP Runtime 或远端 A2A Agent。' },
            { title: '掌控并扩展运营边界', body: '先用 AllInOne，再在隔离、容量或责任需要时拆分 Control、Coordinator 与 Worker。' },
          ],
          boundary: '短时 prompt、受信任的一次性本地脚本，或完全委托的托管服务未必需要 Awaken。只有当 Session 连续性、受控执行或可复用应用基础设施成为产品要求时，才应选择它。',
        },
        boundary: {
          eyebrow: '系统职责',
          title: '应用负责产品，Awaken 负责 Agent 执行。',
          body: '当前 Awaken 源码实现了下列职责划分。文档定义精确的 API、schema、部署步骤和兼容版本。',
          owners: [
            { key: 'control', title: 'Control', body: '拥有 Agent 与 Environment 定义、不可变 revision 与 publication、IAM 和凭据引用。' },
            { key: 'coordinator', title: 'Coordinator', body: '拥有可执行 projection、持久 Session 与 Run、dispatch、已提交事件和公开 replay。' },
            { key: 'worker', title: 'Worker + Runtime', body: 'Worker 以 claim fence 领取工作，并拥有 Sandbox 与进程生命周期；其内嵌 Rust Runtime 执行 Agent loop、工具、权限、类型化状态与原子 step，但不是第二个服务权威。' },
          ],
          lifecycleTitle: '发布与恢复流程',
          lifecycle: [
            '发布不可变的 Agent 与 Environment revision。',
            '创建 Session，并固定精确的可执行引用。',
            '在 Coordinator 中记录工作并幂等投影 dispatch。',
            '由符合条件的 Worker 领取 dispatch，并在自身 Sandbox 边界内执行。',
            '事件与状态先经过 Session 权威提交，再成为公开 replay。',
            '依据已提交的 Session 事实与配置策略重新连接或恢复。',
          ],
          failureTitle: '失败结果',
          failures: [
            { title: '需要权限决定', body: '提交等待状态与持久 resume ticket；只有决定完成后才继续。' },
            { title: 'Worker 中断', body: '依据已提交事实与 claim fence 恢复符合条件的工作，不建立另一个 Session owner。' },
            { title: '外部结果不确定', body: '记录 indeterminate 终止原因，绝不把不确定执行投影为成功。' },
          ],
          link: { label: '阅读完整架构与恢复模型', href: '/docs/agents/concepts/architecture' },
        },
        outcomes: {
          eyebrow: '产品开发',
          title: '使用 Awaken 管理 Agent 执行和 Session。',
          body: '应用负责产品体验、领域状态、工作流、结果验收和商业关系。Awaken 管理 Agent 生命周期。',
          items: [
            { title: '交付一个真实 Agent 应用', body: '发布 Agent，创建并重新打开同一个 Session，接入资源与权限并运营执行路径，不必再拼装一套后台。', proof: 'Agent 发布 · Session 与事件 · 资源 · Worker 与 Sandbox' },
            { title: '保留现有应用投入', body: '保留经过测试的官方 SDK 模型，让 Web、Copilot 或 Agent-to-Agent 界面接入同一个已发布 Agent，而不是复制一份。', proof: 'Managed Agents · AI SDK · AG-UI · A2A' },
            { title: '保留有差异的 Agent 行为', body: '选择 Awaken Native、受支持的 ACP Runtime 或远端 A2A Agent，不建立第二套 Session 权威。', proof: 'Native · ACP · outbound A2A' },
            { title: '在企业边界内运行', body: '把控制、Session 数据、凭据、模型路由、Worker 与 Sandbox 放进获准的基础设施和责任边界。', proof: '自托管 · 企业交付 · 托管预览' },
          ],
        },
        reliability: {
          eyebrow: '失败处理',
          title: '从已提交的 Session 状态恢复。',
          body: 'Awaken 依据已提交事实和明确恢复策略推进，不假定所有外部副作用都可以安全重放。',
          items: [
            { key: 'reconnect', value: '用户重新连接', label: '从已提交事件重新打开同一个 Session，不依赖某个浏览器或进程。', proof: '持久 Session', href: '/docs/agents/concepts/sessions-and-events' },
            { key: 'interrupt', value: 'Worker 或进程中断', label: '依据已提交事实恢复符合条件的工作，并按照配置的恢复策略继续。', proof: '恢复边界', href: '/docs/agents/concepts/production-reliability' },
            { key: 'permission', value: '工具请求敏感操作', label: '在工具执行前允许、拒绝，或暂停并等待人工决定。', proof: '权限与 HITL', href: '/docs/agents/runtime/how-to/enable-tool-permission-hitl' },
            { key: 'inspect', value: '操作者需要解释过程', label: '沿执行路径检查事件、trace 与审计历史。', proof: '可观测性', href: '/docs/agents/runtime/how-to/enable-observability' },
            { key: 'boundary', value: '数据与工具必须留在内部', label: '把控制、Session 数据、凭据、Worker 与 Sandbox 放在获准的基础设施边界内。', proof: '自托管', href: '/docs/agents/how-to/self-host' },
          ],
        },
        advantage: {
          eyebrow: 'Managed Agents 兼容性',
          title: '保留应用契约，并选择 Agent 的运行方式。',
          body:
            'Anthropic Managed Agents 定义了一套实用的应用契约。Awaken 实现经过测试的兼容基线，并围绕同一个 Agent 与 Session 权威增加明确的客户端、执行、模型和部署选择。',
          commonLabel: 'Managed Agents 基线',
          awakenLabel: 'Awaken 增强',
          proofLabel: '这意味着',
          items: [
            {
              title: '沿用官方 SDK 应用模型',
              common: '使用官方 Managed Agents API 与 SDK 资源模型。',
              awaken: '把已审阅的 SDK 版本指向 Awaken，配置 Awaken 认证，并保留具名兼容范围内的请求与响应结构。',
              proof: '减少迁移工作，同时让精确差异可检查',
            },
            {
              title: '接入不止一种产品界面',
              common: 'Managed Agents 客户端通过 Managed API 接入。',
              awaken: 'Managed Agents、AI SDK、AG-UI 与 A2A 投影同一个已发布 Agent 和已提交 Session 历史。',
              proof: '一个 Agent 复用于后端、Web、Copilot 与 Agent 协作产品',
            },
            {
              title: '选择 Agent 的执行行为',
              common: '在 Anthropic 服务模型中使用托管 Sandbox 或 self-hosted environment worker。',
              awaken: '选择 Native 执行、受支持的 ACP Agent Runtime 或远端 A2A endpoint，不改变客户端契约。',
              proof: '保留已有 Agent 行为，并为不同产品选择合适执行路径',
            },
            {
              title: '选择由谁掌握平台边界',
              common: '平台控制面与持久服务由 Anthropic 运营。',
              awaken: 'API、Session 数据、凭据、模型路由、Worker 与 Sandbox 可以由您的团队部署运营，也可以采用 AwakenWorks 交付方式。',
              proof: '满足企业部署和运营责任要求',
            },
          ],
        },
        decisions: {
          eyebrow: '技术指南',
          title: '根据当前问题选择指南。',
          body: '先运行快速开始，再通过文档检查兼容性、架构、恢复、部署或 Runtime 内部机制。',
          items: [
            { key: 'compatibility', title: '迁移已有客户端', body: '改变应用前，检查已审阅 SDK 版本、支持资源、必需 selector 与已知差异。', action: '查看兼容范围', href: '/docs/agents/compatibility' },
            { key: 'architecture', title: '审阅权威与恢复', body: '沿着各自权威边界，理解 publication、Session、dispatch、Worker 执行、已提交事实、失败与恢复。', action: '阅读架构', href: '/docs/agents/concepts/architecture' },
            { key: 'self-host', title: '选择部署边界', body: '规划 AllInOne 或拆分服务，以及数据和凭据保管、Worker、Sandbox、观测、备份与运营责任。', action: '打开自托管指南', href: '/docs/agents/how-to/self-host' },
            { key: 'runtime', title: '理解 Runtime 边界', body: '在选择接入路径前，先区分 Agent 执行与外围 Session、Worker、Sandbox、协议和运营责任。', action: '定义 Agent Runtime', href: '/docs/agents/concepts/agent-runtime' },
          ],
        },
        closer: {
          title: '先运行一个 Session，再规划更大的部署。',
          body: '可以从源码自行评估，当前尚无稳定发布包。如果需要接入、部署或支持方面的帮助，请联系我们。',
          cta: { label: '企业部署服务', href: '/enterprise?product=agents#enterprise-agents' },
        },
      },
      objects: {
        eyebrow: 'Workforce 能力 · 业务数据与受控操作（Objects）',
        title: '让应用和 Agent 使用同一份类型化业务记录。',
        subtitle: '把现有系统中的身份、关系与允许的变化，整理成有类型、有版本、有明确来源的对象记录。',
        audience: '面向数据、业务系统、运营和内部应用团队。选择一类关键业务对象，并找到已经拥有它的系统。',
        docs: '阅读 Objects 文档',
        star: 'Star Awaken 开源基础',
        example: {
          eyebrow: '从一个对象开始',
          title: '先定义一个业务对象，再连接更多系统。',
          body: '以订单为例：定义它的身份和字段，把它连接到客户，记录每次观察来自哪个系统，并且只开放该系统允许的动作。这个例子说明可配置的产品能力，并不代表内置了订单方案。',
          items: [
            { title: '描述对象', body: 'Pack 固定 ResourceType schema、关系、Action、受限呈现提示与精确定义 revision。' },
            { title: '完整展示业务数据', body: '通用 Objects 界面展示声明的字段与嵌套值，不为供应商增加前端分支。' },
            { title: '开放允许的动作', body: 'Pack 定义的 Action 描述输入与影响，并要求授权、预期 revision 与幂等边界。' },
          ],
        },
        model: {
          eyebrow: 'Objects 拥有什么',
          title: 'Objects 与 Agent memory 分开保存业务记录。',
          body: 'Objects 保存应用和 Agent 可以使用的类型化记录，区分平台拥有的状态与外部系统控制的状态，也不会把一次 Connector observation 当成独占权威。',
          items: [
            ['类型、数据与身份', 'ResourceType 定义数据契约和可选呈现提示；Resource 保存身份、完整属性、精确类型 revision 与生命周期。'],
            ['快照与关系', '可使用的 ResourceSnapshot 固定一个 revision；Relation 连接精确对象，通用界面解析人类可读标签而不猜测最新值。'],
            ['观察与来源', 'Connector observation 保留 provider 或 fallback 身份、机制、时间与可选的 provider 顺序证据。'],
            ['动作与回执', 'Action 自己拥有字段 schema 与影响文案；只读、幂等和变更 Action 复用同一条授权与 revision-fenced 执行路径。'],
          ],
        },
        change: {
          eyebrow: '一次受治理的变化',
          title: '源系统返回结果后，Objects 才记录变化。',
          steps: [
            ['01', '观察', 'Connector 带回规范化的身份、属性、关系与 provenance。'],
            ['02', '形成视图', 'Objects 提供精确的类型化 snapshot，而不是没有版本的“最新值”。'],
            ['03', '提出动作', '人、应用或 Agent 提交具名 Action，并带上预期 revision 与幂等 key。'],
            ['04', '授权并调用', 'Objects 检查权限与 revision，再进入已配置的 provider 边界。'],
            ['05', '记录结果', '回执与下一次 observation 让获准的使用者看到外部系统接受的结果。'],
          ],
        },
        boundary: {
          eyebrow: '边界',
          title: '源系统仍然是权威。',
          items: [
            { title: '不是数据仓库', body: 'Objects 不替代分析存储，也不要求先接入所有来源才能建立一个有用对象。' },
            { title: '不是 Agent memory', body: '一次 Run 组装的 context 只是对象记录的使用者，不能拥有它的生命周期。' },
            { title: '不是通用写权限', body: 'Agent 只能提出已声明的 Action；每次调用都重新检查当前授权与 revision。' },
          ],
        },
        closer: {
          title: '定义一个对象、一个来源和一个允许的动作。',
          body: '你可以先了解当前模型；如果已有明确的对象和源系统边界，可以申请提前体验。',
          cooperation: '申请提前预览',
        },
      },
      workforce: {
        eyebrow: 'Awaken Workforce · 工作、责任与验收',
        status: { label: publicVersionLabel('flow', 'zh'), tone: 'rust' },
        title: '让 AI 处理日常工作，把重要决定交给你。',
        subtitle:
          '让 AI 按规则读取资料、完成操作、请求审批。你能看到工作进度，并检查交付结果。',
        audience: '面向业务与运营团队。从一项重复工作和一个可检查的结果开始。',
        ctaPrimary: {
          label: '查看工作流程预览',
          href: '/workforce#workforce-preview',
        },
        ctaDocs: { label: '阅读 Workforce 文档', href: '/docs/workforce' },
        ctaSecondary: { label: '验证一项真实工作', href: `/enterprise?product=workforce&scenario=${REFUND_SCENARIO_KEY}#apply` },
        loop: {
          eyebrow: "客户异常与退款闭环",
          title: "处理客户的延期交付退款申请，直到结果确认。",
          body: "订单超过约定交付时间，客户要求取消。AI 汇总交付承诺、物流进度、付款与退款条款，负责人决定处理方案。",
          stages: [
            [
              "核对资料",
              "核对交付承诺、物流进度、已付款记录与退款条款。资料不足时等待补充，齐备后继续。"
            ],
            [
              "批准方案",
              "负责人结合履约记录、订单条款与客户诉求，批准处理方案、退款金额与对象。方案未获批准时，操作保持等待。"
            ],
            [
              "执行退款",
              "执行已经批准的操作。请求超时时先查询支付状态，再判断是否可以安全重试。"
            ],
            [
              "确认并关闭",
              "由支付系统确认退款，记录客户通知并更新服务工单，结果齐备后再关闭。"
            ]
          ],
          rule: "AI 的一次任务结束还不够：所需的系统结果、通知或验收条件缺失时，工作仍保持未完成。"
        },
        products: {
          eyebrow: "工作背后的能力",
          title: "连接业务资料，推进流程，让 AI 执行。",
          body: "Workforce 连接资料与允许的操作，安排下一步，并使用 Agents 执行 AI 任务。",
          items: [
            {
              name: "自动触发与流程推进",
              role: "让工作持续推进",
              body: "收到请求或到达约定时间时启动工作。缺资料或需要批准时保留进度，条件满足后继续。",
              proof: "触发 · 等待 · 继续 · 检查"
            },
            {
              name: "业务数据与受控操作（Objects）",
              role: "连接资料和允许的操作",
              body: "把 AI 可以使用的订单、物流、付款与规则资料连起来，并明确允许它执行哪些操作。",
              proof: "记录 · 关系 · 权限 · 系统结果"
            },
            {
              name: "Awaken Agents",
              role: "运行 AI 任务",
              body: "运行负责调查和操作的 Agent，保存任务记录，管理工具权限并处理执行中断。",
              proof: "模型 · 工具 · 任务记录 · 恢复"
            }
          ],
          path: "资料就绪 → AI 和人按流程处理 → 系统返回结果 → 检查交付物",
          rule: "订单、付款等正式记录仍由原业务系统保管。Workforce 使用这些资料并组织工作；每项系统连接与操作都需要按约定范围配置。"
        },
        scenarios: {
          eyebrow: "选择第一项工作",
          title: "从一个请求和团队可以检查的结果开始。",
          body: "上方以退款处理为例。其他工作可以沿用同样的方法，系统访问与可用能力按每次范围确认。",
          items: [
            {
              label: "客户异常",
              title: "处理交付延期引发的退款申请",
              body: "核对交付承诺、物流与退款条款，取得批准并确认处理结果，再关闭服务工单。"
            },
            {
              label: "软件交付",
              title: "实现并复核一项范围明确的变更",
              body: "交付变更和检查结果，再由负责人确认是否接受。"
            },
            {
              label: "运营例外",
              title: "继续一项正在等待外部系统的流程",
              body: "把缺少的资料、权限或决定交给负责人，条件满足后继续。"
            }
          ]
        },
        advantage: {
          eyebrow: "减少人工交接与催办",
          title: "看清下一步，保留完成工作的依据。",
          body: "执行前约定工作、负责人和完成条件。过程中保留进度、批准和返回结果，方便团队检查。",
          commonLabel: "人工跟进",
          awakenLabel: "使用 Workforce",
          proofLabel: "你可以检查",
          items: [
            {
              title: "知道还有什么需要处理",
              common: "人从消息和系统记录中重新整理剩余工作。",
              awaken: "把负责人、当前进度和缺少的资料放在一起。",
              proof: "谁负责、还缺什么"
            },
            {
              title: "重要决定由人掌握",
              common: "批准请求和相关依据在聊天与工单之间传递。",
              awaken: "把方案和依据交给负责人，等决定明确后再执行操作。",
              proof: "获准的操作与批准记录"
            },
            {
              title: "确认实际处理结果",
              common: "人查询退款状态、通知客户，再关闭工单。",
              awaken: "收集流程要求的系统结果，保存完成记录供团队检查。",
              proof: "退款确认、客户通知与工单关闭"
            }
          ]
        },

      },
    },
  },
} as const;

export type Content = (typeof content)[Lang];

// Localized product presentation derives from the release catalog, never a second list.
export function publicProductEntries(lang: Lang) {
  return Object.entries(publicProducts).map(([key, metadata]) => ({
    key: key as keyof typeof publicProducts,
    ...metadata,
    ...content[lang].products[key as keyof typeof publicProducts],
  }));
}
