import type { Lang } from './locales';

export const ui = {
  en: {
    routes: {
      blog: { title: 'Blog — AwakenWorks', description: 'Engineering notes, product progress, and reproducible build records from AwakenWorks.' },
      principles: { title: 'Our principles — AwakenWorks', description: 'Four commitments that guide how AwakenWorks builds, operates, and describes Agent infrastructure.' },
      docs: { title: 'Documentation — AwakenWorks', description: 'Find Awaken getting-started, building, architecture, operations, and reference documentation by task.' },
      objectsDocs: { title: 'Awaken Objects documentation | AwakenWorks', description: 'Model business objects, Resources, Relations, Connectors, and governed actions with Awaken Objects.' },
      caseTitle: (name: string) => `${name} | Built on Awaken`,
      blogTitle: (title: string) => `${title} — AwakenWorks`,
    },
    common: {
      theme: 'Toggle light / dark theme',
      githubStar: 'Star on GitHub',
      openPath: 'Open path →',
    },
    home: { titleClass: '', allCases: 'View every reference build and evidence boundary' },
    blog: {
      eyebrow: 'Engineering notes',
      title: 'Start with a real problem. Show how we worked through it.',
      intro: 'These articles come from building Awaken, Pilot, and Awaken Design. Each one starts with the problem, then works through design choices, implementation, failure handling, and what remains unresolved.',
      topics: ['Product design', 'System architecture', 'Operations and recovery'],
      docs: 'Open technical docs', archive: 'Article archive', read: 'Read', empty: 'No posts yet.', back: 'Blog',
    },
    cases: {
      disclaimer: 'These pages document our own builds. They are not customer stories and do not represent customer adoption or endorsement.',
      all: 'All reference builds', bestFor: 'Best for: ', deepSeek: 'This is an independent reference reimplementation. It does not imply a DeepSeek partnership, sponsorship, or endorsement.',
      situation: 'The situation', firstResult: 'First useful result', productShape: 'Product shape', applicationKeeps: 'Your application keeps', awakenProvides: 'Awaken provides',
      tryPath: 'Try this path', smallest: 'Build the smallest useful version first.', availability: 'What is available today', invest: 'Check the status before you invest more.', checkAt: 'Where to check: ',
      situationPrefix: 'The situation: ', startPrefix: 'Start with: ', bestPrefix: 'Best for: ',
    },
    landing: {
      exploreObjects: 'Explore the product model',
      workforceStar: 'Star the Awaken open foundation',
      workforceCaption: 'Current product workspace · controlled example content, not customer activity',
      workforceCloseTitle: 'Bring one recurring job all the way to an accepted result.',
      workforceCloseBody: 'See the complete outcome loop first. Apply for a focused validation when the job needs real system connections, exceptions, and acceptance facts.',
      objectsCaption: 'Product model preview · example content, with type, provenance, and revision semantics from the current implementation',
      frequencies: ['Daily', 'Weekly', 'Monthly', 'Event-driven'],
      selectedScenario: 'Selected starting point:',
      selectedProduct: 'Selected product:',
      productLabels: { agents: 'Awaken Agents · current implementation', objects: 'Awaken Objects · early preview', workforce: 'Awaken Workforce · early preview' },
      optionalDetails: 'Optional systems, risks, and timing',
    },
    agentsLanding: {
      quickstartEyebrow: 'First successful run',
      quickstartTitle: 'Reach one inspectable Session before you evaluate architecture.',
      quickstartSteps: [
        ['1', 'Start', 'Run the local AllInOne service with a durable data directory.'],
        ['2', 'Publish', 'Connect a model, publish one Agent, and create a Session.'],
        ['3', 'Verify', 'See agent.message and session.status_idle, then reopen the committed events after restart.'],
      ],
      star: 'View and star on GitHub', compatibility: 'Migrating an existing app? Check the compatibility surface and known differences',
      showcase: 'Current Awaken Console · verified release build',
    },
    docsPage: {
      title: (title: string, product: string) => `${title} | ${product} documentation | AwakenWorks`,
      purpose: 'What this page covers', adjacent: 'Adjacent documentation', previous: 'Previous', next: 'Next',
      copy: 'Copy', copyAria: 'Copy code', copied: 'Copied', copyFailed: 'Copy failed',
      scrollTable: 'Scroll horizontally to read all columns',
    },
    docsShell: {
      header: 'Documentation header', version: 'Version', search: 'Search', starAria: 'Star Awaken on GitHub',
      searchTitle: 'Search documentation', closeSearch: 'Close search', searchPrompt: 'Enter a title, task, or error message', searchPlaceholder: 'Enter a title, task, or error message…',
      sidebar: 'Documentation sidebar', productDocs: 'Product documentation', mobileStar: 'Star on GitHub',
      browse: (product: string) => `Browse ${product} docs`, mobileNav: 'Mobile documentation navigation', onPage: 'On this page', mobileToc: 'Mobile table of contents', note: 'Note', toc: 'On this page', landing: 'Landing page.',
      searchEmpty: 'Type a keyword to search.', resultOne: '{count} result', resultMany: '{count} results', noResults: 'No matches. Try a task name, error message, or API.', loading: 'Loading index…', failed: 'Search index failed to load. Please try again.',
    },
    objectsDocs: {
      toc: 'Current documentation',
      title: 'Start from the business fact you need to model or change.',
      body: 'Choose the object task you need: define its type and identity, connect observations from another system, govern a change, or make the committed state available to an application or Agent.',
      open: 'Open page →',
      items: [
        ['Object model', 'Understand ResourceType, Resource identity, revisions, and the boundary between definition and instance.', '/docs/objects/concepts/object-model'],
        ['Resource model', 'Follow the authoritative Resource representation used by interfaces, automation, and Agent tools.', '/docs/objects/concepts/resource-model'],
        ['Types and values', 'Choose scalar, structured, reference, and value-object types without creating a second schema path.', '/docs/objects/concepts/type-system'],
        ['Connectors', 'Bring external observations into Objects with provenance and idempotency boundaries.', '/docs/objects/concepts/connectors'],
        ['Permissions and Resources', 'See how scope and capability checks constrain object reads and actions.', '/docs/objects/concepts/permissions-resources'],
      ],
    },
  },
  zh: {
    routes: {
      blog: { title: '博客 — AwakenWorks', description: '来自 AwakenWorks 的工程笔记、产品进展与可复现的构建记录。' },
      principles: { title: '我们的原则 — AwakenWorks', description: '四项承诺，说明 AwakenWorks 如何构建、运营并描述 Agent 基础设施。' },
      docs: { title: '文档中心 — AwakenWorks', description: '按任务查找 Awaken 的入门、构建、架构、运维与参考文档。' },
      objectsDocs: { title: 'Awaken Objects 文档｜AwakenWorks', description: '使用 Awaken Objects 建模业务对象、Resource、Relation、Connector 与受控动作。' },
      caseTitle: (name: string) => `${name}｜基于 Awaken 构建`,
      blogTitle: (title: string) => `${title} — AwakenWorks`,
    },
    common: {
      theme: '切换明暗主题',
      githubStar: '在 GitHub Star',
      openPath: '进入路径 →',
    },
    home: { titleClass: 'home-display-title-zh', allCases: '查看全部参考实现与证据边界' },
    blog: {
      eyebrow: '工程札记',
      title: '从真实问题开始，写下我们怎样解决它。',
      intro: '这些文章来自 Awaken、Pilot 与 Awaken Design 的实际开发。每一篇先说明遇到的问题，再展开设计选择、实现过程、失败处理和仍未解决的部分。',
      topics: ['产品设计', '系统架构', '运行与恢复'],
      docs: '进入技术文档', archive: '文章列表', read: '阅读', empty: '还没有文章。', back: '博客',
    },
    cases: {
      disclaimer: '这些页面记录我们自己的构建过程，不是客户案例，也不代表客户采用或背书。',
      all: '全部参考实现', bestFor: '适合：', deepSeek: '这是独立参考实现，不代表 DeepSeek 的合作、赞助或背书。',
      situation: '你可能正遇到', firstResult: '第一个可用结果', productShape: '产品形态', applicationKeeps: '应用保留', awakenProvides: 'Awaken 提供',
      tryPath: '试一试这条路径', smallest: '先完成最小可用版本。', availability: '当前可以使用什么', invest: '先看状态，再决定投入多少。', checkAt: '检查位置：',
      situationPrefix: '你可能正遇到：', startPrefix: '先得到：', bestPrefix: '适合谁：',
    },
    landing: {
      exploreObjects: '查看产品模型',
      workforceStar: 'Star Awaken 开源基础',
      workforceCaption: '当前产品工作空间 · 受控示例内容，不代表客户活动',
      workforceCloseTitle: '让一项重复工作真正走到可验收结果。',
      workforceCloseBody: '先看完整结果闭环；当工作需要连接真实系统、处理例外并取得验收事实时，再申请一次聚焦验证。',
      objectsCaption: '产品模型预览 · 示例内容，类型、来源与 revision 语义来自当前实现',
      frequencies: ['每天', '每周', '每月', '按事件触发'],
      selectedScenario: '已选择的起点：',
      selectedProduct: '已选择产品：',
      productLabels: { agents: 'Awaken Agents · 当前实施', objects: 'Awaken Objects · 提前预览', workforce: 'Awaken Workforce · 提前预览' },
      optionalDetails: '选填：系统、风险与计划时间',
    },
    agentsLanding: {
      quickstartEyebrow: '第一次成功运行',
      quickstartTitle: '先完成一个可检查的 Session，再评估整体架构。',
      quickstartSteps: [
        ['1', '启动', '使用持久化数据目录运行本地 AllInOne 服务。'],
        ['2', '发布', '连接模型，发布一个 Agent，并创建 Session。'],
        ['3', '验证', '看到 agent.message 与 session.status_idle；重启后仍能重新打开已提交事件。'],
      ],
      star: '在 GitHub 查看并 Star', compatibility: '迁移已有应用？先查看兼容范围与已知差异',
      showcase: '当前 Awaken Console · Release 构建实测',
    },
    docsPage: {
      title: (title: string, product: string) => `${title}｜${product} 文档｜AwakenWorks`,
      purpose: '本页内容', adjacent: '相邻文档', previous: '上一篇', next: '下一篇',
      copy: '复制', copyAria: '复制代码', copied: '已复制', copyFailed: '复制失败',
      scrollTable: '横向滚动以查看全部列',
    },
    docsShell: {
      header: '文档页首', version: '版本', search: '搜索', starAria: '在 GitHub Star Awaken',
      searchTitle: '搜索文档', closeSearch: '关闭搜索', searchPrompt: '输入标题、任务或错误信息', searchPlaceholder: '输入标题、任务或错误信息…',
      sidebar: '文档目录', productDocs: '产品文档', mobileStar: '在 GitHub Star',
      browse: (product: string) => `浏览 ${product} 文档`, mobileNav: '移动文档目录', onPage: '本页', mobileToc: '移动本页目录', note: '提示', toc: '本页目录', landing: '本页为入口页。',
      searchEmpty: '输入关键词开始搜索。', resultOne: '找到 {count} 个结果', resultMany: '找到 {count} 个结果', noResults: '没有匹配结果。请尝试任务名称、错误信息或 API。', loading: '正在加载索引…', failed: '搜索索引加载失败，请重试。',
    },
    objectsDocs: {
      toc: '当前文档',
      title: '从需要建模或改变的业务事实开始。',
      body: '请选择当前要完成的对象任务：定义类型与身份、连接其他系统的 Observation、约束一次变化，或让应用与 Agent 使用已经提交的对象状态。',
      open: '打开页面 →',
      items: [
        ['对象模型', '理解 ResourceType、Resource 身份、revision，以及定义与实例之间的边界。', '/docs/objects/concepts/object-model'],
        ['Resource 模型', '了解界面、自动化与 Agent tools 共同使用的权威 Resource 表达。', '/docs/objects/concepts/resource-model'],
        ['类型与值', '选择标量、结构、引用与 Value Object 类型，不建立第二条 schema 路径。', '/docs/objects/concepts/type-system'],
        ['Connector', '以明确 provenance 与幂等边界，把外部 Observation 带进 Objects。', '/docs/objects/concepts/connectors'],
        ['权限与 Resource', '了解 scope 与 capability 检查如何约束对象读取和动作。', '/docs/objects/concepts/permissions-resources'],
      ],
    },
  },
} as const satisfies Record<Lang, object>;

export const agentsConsoleTour = {
  en: {
    zoom: 'Open larger product screenshot',
    close: 'Close screenshot',
    overviewAlt: 'Awaken Console overview showing provider, Agent, Environment, Session, and integration readiness',
    overviewCaption: 'The overview turns setup into five visible steps: connect a model, publish an Agent, run a Session, inspect evidence, then connect an application.',
    details: [
      { src: '/awaken/assets/console-current/agent-editor.png', alt: 'Awaken Agent editor with quickstart, draft checks, and publication controls', title: 'Build and publish in Console', caption: 'Give the Agent a readable name, choose a runnable model and task, test the draft, then review the exact publication change.' },
      { src: '/awaken/assets/console-current/models-and-providers.png', alt: 'Awaken model provider connection and discovered model catalog', title: 'Connect a model before you build', caption: 'Verify a provider credential and endpoint, import its model catalog, and expose only models the runtime can execute.' },
      { src: '/awaken/assets/console-current/api-and-protocols.png', alt: 'Awaken API and protocols directory with Managed Agents connection help', title: 'Connect through the protocol you use', caption: 'Open the protocol-specific guide, create the right API key for protected deployments, and inspect the same Session in Console.' },
      { src: '/awaken/assets/console-current/deployments.png', alt: 'Awaken Deployments page showing schedules, manual runs, and result Sessions', title: 'Turn a tested Agent into repeatable work', caption: 'Each scheduled or manual trigger creates its own inspectable Session, with a direct path from the run to its result.' },
    ],
    provenance: 'Captured from Awaken v1.0.0-dev release UI at revision 50d5035c68456c9106626f748cf4c169c2057beb. Controlled local data is shown; these are product screens, not customer activity.',
  },
  zh: {
    zoom: '放大查看产品界面',
    close: '关闭产品界面',
    overviewAlt: 'Awaken Console 总览，显示模型、Agent、Environment、Session 与应用接入的就绪状态',
    overviewCaption: '总览把首次配置整理为五步：连接模型、发布 Agent、运行 Session、检查证据，再接入应用。',
    details: [
      { src: '/awaken/assets/console-current/agent-editor.png', alt: 'Awaken Agent 编辑器，包含快速开始、草稿检查与发布控制', title: '在 Console 中构建并发布', caption: '设置易读名称，选择可运行模型与首个任务，测试草稿，再审阅精确的发布差异。' },
      { src: '/awaken/assets/console-current/models-and-providers.png', alt: 'Awaken 模型供应商连接与自动发现的模型目录', title: '先连接模型，再构建 Agent', caption: '验证供应商凭据和 endpoint，导入模型目录，只把 Runtime 确实能够执行的模型交给 Agent。' },
      { src: '/awaken/assets/console-current/api-and-protocols.png', alt: 'Awaken API 与协议目录中的 Managed Agents 接入帮助', title: '按应用使用的协议接入', caption: '打开对应协议的连接说明，在受保护部署中创建合适的 API Key，并在 Console 检查同一个 Session。' },
      { src: '/awaken/assets/console-current/deployments.png', alt: 'Awaken Deployments 页面，显示计划、手动运行和结果 Session', title: '把验证过的 Agent 变成重复工作', caption: '每次定时或手动触发都会建立独立、可检查的 Session，并可从运行记录直接进入结果。' },
    ],
    provenance: '截图来自 Awaken v1.0.0-dev revision 50d5035c68456c9106626f748cf4c169c2057beb 的 Release UI。画面使用受控本地数据，不代表客户活动。',
  },
} as const satisfies Record<Lang, object>;

export const productPreviewCopy = {
  en: {
    label: 'Product model preview · example content', columns: ['Record', 'Fact', 'State'],
    views: {
      platform: { badge: 'Running', title: 'Session', subtitle: 'Configuration, ownership, and committed history for one long-running task.', nav: ['Agents', 'Sessions', 'Environments', 'Workers'], facts: [['Agent publication', 'Exact revision'], ['Environment', 'Frozen at Session create'], ['Work ownership', 'Lease + epoch']], rows: [['Complete Session', 'Persisted', 'Committed'], ['One Work item', 'Claimed by Worker', 'Claimed'], ['Runtime execution', 'Claim-fenced', 'Running'], ['Session history', 'Awaiting next commit', 'Open']], boundary: 'Control publishes immutable configuration; Coordinator owns Session and dispatch; Worker embeds Runtime and commits under lease and epoch fences.' },
      objects: { badge: 'Current revision', title: 'Business object', subtitle: 'Example: an order controlled by an external system and observed through a Connector.', nav: ['Objects', 'Types', 'Relations', 'Actions'], facts: [['ResourceType', 'Exact revision'], ['Identity authority', 'External system'], ['Object view', 'Exact snapshot']], rows: [['Order · example', 'Connector observation', 'Observed'], ['Customer relation', 'Resolved by external identity', 'Resolved'], ['approve Action', 'Requires authority and revision', 'Available'], ['Latest change', 'Source and time retained', 'Recorded']], boundary: 'Objects keeps a typed, sourced object record. The external system still owns its business fact; an Action returns the governed result.' },
    },
    workforce: {
      brand: 'Awaken Workforce', workspace: 'Customer operations', status: 'Active', action: 'Commission outcome',
      pathAria: 'Outcome delivery path', acceptanceUnavailable: 'Acceptance unavailable',
      navigation: [
        ['Workspace', ['Home', 'Needs you · 2', 'Chats', 'Solutions', 'Resources']],
        ['Project', ['Overview', 'Outcomes', 'Canvases', 'Issues', 'Planning', 'Workflows', 'Automations']],
        ['Operations', ['Runs', 'Agent Center']],
      ],
      path: [['01', 'Commission'], ['02', 'Decompose'], ['03', 'Execute'], ['04', 'Accept']],
      commandEyebrow: 'AI workforce', commandTitle: 'Outcome command', commandBody: 'Intervene where acceptance, evidence, or execution needs you.',
      buckets: [
        { label: 'Needs you', count: '1', title: 'Resolve billing dispute', detail: 'Approval required · 3/4 tasks', delivery: 'Formal delivery 2/3', tone: 'warning' },
        { label: 'In progress', count: '1', title: 'Onboard enterprise customer', detail: 'Agent WorkUnit running · 2/5 tasks', delivery: 'Formal delivery 1/3', tone: 'active' },
        { label: 'Blocked', count: '1', title: 'Restore supplier account', detail: 'Waiting for ERP confirmation · 1/3 tasks', delivery: 'Formal delivery 0/2', tone: 'blocked' },
      ],
      reviewEyebrow: 'Acceptance boundary', reviewTitle: 'Formal deliverables', reviewSummary: '2/3 fulfilled',
      deliverables: [['Account correction', 'Accepted'], ['Refund receipt', 'Accepted'], ['Ledger confirmation', 'Awaiting']],
      decision: 'Formal delivery is incomplete', decisionBody: 'Acceptance remains unavailable until every declared deliverable is present.',
      boundary: 'Modeled on the committed Workspace, Project, Chats, Canvases, Outcomes, and Outcome Review surfaces at source revision b75e0ff9. Chats projects Awaken conversation state; Canvases projects Objects resources. Example records are illustrative and are not customer results.',
    },
  },
  zh: {
    label: '产品模型预览 · 示例内容', columns: ['对象', '事实', '状态'],
    views: {
      platform: { badge: '执行中', title: 'Session', subtitle: '一项长期任务的配置、归属与已提交历史。', nav: ['Agents', 'Sessions', 'Environments', 'Workers'], facts: [['Agent publication', '固定版本'], ['Environment', 'Session 创建时冻结'], ['Work ownership', 'lease + epoch']], rows: [['完整 Session', '已持久化', 'Committed'], ['唯一 Work item', 'Worker 已领取', 'Claimed'], ['Runtime 执行', '受 claim 约束', 'Running'], ['Session history', '等待下一次提交', 'Open']], boundary: 'Control 发布不可变配置；Coordinator 拥有 Session 与分派；Worker 嵌入 Runtime 并在 lease/epoch 约束下提交。' },
      objects: { badge: '当前 revision', title: '业务对象', subtitle: '示例：一个由外部系统控制、由 Connector 观察的订单。', nav: ['对象', '类型', '关系', '动作'], facts: [['ResourceType', '固定 revision'], ['身份权威', '外部系统'], ['对象视图', '精确 snapshot']], rows: [['Order · 示例', 'Connector observation', 'Observed'], ['Customer relation', '按外部身份解析', 'Resolved'], ['approve Action', '需要授权与 revision', 'Available'], ['最近变化', '保留来源与时间', 'Recorded']], boundary: 'Objects 保存有类型、有来源的对象记录；外部系统仍拥有自己的业务事实，Action 通过受控调用把结果带回来。' },
    },
    workforce: {
      brand: 'Awaken Workforce', workspace: '客户运营', status: '运行中', action: '委托 Outcome',
      pathAria: 'Outcome 交付路径', acceptanceUnavailable: '验收不可用',
      navigation: [
        ['Workspace', ['首页', '需要你处理 · 2', 'Chats', '解决方案', '资源']],
        ['Project', ['概览', 'Outcomes', 'Canvases', 'Issues', '规划', 'Workflows', 'Automations']],
        ['Operations', ['Runs', 'Agent Center']],
      ],
      path: [['01', '委托'], ['02', '分解'], ['03', '执行'], ['04', '验收']],
      commandEyebrow: 'AI workforce', commandTitle: 'Outcome 指挥台', commandBody: '只在验收、证据或执行确实需要你时介入。',
      buckets: [
        { label: '需要你处理', count: '1', title: '解决账务争议', detail: '需要审批 · 3/4 项工作', delivery: '正式交付 2/3', tone: 'warning' },
        { label: '进行中', count: '1', title: '开通企业客户', detail: 'Agent WorkUnit 执行中 · 2/5 项工作', delivery: '正式交付 1/3', tone: 'active' },
        { label: '已阻塞', count: '1', title: '恢复供应商账户', detail: '等待 ERP 确认 · 1/3 项工作', delivery: '正式交付 0/2', tone: 'blocked' },
      ],
      reviewEyebrow: '验收边界', reviewTitle: '正式交付物', reviewSummary: '已满足 2/3',
      deliverables: [['账户更正', '已接受'], ['退款回执', '已接受'], ['总账确认', '等待中']],
      decision: '正式交付尚未齐备', decisionBody: '在每项声明的交付物都存在前，系统不会开放验收。',
      boundary: '依据 source revision b75e0ff9 已提交的 Workspace、Project、Chats、Canvases、Outcomes 与 Outcome Review 界面建模。Chats 投影 Awaken 会话状态，Canvases 投影 Objects 资源；示例记录仅用于说明，不代表客户业绩。',
    },
  },
} as const satisfies Record<Lang, object>;

export const docsIndexCopy = {
  en: {
    shellTitle: 'Documentation', toc: ['Where to start', 'Products', 'Agents paths'],
    heroTitle: 'What are you here to do?', heroBody: 'Enter through the task in front of you and reach one working result. Then go deeper into application integration, deployment, operations, or internals according to your responsibility.',
    startCta: 'Start from your task', agentsCta: 'See what Agents does', taskEyebrow: 'Enter by task', taskTitle: 'Take the shortest path for the task in front of you.', agentsTitle: 'See the complete product, then go deeper by responsibility.',
    startPaths: [
      ['Build or connect an Agent application', 'Create an Agent and Session, or connect existing behavior to Agents, then read the same event history from your application.', '/docs/agents', 'Awaken Agents', 'agents'],
      ['Operate Agent infrastructure', 'Run AllInOne first. Split out Workers and choose Sandbox placement when load or isolation requires it.', '/docs/agents/how-to/self-host', 'Awaken Agents', 'agents'],
      ['Understand business objects', 'Start with ResourceType, Resource, Relation, and Action, then identify which changes can become business facts.', '/docs/objects', 'Awaken Objects', 'objects'],
      ['Manage work that must keep progressing', 'Create an Issue in Workforce, name its owner and acceptance conditions, then assign a person, rule, or Agent.', '/docs/workforce/quickstart', 'Awaken Workforce', 'workforce'],
    ],
    products: [
      { key: 'agents', tone: 'iris', label: 'Agent platform', title: 'Awaken Agents', body: 'Create or connect Agents, keep application work in one Session history, and run the control plane, Workers, and Sandboxes on infrastructure you choose.', href: '/docs/agents', links: [['Get started', '/docs/agents/get-started'], ['Compatibility boundary', '/docs/agents/compatibility'], ['Deploy and operate', '/docs/agents/how-to/self-host']] },
      { key: 'objects', tone: 'amber', label: 'Business objects', title: 'Awaken Objects', body: 'Organize ResourceType, Resource, Relation, Action, and Connector into typed, versioned business facts with provenance.', href: '/docs/objects', links: [['Object model', '/docs/objects/concepts/object-model'], ['Resource model', '/docs/objects/concepts/resource-model'], ['Connectors', '/docs/objects/concepts/connectors']] },
      { key: 'workforce', tone: 'rust', label: 'Work and acceptance', title: 'Awaken Workforce', body: 'Start from work that must be completed, retain responsibility and process, coordinate people, rules, and Agents, and accept outcomes from external facts.', href: '/docs/workforce', links: [['Get started', '/docs/workforce/quickstart'], ['Manage work', '/docs/workforce/how-to'], ['Handle exceptions', '/docs/workforce/operating/attention-recovery']] },
    ],
    agentsPaths: [
      ['manual', 'Start local AllInOne, open Console, create a Session, and confirm Agents with one visible result.', '/docs/agents/get-started'],
      ['developer', 'Configure or connect an Agent, then integrate through AI SDK, AG-UI, Managed Agents, or HTTP/SSE.', '/docs/agents/how-to/connect-a-published-agent'],
      ['operator', 'Choose local, single-node, or split-role topology and manage migrations, Workers, Sandboxes, credentials, observability, and recovery.', '/docs/agents/how-to/self-host'],
      ['internals', 'For contributors and deep maintainers: understand control plane, execution snapshots, scheduling, Runtime/Sandbox, and recovery invariants.', '/docs/agents/concepts/architecture'],
    ],
  },
  zh: {
    shellTitle: '文档中心', toc: ['从哪里开始', '产品', 'Agents 路径'],
    heroTitle: '你现在想完成什么？', heroBody: '从当前任务进入，先看到一个可用结果。之后再按你的责任，继续了解应用接入、部署、运营或内部机制。',
    startCta: '从当前任务开始', agentsCta: '了解 Agents 能做什么', taskEyebrow: '按任务进入', taskTitle: '找到当前任务的最短路径。', agentsTitle: '先看完整产品，再按责任深入。',
    startPaths: [
      ['构建或接入 Agent 应用', '创建一个 Agent 和 Session，或者把已有 Agent 接到 Agents，再从应用读取同一份事件记录。', '/docs/agents', 'Awaken Agents', 'agents'],
      ['运营 Agent 基础设施', '先运行 AllInOne；需要更高负载或隔离时，再拆分 Worker，并选择 Sandbox 的运行位置。', '/docs/agents/how-to/self-host', 'Awaken Agents', 'agents'],
      ['理解业务对象', '从 ResourceType、Resource、Relation 与 Action 开始，明确什么是可提交的业务事实。', '/docs/objects', 'Awaken Objects', 'objects'],
      ['管理一项持续推进的工作', '在 Workforce 中创建 Issue，写下负责人和验收条件，再选择人、规则或 Agent 执行。', '/docs/workforce/quickstart', 'Awaken Workforce', 'workforce'],
    ],
    products: [
      { key: 'agents', tone: 'iris', label: 'Agent 平台', title: 'Awaken Agents', body: '创建或接入 Agent，让应用通过同一份 Session 记录继续工作，并在你选择的基础设施上运行控制面、Worker 与 Sandbox。', href: '/docs/agents', links: [['快速开始', '/docs/agents/get-started'], ['兼容边界', '/docs/agents/compatibility'], ['部署与运营', '/docs/agents/how-to/self-host']] },
      { key: 'objects', tone: 'amber', label: '业务对象', title: 'Awaken Objects', body: '把 ResourceType、Resource、Relation、Action 与 Connector 组织成有类型、有版本、有来源的业务事实。', href: '/docs/objects', links: [['对象模型', '/docs/objects/concepts/object-model'], ['Resource 模型', '/docs/objects/concepts/resource-model'], ['Connector', '/docs/objects/concepts/connectors']] },
      { key: 'workforce', tone: 'rust', label: '工作与验收', title: 'Awaken Workforce', body: '从必须完成的工作开始，保存责任与流程，协调人、规则和 Agent，并用外部事实验收结果。', href: '/docs/workforce', links: [['开始使用', '/docs/workforce/quickstart'], ['管理工作', '/docs/workforce/how-to'], ['处理例外', '/docs/workforce/operating/attention-recovery']] },
    ],
    agentsPaths: [
      ['manual', '启动本地 AllInOne，打开 Console，创建 Session，并看到第一个结果。', '/docs/agents/get-started'],
      ['developer', '配置或接入 Agent，再通过 AI SDK、AG-UI、Managed Agents 或 HTTP/SSE 连接应用。', '/docs/agents/how-to/connect-a-published-agent'],
      ['operator', '选择单进程或拆分部署，管理迁移、Worker、Sandbox、凭据、观测与恢复。', '/docs/agents/how-to/self-host'],
      ['internals', '面向贡献者与深度维护者：理解控制面、执行快照、调度、Runtime、Sandbox 与恢复规则。', '/docs/agents/concepts/architecture'],
    ],
  },
} as const satisfies Record<Lang, object>;

export const principlesCopy = {
  en: {
    eyebrow: 'Our principles', heroTitle: 'Make powerful systems understandable.', heroSubtitle: 'Agent systems can act for a long time and across many tools. The people responsible for the work should still be able to see what is happening, decide what is allowed, and change course.',
    believe: { heading: 'Begin with the work and its owner', body: 'A useful system starts with a clear job, a person responsible for it, and a result they can accept. The Agent may plan and act, but it does not get to redefine who decides whether the work is done.' },
    developers: { heading: 'Keep control close to the people doing the work', body: 'These choices shape both the software and the way we work with teams adopting it.', values: [
      { title: 'Show the source', desc: 'Awaken is Apache-2.0. You can read the code, follow a decision, and propose a better one.' },
      { title: 'Keep operations in your boundary', desc: 'Run the control plane on infrastructure you choose. Keep Session records and credentials inside that operating boundary.' },
      { title: 'Leave room to change course', desc: 'Choose providers and execution backends explicitly. Open protocols and readable formats make later changes easier, though never free.' },
    ] },
    honesty: { heading: 'Name what is ready, and what is not', badge: 'Plain status', body: 'We distinguish what is available now, what is still a preview, and what remains a target. When a limit matters to your decision, we state it near the claim instead of hiding it in a footnote.', linkLabel: 'Read the current implementation boundaries' },
    open: { heading: 'Make it easy to question and improve', body: 'You do not need to agree with us before taking part. Ask about a design, point out a confusing limit, or improve a small piece of the system. The links below are the direct paths into that work.', links: [
      { target: 'discussions', label: 'GitHub Discussions', desc: 'Ask a question or propose a change where others can examine it.' },
      { target: 'goodFirstIssues', label: 'Good first issues', desc: 'Start with a bounded change and its acceptance conditions.' },
      { target: 'contributing', label: 'Contributing guide', desc: 'Follow the repository path from a clone to a reviewed change.' },
      { target: 'openDecisions', label: 'Open decisions & RFCs', desc: 'Read the unresolved trade-offs and comment on the decision.' },
    ], orgLabel: 'Star Awaken on GitHub' },
  },
  zh: {
    eyebrow: '我们的原则', heroTitle: '让强大的系统依然容易理解。', heroSubtitle: 'Agent 系统可能长时间运行，也可能调用许多工具。真正为工作负责的人，仍然应该看得见发生了什么，能够决定什么可以做，也能够随时改变方向。',
    believe: { heading: '先说清工作，以及谁为它负责', body: '一个有用的系统，首先要有明确的工作、负责人和可验收的结果。Agent 可以规划和行动，但不能替负责人重新定义什么叫完成。' },
    developers: { heading: '让控制权靠近真正做事的人', body: '以下选择同时影响软件如何构建，也影响我们如何与采用它的团队合作。', values: [
      { title: '开放源码', desc: 'Awaken 采用 Apache-2.0。你可以阅读代码、追踪一项决定，也可以提出更好的做法。' },
      { title: '把运营留在自己的边界内', desc: '在你选择的基础设施上运行控制面，让 Session 记录和凭据留在这条运营边界内。' },
      { title: '保留改变方向的余地', desc: '显式选择供应商和执行后端。开放协议与可读格式会让后续变化更容易，但不会让成本凭空消失。' },
    ] },
    honesty: { heading: '说清什么已经可用，什么还没有', badge: '清楚标注', body: '我们区分当前可用、仍在预览和只是目标的内容。当某项限制会影响你的决定时，我们会把它放在相关说明旁边，而不是藏进脚注。', linkLabel: '查看当前实现边界' },
    open: { heading: '让质疑和改进都容易发生', body: '参与不以认同为前提。你可以追问一项设计，指出一个说不清的边界，或改进系统中的一小部分。下面这些链接会直接带你进入相应工作。', links: [
      { target: 'discussions', label: 'GitHub Discussions', desc: '提出问题或改动建议，让更多人一起检查。' },
      { target: 'goodFirstIssues', label: '入门 issue', desc: '从范围清楚、验收条件明确的改动开始。' },
      { target: 'contributing', label: '贡献指南', desc: '沿着仓库路径，从 clone 走到经过评审的改动。' },
      { target: 'openDecisions', label: '开放决定与 RFC', desc: '阅读尚未解决的取舍，并直接参与决定。' },
    ], orgLabel: '在 GitHub Star Awaken' },
  },
} as const satisfies Record<Lang, object>;
