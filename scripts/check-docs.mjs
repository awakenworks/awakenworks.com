import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const docsRoot = join(root, 'src/content/docs');
const distRoot = join(root, 'dist');
const docsPagePath = join(root, 'src/components/DocsPage.astro');
const provenancePath = join(root, 'config/source-provenance.json');
const failures = [];

function requireText(path, patterns) {
  const text = readFileSync(path, 'utf8');
  for (const [pattern, message] of patterns) {
    if (!pattern.test(text)) failures.push(`${relative(root, path)}: ${message}`);
  }
}

function rejectText(path, patterns) {
  const text = readFileSync(path, 'utf8');
  for (const [pattern, message] of patterns) {
    if (pattern.test(text)) failures.push(`${relative(root, path)}: ${message}`);
  }
}

function filesBelow(dir, predicate = () => true) {
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (predicate(path)) files.push(path);
    }
  };
  walk(dir);
  return files;
}

function frontmatterData(text) {
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) return { frontmatter: null, evidence: [], title: '', description: '', audience: '', section: '', subsection: '', order: '' };
  const evidenceBlock = /^evidence:\n((?:  - "[^"]+"\n?)+)/m.exec(frontmatter[1]);
  const evidence = evidenceBlock
    ? [...evidenceBlock[1].matchAll(/^  - "([^"]+)"$/gm)].map((match) => match[1])
    : [];
  const scalar = (field) => {
    const raw = new RegExp(`^${field}:\\s*(.+)$`, 'm').exec(frontmatter[1])?.[1] ?? '';
    if (!raw.startsWith('"')) return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };
  return {
    frontmatter: frontmatter[1],
    evidence,
    title: scalar('title'),
    description: scalar('description'),
    audience: scalar('audience'),
    section: scalar('section'),
    subsection: scalar('subsection'),
    order: scalar('order'),
  };
}

const markdown = filesBelow(docsRoot, (path) => extname(path) === '.md');
// Cause/effect design for local review isolation:
// C1: ignored drafts under docs/reviews can contain incomplete diagrams while
//     they are being reviewed.
// C2: normal validation must inspect every repository-owned Markdown
//     file without depending on Git metadata.
// E1: local review drafts cannot change a clean checkout's build result.
// E2: every other Markdown owner remains in the full-document audit.
// Decision table: R1 repository Markdown -> inspect; R2 docs/reviews Markdown ->
// exclude; R3 any other ignored artifact -> it is outside the enumerated
// Markdown roots and therefore cannot become a parallel content source.
const localReviewsRoot = `${join(root, 'docs/reviews')}/`;
const trackedWebsiteMarkdown = [
  join(root, 'README.md'),
  ...filesBelow(join(root, 'docs'), (path) => extname(path) === '.md'),
  ...filesBelow(join(root, 'src/content/blog'), (path) => extname(path) === '.md'),
  ...markdown,
]
  .filter((path) => existsSync(path) && !path.startsWith(localReviewsRoot));
const byRelativePath = new Set(markdown.map((path) => relative(docsRoot, path)));
const titlesByScope = new Map();
const descriptionsByScope = new Map();
const ordersBySection = new Map();
const currentEnglishSections = new Set();
const retiredAwakenProductIdentity = /\bHarness\b|Agents Runtime|00-platform-overview|Client → Platform|Remote Agent → Platform|Platform → Remote Agent|Maintain or extend Runtime|维护或扩展 Runtime/;

for (const path of trackedWebsiteMarkdown) {
  const text = readFileSync(path, 'utf8');
  if (path.startsWith(join(root, 'src/content')) && retiredAwakenProductIdentity.test(text)) {
    failures.push(`${relative(root, path)}: content must use Awaken Agents as the sole product identity`);
  }
  for (const match of text.matchAll(/```text\n([\s\S]*?)```/g)) {
    if (/(?:--?>|→|←|[├└│▼▲┌┐┘┬┴─╭╮╰╯]|\+--|\|--)/u.test(match[1])) {
      failures.push(`${relative(root, path)}: relationship and sequence diagrams must use Mermaid, not a text code block`);
    }
  }
}

// Cause/effect design for the managed-runtime evolution article:
// C1: one locale loses either the task-continuity or execution-boundary axis.
// C2: an axis keeps its label but loses the mechanisms that make it concrete.
// C3: the two static paths no longer converge on Managed Agent Runtime.
// C4: the static overview survives but the permission-to-Hand execution
//     sequence disappears.
// E1: both locales preserve the same two-axis architecture and convergence.
// E2: the article retains both a static ownership view and a dynamic behavior
//     view instead of reducing the argument to a product timeline.
// Decision table: R1 both axes + mechanisms + convergence + sequence -> pass;
// R2 any required element absent in either locale -> fail. Locale absence is
// already covered by the canonical blog route and Markdown inventory checks.
const managedRuntimeArticles = [
  {
    path: join(root, 'src/content/blog/en/2026-09-agent-loop-to-managed-runtime.md'),
    patterns: [
      [/Task continuity \(Control & Continuity\)/, 'managed-runtime article must name the task-continuity axis'],
      [/Execution boundary \(Authority & Isolation\)/, 'managed-runtime article must name the execution-boundary axis'],
      [/State, Graph, Checkpoint, Thread, Queue, Session, Recovery/, 'managed-runtime article must make continuity mechanisms concrete'],
      [/Capability, Permission Gate, Hand, Environment, Sandbox, Effect Commit/, 'managed-runtime article must make execution mechanisms concrete'],
      [/C3 --> M\["Managed Agent Runtime"\][\s\S]*E3 --> M/, 'managed-runtime article must converge both static paths'],
      [/B->>G: proposed Tool Call[\s\S]*G->>H: approved Tool Call[\s\S]*G-->>S: commit the observed outcome/, 'managed-runtime article must retain the Brain-to-Hand dynamic sequence'],
    ],
  },
  {
    path: join(root, 'src/content/blog/zh/2026-09-agent-loop-to-managed-runtime.md'),
    patterns: [
      [/任务连续性（Control & Continuity）/, 'Chinese managed-runtime article must name the task-continuity axis'],
      [/执行边界（Authority & Isolation）/, 'Chinese managed-runtime article must name the execution-boundary axis'],
      [/State、Graph、Checkpoint、Thread、Queue、Session、Recovery/, 'Chinese managed-runtime article must make continuity mechanisms concrete'],
      [/Capability、Permission Gate、Hand、Environment、Sandbox、Effect Commit/, 'Chinese managed-runtime article must make execution mechanisms concrete'],
      [/C3 --> M\["Managed Agent Runtime"\][\s\S]*E3 --> M/, 'Chinese managed-runtime article must converge both static paths'],
      [/B->>G: proposed Tool Call[\s\S]*G->>H: approved Tool Call[\s\S]*G-->>S: commit the observed outcome/, 'Chinese managed-runtime article must retain the Brain-to-Hand dynamic sequence'],
    ],
  },
];

for (const article of managedRuntimeArticles) requireText(article.path, article.patterns);

function recordScopedValue(index, key, path) {
  index.set(key, [...(index.get(key) ?? []), path]);
}

// Cause/effect design for the full-document source-coordinate and retired-path
// audit:
// C1: any Markdown file names a code coordinate that no longer
//     exists in its authoritative source repository.
// C2: a page retains a retired lifecycle, permission, storage-reader,
//     compaction, observability, configuration vocabulary, or Flow HTTP path
//     even though its links and frontmatter still build.
// C3: supplied implementation evidence points to a source-design document or
//     a missing source coordinate.
// C4: localized peers cite different implementation owners.
// C5: a generated/pasted content sentinel leaks into the published page.
// C6: page titles, purposes, or numeric positions collide inside one reader
//     journey, or a purpose is too vague/long to scan before opening the body.
// C7: localized pages repeat structural navigation metadata that can drift from
//     the canonical English reader journey.
// C8: a relationship or execution sequence is drawn inside a `text` block,
//     making structure harder to scan and less adaptable on narrow screens.
// E1: copy/paste guidance and implementation ownership remain source-verifiable.
// E2: one current contract remains visible instead of a compatibility-shaped
//     second path.
// E3: every supplied coordinate resolves through the committed evidence lock.
// E4: English and Chinese claims cite the same owners.
// E5: every page is valid authored Markdown rather than an extraction artifact.
// E6: every page has one distinct purpose and deterministic journey position.
// E7: English owns audience, section, subsection, and order; localized pages
//     derive that structure while owning only localized content and permitted
//     evidence.
// E8: diagrams use Mermaid; `text` blocks remain reserved for literal output.
// Validation never reads sibling checkouts or relies on a particular workspace
// layout. Decision table:
// | Rule | Evidence | Locale parity | Outcome |
// | R1   | exact or absent | yes     | accept  |
// | R2   | unknown         | any     | reject  |
// | R3   | exact           | no      | reject  |
// Structural decision table:
// | Rule | English structure | localized structure | English peer | Outcome |
// | I1   | complete          | absent              | present      | accept  |
// | I2   | incomplete        | any                 | present      | reject  |
// | I3   | complete          | present             | present      | reject  |
// | I4   | complete          | absent              | absent       | reject  |
let provenance = { repositories: {} };
try {
  provenance = JSON.parse(readFileSync(provenancePath, 'utf8'));
} catch (error) {
  failures.push(`config/source-provenance.json: cannot read committed source evidence (${error.message})`);
}
const verifiedAwakenCoordinates = new Set(
  provenance.repositories?.awaken?.evidenceCoordinates ?? [],
);

for (const path of markdown) {
  const rel = relative(root, path);
  const docsRel = relative(docsRoot, path);
  const [product, , documentLocale] = docsRel.split('/');
  const text = readFileSync(path, 'utf8');
  const { frontmatter, evidence, title, description, section, order } = frontmatterData(text);
  if (!frontmatter) failures.push(`${rel}: missing YAML frontmatter`);
  else {
    if (!title) failures.push(`${rel}: missing title`);
    if (!description) failures.push(`${rel}: missing description`);
    else if (description.length < 20 || description.length > 220) {
      failures.push(`${rel}: description must state the page purpose in 20-220 characters`);
    } else if (/(?:…|\.\.\.)$/.test(description)) {
      failures.push(`${rel}: description must finish its purpose instead of trailing off`);
    }
    if (documentLocale === 'en') {
      if (!section) failures.push(`${rel}: canonical English page is missing reader-journey section`);
      else currentEnglishSections.add(section);
      if (order === '' || !Number.isFinite(Number(order))) failures.push(`${rel}: canonical English page is missing numeric reader-journey order`);
    } else if (documentLocale === 'zh' && /^(?:audience|section|subsection|order):/m.test(frontmatter)) {
      failures.push(`${rel}: localized page duplicates canonical English navigation metadata`);
    }
    if (title) recordScopedValue(titlesByScope, `${product}\u0000${documentLocale}\u0000${title}`, rel);
    if (description) recordScopedValue(descriptionsByScope, `${product}\u0000${documentLocale}\u0000${description}`, rel);
    if (documentLocale === 'en' && section && order !== '') recordScopedValue(ordersBySection, `${product}\u0000${section}\u0000${order}`, rel);
    for (const coordinate of evidence) {
      if (coordinate.startsWith('docs/') || extname(coordinate) === '.md') {
        failures.push(`${rel}: design prose is not implementation evidence: ${coordinate}`);
      } else if (!verifiedAwakenCoordinates.has(coordinate)) {
        failures.push(`${rel}: evidence is not in the verified Awaken coordinate lock: ${coordinate}`);
      }
    }
  }

  const locale = rel.includes('/current/zh/') ? 'zh' : rel.includes('/current/en/') ? 'en' : null;
  if (locale) {
    const peer = relative(docsRoot, path).replace(`/current/${locale}/`, `/current/${locale === 'en' ? 'zh' : 'en'}/`);
    if (!byRelativePath.has(peer)) failures.push(`${rel}: missing localized peer ${peer}`);
    else {
      const peerEvidence = frontmatterData(readFileSync(join(docsRoot, peer), 'utf8')).evidence;
      if (JSON.stringify(evidence) !== JSON.stringify(peerEvidence)) {
        failures.push(`${rel}: localized peers must cite the same implementation evidence`);
      }
    }
  }

  for (const [pattern, message] of [
    [/\bbeta\.webhooks\b/, 'external SDK helper claim without implementation evidence in Awaken'],
    [/\/reference\/http-api\/?/, 'retired duplicate HTTP route-map link; use /reference/api/'],
    [/\/v1\/webhook_endpoints/, 'nonexistent Managed webhook CRUD route; use the Awaken config extension'],
    [/\/v1\/memory_stores\/[^\s`]*\/memory(?:\b|\/)/, 'retired singular Memory path; use /memories'],
    [/\/credentials\/[^\s`]*\/validate\b/, 'retired credential validation suffix; use /mcp_oauth_validate'],
    [/^<\/content>$/m, 'pasted content sentinel in authored Markdown'],
    [/\bGateOutcome::Suspend\b|\bSuspend\s*\{\s*ticket_id/, 'retired permission wait outcome; use RequireConfirmation with correlation_id'],
    [/\bRulePermissionPolicy\b|(?<!Tool)PermissionPolicy\b/, 'retired permission policy contract name'],
    [/pub\s+content:\s+String/, 'retired scalar ToolOutput content; use Vec<ContentBlock>'],
    [/awaken_config_store::AgentConfig|awaken-config-store\/src\/config\.rs/, 'retired AgentConfig owner; use awaken-agent-config'],
    [/crates\/contract\/awaken-agent-contract\/src\/(?:commit\/coordinator|project)\.rs/, 'retired agent-contract code coordinate'],
    [/\b(?:DispatchRunExecutor|AcpBridge::run_turn|RunEventSink)\b/, 'retired ACP execution owner'],
    [/\b(?:ThreadReader|RunStore|EventLog)\b/, 'retired committed-read port; use CommittedThreadView and CheckpointReader'],
    [/\bPermissionContext\b|agent::waiting/, 'retired permission or awaiting type path'],
    [/\b(?:FsCoordinator|InMemorySkillRegistry|ToolObserver)\b/, 'retired concrete API name'],
    [/\b(?:ProviderExecutorFactory|ModelPoolSpec|ChildAgentParams|ThreadRunStore|VersionedRegistryStore|McpToolRegistryManager|MetricsSink|TraceStore|RuntimeReplayer|JudgeConfig)\b/, 'retired development-surface API name'],
    [/\b(?:ContextWindowPolicy|CompactionConfig|CompactionState|DefaultSummarizer|KeepRecentRawSuffix|CompactToSafeFrontier)\b/, 'retired compaction API name'],
    [/\b(?:PreparedMcpServer|IssueStateAssignment|ReasoningEncryptedValue|InferenceComplete|MessagesSnapshot|StateSnapshot|ActivitySnapshot|ActivityDelta|ToolCallDone|ToolOutputDenied)\b/, 'unimplemented or retired public contract name'],
    [/\bsandbox_reaper_(?:enabled|interval_secs|max_age_secs)\b|\bfrom_event_id\b/, 'configuration or cursor name absent from the verified implementation'],
    [/(?:residual implementation target|remains? a Target|仍是(?:残余)?实现目标|仍是 Target)/i, 'unimplemented target described in current public documentation'],
    [/appendix\/release-status|\/platform\/release-status/, 'removed duplicate capability-status owner'],
    [/\bAWAKEN_LOG_FORMAT\b|OtelConfig::from_env/, 'retired environment-owned observability configuration'],
    [/\bawaken worker\b/, 'retired Worker subcommand; use the standalone awaken-worker binary'],
    [/(?:there is no|no typed key trait[^\n]*)(?:[^\n]*`StateKey`|[^\n]*key trait)|没有[^\n]*`StateKey`/i, 'stale claim that the current typed StateKey view is absent'],
  ]) {
    if (pattern.test(text)) failures.push(`${rel}: ${message}`);
  }

  for (const pattern of [/Phase::(?:Waiting|Running|Awaiting|Ended)/, /pub enum Phase\s*\{/, /run(?:'s| 的) `Phase`/, /terminal `Phase`/, /终态 `Phase`/, /->\s*Phase\b/]) {
    if (pattern.test(text)) failures.push(`${rel}: retired run lifecycle vocabulary ${pattern}`);
  }

  for (const match of text.matchAll(/`((?:crates|web|e2e|packs|docs|adr)\/[^`\s#)]+)`/g)) {
    const coordinate = match[1].replace(/[.,;:]$/, '');
    if (coordinate.includes('*')) continue;
    if (!verifiedAwakenCoordinates.has(coordinate)) {
      failures.push(`${rel}: missing verified source coordinate ${coordinate}`);
    }
  }

  if (rel.includes('src/content/docs/platform/') || rel.includes('src/content/docs/harness/')) {
    for (const legacy of ['AWAKEN_MGMT_DIR', 'AWAKEN_MGMT_SEAL_KEY', 'AWAKEN_DATABASE_URL', 'AWAKEN_DISABLE_LOCAL_POOL', 'AWAKEN_UPSTREAM_URL', 'AWAKEN_INGRESS', 'AWAKEN_DISPATCH_DAEMON', 'AWAKEN_STORAGE_DIR', 'AWAKEN_STORE']) {
      if (text.includes(legacy)) failures.push(`${rel}: retired product deployment key ${legacy}; use typed TOML or explicit library composition`);
    }
    for (const [pattern, message] of [
      [/\b(?:ExecutionBackend|A2aBackend|ToolExecutorProvider|declared_hand|hand_connections)\b/, 'retired execution or Hand selection path'],
      [/AgentSpec\.endpoint/, 'retired endpoint-shaped A2A Agent request'],
      [/\/v1\/sessions\/(?:\{[^}]+\}|:id)\/live-inbox/, 'unnamespaced Live Inbox path; use /v1/awaken/sessions/...'],
      [/\b(?:brain_admin|with_brain_admin)\b/, 'retired process administration owner'],
      [/\b(?:package_artifact_dir|package_build_lease_secs|package_build_wait_secs|package_failure_retry_secs|package_state_ttl_secs)\b/, 'retired package-image configuration field'],
    ]) {
      if (pattern.test(text)) failures.push(`${rel}: ${message}`);
    }
  }

  if (rel.includes('src/content/docs/flow/current/')) {
    for (const [pattern, message] of [
      [/WorkContractV1|ResultContractV1/, 'future unified contract type presented in current docs'],
      [/no single CLI command|no CLI command/i, 'stale CLI limitation; use project bootstrap'],
      [/first (?:organization|project)[^\n]*administrative API/i, 'stale onboarding path; use project bootstrap'],
      [/produces\.(?:output|resources)/, 'retired Workflow produces path; use typed state outputs'],
      [/terminal_kind/, 'retired Workflow terminal_kind; use completion'],
      [/task_prompt/, 'retired Workflow task_prompt; use instruction'],
      [/\/api\/actors\/\{id\}\/agent-def/, 'retired AgentDef path; use Project Agent revisions and activations'],
      [/\/api\/workspaces\/\{workspace\}\/model-routes/, 'retired model-route path; select execution during Agent activation'],
      [/\/api\/scopes\/\{scope\}\/packs(?:\b|\/)/, 'retired Pack upload path; use Pack Studio, Registry imports, and adoption'],
      [/\baccount_source\b/, 'Agent field absent from the verified authoring contract'],
      [/\bsample_(?:input|context)\b/, 'Pack field absent from the verified authoring contract'],
    ]) {
      if (pattern.test(text)) failures.push(`${rel}: ${message}`);
    }
  }
}

// Cause/effect design for the reviewed Runtime reference pages:
// C1: a page can list accurate types while leaving the reader unable to choose
//     the contract, configuration surface, error owner, event tier, or wait kind.
// C2: a copied design note can outlive implementation and describe `Phase`, an
//     open ResumeTicket payload, a successful Indeterminate projection, or a
//     universal exactly-once side-effect guarantee that current code does not own.
// C3: automatic retry, reconnect, stale-wake rejection, or terminal projection
//     can be mislabeled as troubleshooting even though no external repair exists.
// C4: a relationship or sequence can regress to a text chart that is harder to
//     render, navigate, and keep aligned across locales.
// E1: each page begins with one reader decision and names the current owner.
// E2: English and Chinese peers retain the exact current contracts and limits.
// E3: only surfaced results with an external corrective action ask the caller to act.
// E4: every relationship or behavior view is Mermaid and ends with the render sentinel.
// Decision table:
// | Rule | task first | current contract | automatic is normal | Mermaid only | Outcome |
// | R1   | yes        | yes              | yes                 | yes          | accept  |
// | R2   | no         | any              | any                 | any          | reject  |
// | R3   | yes        | no               | any                 | any          | reject  |
// | R4   | yes        | yes              | no                  | any          | reject  |
// | R5   | yes        | yes              | yes                 | no           | reject  |
for (const [docsRel, required, rejected] of [
  ['harness/current/en/reference/overview.md', [
    [/title: "Find the Awaken Agents execution contract for your change"/, 'Awaken Agents reference overview must name the change-to-contract decision'],
    [/^## Choose by task/m, 'Runtime reference overview must route by task before the crate map'],
    [/awaken-agent-contract[\s\S]*awaken-runtime-contract[\s\S]*awaken-runtime/, 'Runtime reference overview must retain the contract dependency direction'],
  ], [
    [/`Phase`/, 'Runtime reference overview must use current RunState terminology'],
  ]],
  ['harness/current/zh/reference/overview.md', [
    [/title: "为一次修改找到 Awaken Agents 执行契约"/, 'Chinese Awaken Agents reference overview must name the same decision'],
    [/^## 按任务选择/m, 'Chinese Runtime reference overview must route by task before the crate map'],
    [/awaken-agent-contract[\s\S]*awaken-runtime-contract[\s\S]*awaken-runtime/, 'Chinese Runtime reference overview must retain the same dependency direction'],
  ], [
    [/`Phase`/, 'Chinese Runtime reference overview must use current RunState terminology'],
  ]],
  ['harness/current/en/reference/config.md', [
    [/title: "Choose which Agent configuration to change"/, 'Runtime config must name the configuration decision'],
    [/^\| You need to change \| Change this \| Effect \|/m, 'Runtime config must route by the value being changed'],
    [/AgentConfig[\s\S]*ExecutableAgentSnapshot[\s\S]*RuntimeRunContext/, 'Runtime config must preserve authoring, publication, and per-Run boundaries'],
  ], []],
  ['harness/current/zh/reference/config.md', [
    [/title: "选择要修改的 Agent 配置"/, 'Chinese Runtime config must name the same configuration decision'],
    [/^\| 要修改的内容 \| 修改位置 \| 生效方式 \|/m, 'Chinese Runtime config must route by the value being changed'],
    [/AgentConfig[\s\S]*ExecutableAgentSnapshot[\s\S]*RuntimeRunContext/, 'Chinese Runtime config must preserve the same three boundaries'],
  ], []],
  ['harness/current/en/reference/errors.md', [
    [/title: "Decide what to do with an Awaken Agents execution error"/, 'Awaken Agents errors must name the caller decision'],
    [/execution::Error[\s\S]*Resolution[\s\S]*Execution[\s\S]*Commit/, 'Runtime errors must include the actual embedding error surface'],
    [/Provider[\s\S]*RateLimited[\s\S]*Overloaded[\s\S]*Timeout[\s\S]*Runtime behavior/, 'Runtime errors must keep model retry ownership'],
    [/UnavailableBeforeDispatch[\s\S]*ToolOutput::error/, 'Runtime errors must distinguish safe pre-dispatch classification from model-visible failure'],
  ], []],
  ['harness/current/zh/reference/errors.md', [
    [/title: "判断 Awaken Agents 执行错误需要什么处理"/, 'Chinese Awaken Agents errors must name the same caller decision'],
    [/execution::Error[\s\S]*Resolution[\s\S]*Execution[\s\S]*Commit/, 'Chinese Runtime errors must include the same embedding surface'],
    [/Provider[\s\S]*RateLimited[\s\S]*Overloaded[\s\S]*Timeout[\s\S]*Runtime 行为/, 'Chinese Runtime errors must keep the same model retry owner'],
    [/UnavailableBeforeDispatch[\s\S]*ToolOutput::error/, 'Chinese Runtime errors must preserve the same Tool distinction'],
  ], []],
  ['harness/current/en/reference/events.md', [
    [/title: "Choose Fact for truth and Delta for live progress"/, 'Runtime events must name the authority decision'],
    [/^## From live progress to a committed fact[\s\S]*sequenceDiagram/m, 'Runtime events must show the dynamic path in Mermaid'],
    [/Ended\(Indeterminate\)` \| `RunFailed/, 'Runtime events must project Indeterminate as failure'],
    [/classify[\s\S]*Deltas are live-only[\s\S]*Content facts/, 'Runtime events must keep one routing owner and message truth'],
  ], [
    [/adapter-specific no-success/, 'Runtime events must not leave Indeterminate mapping to adapters'],
  ]],
  ['harness/current/zh/reference/events.md', [
    [/title: "用 Fact 读取事实，用 Delta 展示实时进度"/, 'Chinese Runtime events must name the same authority decision'],
    [/^## 从实时进度到已提交事实[\s\S]*sequenceDiagram/m, 'Chinese Runtime events must show the dynamic path in Mermaid'],
    [/Ended\(Indeterminate\)` \| `RunFailed/, 'Chinese Runtime events must project Indeterminate as failure'],
    [/classify[\s\S]*Delta 只进入实时通道[\s\S]*content fact/, 'Chinese Runtime events must preserve the same routing owner'],
  ], [
    [/不得投影成成功/, 'Chinese Runtime events must state the exact RunFailed mapping instead of an ambiguous prohibition'],
  ]],
  ['harness/current/en/reference/scheduled-actions.md', [
    [/title: "Defer a Tool call without creating another scheduler"/, 'Scheduled Actions must name the bounded use decision'],
    [/AwaitTarget::ToolCall[\s\S]*reason\(\)[\s\S]*pending_tool\(\)/, 'Scheduled Actions must describe the closed ticket and accessor API'],
    [/^## Commit, perform, resume[\s\S]*sequenceDiagram/m, 'Scheduled Actions must show commit and resume causality in Mermaid'],
    [/not a universal guarantee for an arbitrary third-party side effect/, 'Scheduled Actions must bound side-effect guarantees'],
  ], [
    [/exactly once/i, 'Scheduled Actions must not promise universal exactly-once execution'],
  ]],
  ['harness/current/zh/reference/scheduled-actions.md', [
    [/title: "推迟 Tool call，不建立另一套 scheduler"/, 'Chinese Scheduled Actions must name the same bounded decision'],
    [/AwaitTarget::ToolCall[\s\S]*reason\(\)[\s\S]*pending_tool\(\)/, 'Chinese Scheduled Actions must describe the same closed ticket API'],
    [/^## 提交、执行与恢复[\s\S]*sequenceDiagram/m, 'Chinese Scheduled Actions must show the same causality in Mermaid'],
    [/不代表任意第三方 side effect 都天然只发生一次/, 'Chinese Scheduled Actions must bound side-effect guarantees'],
  ], [
    [/恰好.{0,12}一次/, 'Chinese Scheduled Actions must not promise universal exactly-once execution'],
  ]],
]) {
  const path = join(docsRoot, docsRel);
  requireText(path, required);
  rejectText(path, [
    ...rejected,
    [/^## (?:Troubleshooting|故障排查)/m, 'reference page must not create generic troubleshooting for automatic behavior'],
    [/```text/, 'reviewed reference relationships and sequences must use Mermaid, not text charts'],
    [/^---[\s\S]*?---[\s\S]{0,700}(?:repository evidence|source proves|代码证明|仓库证据)/i, 'reviewed reference opening must lead with the reader action, not proof language'],
  ]);

  const text = readFileSync(path, 'utf8');
  const blocks = [...text.matchAll(/```mermaid\n([\s\S]*?)```/g)];
  if (blocks.length === 0) failures.push(`${docsRel}: reviewed reference must keep a Mermaid structure or behavior view`);
}

// Cause/effect design for the Agents documentation entry:
// C1: the entry can repeat the Quickstart procedure, protocol catalog,
//     deployment guide, or Runtime contribution inventory.
// C2: a role-led diagram can make readers reconstruct the product boundary from
//     personas instead of showing the components and their single owners.
// C3: queueing, bounded retry, approval waiting, or lease recovery can be
//     presented as an external troubleshooting task despite built-in handling.
// C4: implemented behavior can be written as a stable, hosted, supported,
//     certified, or independently measured product claim.
// E1: the entry owns only the product choice, four application objects, one
//     static boundary, one Session sequence, and task-based routing.
// E2: component and fact ownership is visible without a role taxonomy.
// E3: built-in convergence remains normal behavior; explicit terminal or
//     attention results route to the reliability owner.
// E4: open-source pre-stable maturity and missing external evidence remain explicit.
// Decision table:
// | Rule | repeated neighbor | role-led | automatic as fault | unsupported claim | Outcome |
// | H1   | no                | no       | no                 | no                | accept  |
// | H2   | yes               | any      | any                | any               | reject  |
// | H3   | no                | yes      | any                | any               | reject  |
// | H4   | no                | no       | yes                | any               | reject  |
// | H5   | no                | no       | no                 | yes               | reject  |
for (const [docsRel, required, rejected] of [
  ['platform/current/en/index.md', [
    [/^## Choose the smallest boundary/m, 'Platform entry must begin with the product-boundary decision'],
    [/\| Agent \|[\s\S]*\| Environment \|[\s\S]*\| Session \|[\s\S]*\| Event \|/, 'Platform entry must preserve the four application objects'],
    [/flowchart LR[\s\S]*sequenceDiagram/, 'Platform entry must include static and dynamic Mermaid views'],
    [/Queueing, bounded retry, waiting for approval, and lease recovery stay inside/, 'Platform entry must classify built-in handling as normal behavior'],
    [/Awaken Agents is open source[\s\S]*first stable release is coming soon[\s\S]*interfaces and behavior may still change[\s\S]*hosted service/, 'Agents entry must state open-source pre-stable maturity and missing delivery evidence'],
  ], [
    [/^## (?:Deploy and operate|Contribute and extend|Troubleshooting)$/m, 'Platform entry must delegate neighboring procedures and troubleshooting'],
    [/End user|Application developer|Operator|Platform maintainer/, 'Platform entry diagram must describe components rather than roles'],
  ]],
  ['platform/current/zh/index.md', [
    [/^## 选择最小的系统边界/m, 'Chinese Platform entry must begin with the product-boundary decision'],
    [/\| Agent \|[\s\S]*\| Environment \|[\s\S]*\| Session \|[\s\S]*\| Event \|/, 'Chinese Platform entry must preserve the four application objects'],
    [/flowchart LR[\s\S]*sequenceDiagram/, 'Chinese Platform entry must include static and dynamic Mermaid views'],
    [/排队、有限重试、等待审批与 lease 恢复由各自机制处理/, 'Chinese Platform entry must classify built-in handling as normal behavior'],
    [/Awaken Agents 已开源[\s\S]*首个稳定版即将发布[\s\S]*接口与行为仍可能变化[\s\S]*托管服务/, 'Chinese Agents entry must state open-source pre-stable maturity and missing delivery evidence'],
  ], [
    [/^## (?:部署与运营|贡献与扩展|故障排查)$/m, 'Chinese Platform entry must delegate neighboring procedures and troubleshooting'],
    [/最终用户|应用开发者|运营人员|平台维护者/, 'Chinese Platform entry diagram must describe components rather than roles'],
  ]],
]) {
  requireText(join(docsRoot, docsRel), required);
  rejectText(join(docsRoot, docsRel), rejected);
}

// Cause/effect design for the protocol entry pages reviewed as one reader path:
// C1 an index repeats endpoints or beta headers already owned by `connect` and
//    compatibility; C2 a reader knows the systems to connect but not the protocol
//    name; C3 an official-SDK client needs to know what changes and what remains
//    one shared Agent/Session contract; C4 MCP export and import reverse ownership
//    and have different completion evidence; C5 discovery or a healthy transport
//    can be mistaken for permission and a committed result; C6 an attachment state
//    is expected or reconciled by the system and has no external repair action;
//    C7 a rejected request, failed replacement, or permanent create failure
//    survives built-in handling and has either a public correction or safe stop.
// E1 exact selection detail remains in one canonical owner; E2 the index routes by
// connection job; E3 Managed links to the first Session and compatibility owners;
// E4 MCP separates directions and observable completion; E5 MCP retains the
// permission and commit checks; E6 system-owned lifecycle stays in normal behavior;
// E7 Troubleshooting contains only public correction, safe stop, evidence, and
// redaction. Decision table:
// | Rule | duplicated authority | task first | peer aligned | authority + commit | automatic state in table | actionable failure covered | Outcome |
// | P1   | no                   | yes        | yes          | yes                | no                       | yes                       | accept  |
// | P2   | yes                  | any        | any          | any                | any                      | any                       | reject  |
// | P3   | no                   | no         | any          | any                | any                      | any                       | reject  |
// | P4   | no                   | yes        | no           | any                | any                      | any                       | reject  |
// | P5   | no                   | yes        | yes          | no                 | any                      | any                       | reject  |
// | P6   | no                   | yes        | yes          | yes                | yes                      | any                       | reject  |
// | P7   | no                   | yes        | yes          | yes                | no                       | no                        | reject  |
for (const [docsRel, required, rejected] of [
  ['platform/current/en/protocols/index.md', [
    [/title: "Choose a connection layer"/, 'English protocol index must name the connection-layer decision'],
    [/\| Connection job \| Start with \|/, 'English protocol index must route by connection job'],
    [/authoritative direction, endpoint, configuration surface, authentication rule/, 'English protocol index must delegate exact selection to connect'],
  ], [
    [/\/v1\/agents|managed-agents-2026-04-01|mcp_bearer_token/, 'English protocol index duplicates exact connection or compatibility detail'],
  ]],
  ['platform/current/zh/protocols/index.md', [
    [/title: "选择连接层"/, 'Chinese protocol index must name the connection-layer decision'],
    [/\| 要建立的连接 \| 从这里开始 \|/, 'Chinese protocol index must route by connection job'],
    [/方向、endpoint、配置入口、[\s\S]*认证规则/, 'Chinese protocol index must delegate exact selection to connect'],
  ], [
    [/\/v1\/agents|managed-agents-2026-04-01|mcp_bearer_token/, 'Chinese protocol index duplicates exact connection or compatibility detail'],
  ]],
  ['platform/current/en/protocols/managed-agents.md', [
    [/title: "What are Managed Agents, and how does Awaken connect\?"/, 'English Managed page must own the direct definition query'],
    [/## What changes, and what stays the same/, 'English Managed page must separate changed and preserved application contracts'],
    [/\/docs\/agents\/get-started\//, 'English Managed page must lead to the first Session'],
    [/\/docs\/agents\/compatibility\//, 'English Managed page must delegate the exact SDK matrix'],
    [/one wire adapter, one runtime/, 'English Managed page must preserve the adapter boundary'],
  ], [
    [/managed-agents-2026-04-01|\/v1\/agents/, 'English Managed page duplicates exact compatibility or route detail'],
  ]],
  ['platform/current/zh/protocols/managed-agents.md', [
    [/title: "什么是 Managed Agents，Awaken 如何接入？"/, 'Chinese Managed page must own the direct definition query'],
    [/## 哪些会改变，哪些保持不变/, 'Chinese Managed page must separate changed and preserved application contracts'],
    [/\/zh\/docs\/agents\/get-started\//, 'Chinese Managed page must lead to the first Session'],
    [/\/zh\/docs\/agents\/compatibility\//, 'Chinese Managed page must delegate the exact SDK matrix'],
    [/一个 wire adapter，一套 runtime/, 'Chinese Managed page must preserve the adapter boundary'],
  ], [
    [/managed-agents-2026-04-01|\/v1\/agents/, 'Chinese Managed page duplicates exact compatibility or route detail'],
  ]],
  ['platform/current/en/protocols/mcp.md', [
    [/title: "Choose the direction of an MCP connection"/, 'English MCP page must name the direction decision'],
    [/\| Goal \| Awaken's role \| The connection is ready when \|/, 'English MCP page must distinguish both directions by completion'],
    [/dedicated bearer[\s\S]*full[\s\S]*OAuth authorization profile/i, 'English MCP page must state the bounded authentication claim'],
    [/## Static structure:[\s\S]*## Dynamic behavior:/, 'English MCP page must retain static and dynamic architecture views'],
    [/exact tool id[\s\S]*permission decision[\s\S]*committed[\s\S]*tool result/, 'English MCP page must verify beyond discovery'],
    [/One MCP[\s\S]*server has one MCP ToolSet policy[\s\S]*newly discovered[\s\S]*missing, duplicate, or orphaned pair fails validation/, 'English MCP page must explain the server to ToolSet invariant and dynamic default'],
    [/states are not repair instructions for an external maintainer/, 'English MCP page must keep reconciled lifecycle out of troubleshooting'],
    [/^## Troubleshooting$[\s\S]*\| Session creation returns `400 invalid_request_error`[\s\S]*\| Updating an existing Session returns `500 api_error`[\s\S]*\| A new Session returns `500 api_error`/m, 'English MCP troubleshooting must cover only source-reachable external failures'],
    [/If the table does not resolve the problem,[\s\S]*Do not include bearer tokens/, 'English MCP troubleshooting must provide safe support evidence'],
  ], [
    [/^## Troubleshooting$[\s\S]*(?:Requested|Realizing|Active|Draining|Removed|Failed)[\s\S]*^## Reference$/m, 'English MCP troubleshooting must not turn attachment lifecycle states into repair rows'],
  ]],
  ['platform/current/zh/protocols/mcp.md', [
    [/title: "选择 MCP 连接方向"/, 'Chinese MCP page must name the direction decision'],
    [/\| 目标 \| Awaken 的位置 \| 连接完成的可见信号 \|/, 'Chinese MCP page must distinguish both directions by completion'],
    [/dedicated bearer[\s\S]*MCP 完整[\s\S]*OAuth authorization profile/i, 'Chinese MCP page must state the bounded authentication claim'],
    [/## 静态结构：[\s\S]*## 动态行为：/, 'Chinese MCP page must retain static and dynamic architecture views'],
    [/准确[\s\S]*tool id[\s\S]*permission decision[\s\S]*committed tool result/, 'Chinese MCP page must verify beyond discovery'],
    [/一个 MCP server[\s\S]*一个 MCP ToolSet 策略[\s\S]*后续发现[\s\S]*缺失、重复或没有对应 server/, 'Chinese MCP page must explain the server to ToolSet invariant and dynamic default'],
    [/这些状态不是交给外部维护者执行的修复步骤/, 'Chinese MCP page must keep reconciled lifecycle out of troubleshooting'],
    [/^## 故障排查$[\s\S]*\| 创建 Session 返回 `400 invalid_request_error`[\s\S]*\| 更新已有 Session 返回 `500 api_error`[\s\S]*\| 新 Session 返回 `500 api_error`/m, 'Chinese MCP troubleshooting must cover only source-reachable external failures'],
    [/如果表中步骤仍未解决问题[\s\S]*不要附带 bearer token/, 'Chinese MCP troubleshooting must provide safe support evidence'],
  ], [
    [/^## 故障排查$[\s\S]*(?:Requested|Realizing|Active|Draining|Removed|Failed)[\s\S]*^## 参考$/m, 'Chinese MCP troubleshooting must not turn attachment lifecycle states into repair rows'],
  ]],
]) {
  const path = join(docsRoot, docsRel);
  requireText(path, required);
  rejectText(path, rejected);
}

// Cause/effect test design for the single Awaken release-migration owner:
// C1: either locale loses the earlier-runtime/local-server to 1.0 mapping.
// C2: startup/configuration coordinates are renamed mechanically without a
//     separate-data and rollback boundary.
// C3: release migration duplicates protocol compatibility or deployment
//     architecture instead of delegating to their existing owners.
// C4: the reader journey does not link the migration owner from Start.
// E1: both locales expose one actionable old-to-new decision matrix.
// E2: in-place data reuse remains fail-closed unless an exact release path is
//     documented, while AllInOne is the first behavioral acceptance target.
// E3: compatibility, architecture, and self-hosting retain their own authority.
// E4: existing users can discover the migration before copying configuration.
// Decision table: R1 both locale mappings + separate data + delegated owners +
// Start links -> accept; R2 any mapping or locale absent -> reject; R3 migration
// lacks the data guard or owner links -> reject; R4 pages exist but Start and
// compatibility do not route to them -> reject.
for (const [docsRel, patterns] of [
  ['platform/current/en/how-to/migrate-to-1-0.md', [
    [/^## Choose the 1\.0 entry point$/m, '1.0 migration must begin with an entry-point decision'],
    [/Rust runtime library[\s\S]*ai-sdk-starter-agent[\s\S]*Separately started Admin Console[\s\S]*Managed Agents client/, '1.0 migration must map the earlier embedding, server, Console, and client paths'],
    [/AWAKEN_HTTP_ADDR[\s\S]*Earlier storage-directory environment variable[\s\S]*AWAKEN_ADMIN_API_BEARER_TOKEN[\s\S]*Typed TOML configuration/, '1.0 migration must map earlier startup configuration to the typed authority'],
    [/does not promise that an earlier local store can be[\s\S]*opened in place[\s\S]*separate `data_dir`[\s\S]*rollback/, '1.0 migration must fail closed on unproven in-place data reuse'],
    [/Managed Agents compatibility matrix[\s\S]*Agents architecture[\s\S]*self-hosting/, '1.0 migration must delegate compatibility and deployment details to their owners'],
    [/Awaken 1\.0 AllInOne[\s\S]*Split Control and Coordinator[\s\S]*database-free Workers/, '1.0 migration must show the local-first deployment transition'],
  ]],
  ['platform/current/zh/how-to/migrate-to-1-0.md', [
    [/^## 选择 1\.0 入口$/m, 'Chinese 1.0 migration must begin with the same entry-point decision'],
    [/Rust Runtime library[\s\S]*ai-sdk-starter-agent[\s\S]*单独启动的 Admin Console[\s\S]*Managed Agents 客户端/, 'Chinese 1.0 migration must map the same earlier application paths'],
    [/AWAKEN_HTTP_ADDR[\s\S]*旧版 storage-directory 环境变量[\s\S]*AWAKEN_ADMIN_API_BEARER_TOKEN[\s\S]*类型化 TOML 配置/, 'Chinese 1.0 migration must map earlier startup configuration to the typed authority'],
    [/没有承诺 1\.0 可以原地打开旧版本地 store[\s\S]*独立 `data_dir`[\s\S]*回滚/, 'Chinese 1.0 migration must fail closed on unproven in-place data reuse'],
    [/Managed Agents 兼容矩阵[\s\S]*Agents 架构[\s\S]*自托管指南/, 'Chinese 1.0 migration must delegate compatibility and deployment details to their owners'],
    [/Awaken 1\.0 AllInOne[\s\S]*拆分 Control 与 Coordinator[\s\S]*无数据库 Worker/, 'Chinese 1.0 migration must show the same local-first deployment transition'],
  ]],
  ['platform/current/en/index.md', [
    [/\/docs\/agents\/how-to\/migrate-to-1-0\//, 'Agents Start must link the 1.0 migration owner'],
  ]],
  ['platform/current/zh/index.md', [
    [/\/zh\/docs\/agents\/how-to\/migrate-to-1-0\//, 'Chinese Agents Start must link the 1.0 migration owner'],
  ]],
  ['platform/current/en/compatibility.md', [
    [/does not cover migration from an earlier Awaken runtime[\s\S]*\.\/how-to\/migrate-to-1-0/, 'Managed compatibility must delegate product migration'],
  ]],
  ['platform/current/zh/compatibility.md', [
    [/不负责旧版 Awaken Runtime[\s\S]*\.\/how-to\/migrate-to-1-0/, 'Chinese Managed compatibility must delegate product migration'],
  ]],
]) {
  requireText(join(docsRoot, docsRel), patterns);
}

for (const [docsRel, patterns] of [
  ['platform/current/en/concepts/architecture.md', [
    [/title: "Awaken Agents system and deployment architecture"/, 'Platform architecture must name the system and deployment decision'],
    [/^## Choose the deployment shape first/m, 'Platform architecture must help the reader choose before the component map'],
    [/all-in-one[\s\S]*Separate Control and Coordinator[\s\S]*separate Workers and Sandboxes/, 'Platform architecture must cover the three deployment choices'],
  ]],
  ['platform/current/zh/concepts/architecture.md', [
    [/title: "Awaken Agents 整体与部署架构"/, 'Chinese Platform architecture must name the system and deployment decision'],
    [/^## 先选择部署形态/m, 'Chinese Platform architecture must help the reader choose before the component map'],
    [/all-in-one[\s\S]*分开运行 Control 与 Coordinator[\s\S]*独立 Worker 与 Sandbox/, 'Chinese Platform architecture must cover the same three deployment choices'],
  ]],
  ['harness/current/en/explanation/architecture.md', [
    [/title: "Decide where to extend an Agent run"/, 'Runtime architecture must name the extension decision'],
    [/^## Choose the layer before changing code/m, 'Runtime architecture must route a change before the kernel diagram'],
    [/StreamSink[\s\S]*Leave the execution core unchanged/, 'Awaken Agents architecture must distinguish live progress from service-owned changes'],
  ]],
  ['harness/current/zh/explanation/architecture.md', [
    [/title: "判断一次 Agent Run 应在哪一层扩展"/, 'Chinese Runtime architecture must name the extension decision'],
    [/^## 修改代码前先选择层次/m, 'Chinese Runtime architecture must route a change before the kernel diagram'],
    [/StreamSink[\s\S]*不改变执行内核/, 'Chinese Awaken Agents architecture must distinguish live progress from service-owned changes'],
  ]],
  ['flow/current/en/concepts/core-concepts.md', [
    [/title: "Map a recurring job to Workforce's core objects"/, 'Workforce concepts must name the reader task'],
    [/^## Start with one job/m, 'Flow concepts must begin with one recognizable job'],
    [/Create a \*\*Project\*\*[\s\S]*Raise \*\*Attention\*\*/, 'Flow concepts must map scope through human intervention before the object catalog'],
  ]],
  ['flow/current/zh/concepts/core-concepts.md', [
    [/title: "为一项重复工作建立 Workforce 模型"/, 'Chinese Workforce concepts must name the reader task'],
    [/^## 从一项工作开始/m, 'Chinese Flow concepts must begin with one recognizable job'],
    [/建立一个 \*\*Project\*\*[\s\S]*产生 \*\*Attention\*\*/, 'Chinese Flow concepts must map the same scope through human intervention'],
  ]],
  ['platform/current/en/compatibility.md', [
    [/title: "Check whether an Anthropic Managed Agents client can run on Awaken"/, 'Compatibility must name the client migration decision'],
    [/^## Make the compatibility decision first/m, 'Compatibility must route the reader before the SDK example and matrices'],
    [/Compatible with constraints[\s\S]*Awaken extension[\s\S]*outside the tables/, 'Compatibility must distinguish constrained, native-extension, and unreviewed outcomes'],
    [/@anthropic-ai\/sdk` 0\.122\.0[\s\S]*Python `anthropic` 1\.2\.0[\s\S]*tested versions, not dependency requirements[\s\S]*baseURL[\s\S]*Awaken[\s\S]*authentication[\s\S]*beta selector/, 'Compatibility must separate the validation record from customer dependency choice and retain exact connection changes'],
  ]],
  ['platform/current/zh/compatibility.md', [
    [/title: "判断现有 Anthropic Managed Agents 客户端能否接入 Awaken"/, 'Chinese compatibility must name the client migration decision'],
    [/^## 先做兼容性判断/m, 'Chinese compatibility must route the reader before the SDK example and matrices'],
    [/有约束兼容[\s\S]*Awaken 扩展[\s\S]*不在表内/, 'Chinese compatibility must preserve the same four outcomes'],
    [/@anthropic-ai\/sdk` 0\.122\.0[\s\S]*Python `anthropic` 1\.2\.0[\s\S]*已测试版本[\s\S]*不是依赖要求[\s\S]*baseURL[\s\S]*Awaken 认证[\s\S]*beta selector/, 'Chinese compatibility must separate the validation record from customer dependency choice and retain the same connection changes'],
  ]],
  ['platform/current/en/concepts/production-reliability.md', [
    [/title: "What is durable Agent execution and recovery\?"/, 'Reliability must own the direct durable-execution query'],
    [/^## First decide whether any action is needed/m, 'Reliability must separate automatic recovery before asking for action'],
    [/same `operation_id`[\s\S]*retry budget is exhausted[\s\S]*ToolRecoveryPolicy[\s\S]*does not create a dead letter[\s\S]*Public HTTP API/, 'Reliability must distinguish automatic terminalization from explicit quarantine'],
  ]],
  ['platform/current/zh/concepts/production-reliability.md', [
    [/title: "什么是持久 Agent 执行与恢复？"/, 'Chinese reliability must own the direct durable-execution query'],
    [/^## 先判断是否需要处理/m, 'Chinese reliability must separate automatic recovery before asking for action'],
    [/相同 `operation_id`[\s\S]*retry budget 耗尽[\s\S]*ToolRecoveryPolicy[\s\S]*不会产生 dead letter[\s\S]*公共 HTTP API/, 'Chinese reliability must distinguish automatic terminalization from explicit quarantine'],
  ]],
  ['platform/current/en/concepts/brain-and-hand.md', [
    [/title: "Decide when a Session needs a local execution environment"/, 'Brain and Hand must name the environment decision'],
    [/^## Start with the work that must run locally/m, 'Brain and Hand must route local demand before the structure'],
    [/one Worker claim[\s\S]*one Session Environment[\s\S]*one tool\s+executor/, 'Brain and Hand must preserve the single physical execution owner'],
    [/`on_tool_use`[\s\S]*hibernates[\s\S]*does not create a maintenance task/, 'Brain and Hand must distinguish deferred realization and automatic hibernation'],
  ]],
  ['platform/current/zh/concepts/brain-and-hand.md', [
    [/title: "判断 Session 何时需要本地执行环境"/, 'Chinese Brain and Hand must name the environment decision'],
    [/^## 先判断哪些工作必须在本地执行/m, 'Chinese Brain and Hand must route local demand before the structure'],
    [/一个 Worker claim[\s\S]*一个 Session Environment[\s\S]*一个 tool executor/, 'Chinese Brain and Hand must preserve the single physical execution owner'],
    [/`on_tool_use`[\s\S]*休眠[\s\S]*不产生维护任务/, 'Chinese Brain and Hand must distinguish deferred realization and automatic hibernation'],
  ]],
  ['platform/current/en/concepts/configuration-to-execution.md', [
    [/title: "Trace a published Agent to one committed Run"/, 'Configuration path must name the identity-tracing task'],
    [/^## Follow the revision and fingerprint/m, 'Configuration path must begin with stable execution identity'],
    [/StoredPublication[\s\S]*ExecutableAgentCatalog[\s\S]*CommitOperation[\s\S]*Committed Thread facts/, 'Configuration path must retain its four authority boundaries'],
    [/^## Act only on errors surfaced before dispatch/m, 'Configuration path must reserve action for surfaced pre-dispatch results'],
  ]],
  ['platform/current/zh/concepts/configuration-to-execution.md', [
    [/title: "从已发布 Agent 追踪到一次已提交 Run"/, 'Chinese configuration path must name the identity-tracing task'],
    [/^## 沿着 revision 与 fingerprint 追踪/m, 'Chinese configuration path must begin with stable execution identity'],
    [/StoredPublication[\s\S]*ExecutableAgentCatalog[\s\S]*CommitOperation[\s\S]*已提交的 Thread facts/, 'Chinese configuration path must retain its four authority boundaries'],
    [/^## 只处理 dispatch 之前明确返回的错误/m, 'Chinese configuration path must reserve action for surfaced pre-dispatch results'],
  ]],
  ['platform/current/en/concepts/sessions-and-events.md', [
    [/title: "What is an Agent Session\? Session, Thread, Run, and event roles"/, 'Sessions page must own the direct Session query and state roles'],
    [/^## Choose the durable identity first/m, 'Sessions page must define the durable identity before event details'],
    [/Session[\s\S]*Thread[\s\S]*Run[\s\S]*Event stream[\s\S]*not another store/, 'Sessions page must preserve four distinct state owners'],
    [/committed Thread facts[\s\S]*reconnect[\s\S]*does not\s+require repair/i, 'Sessions page must describe replay as automatic behavior'],
  ]],
  ['platform/current/zh/concepts/sessions-and-events.md', [
    [/title: "什么是 Agent Session？Session、Thread、Run 与事件的职责"/, 'Chinese sessions page must own the direct Session query and state roles'],
    [/^## 先选择持久身份/m, 'Chinese sessions page must define the durable identity before event details'],
    [/Session[\s\S]*Thread[\s\S]*Run[\s\S]*Event stream[\s\S]*不是另一份存储/, 'Chinese sessions page must preserve four distinct state owners'],
    [/已提交的 Thread facts[\s\S]*重连[\s\S]*不需要修复/, 'Chinese sessions page must describe replay as automatic behavior'],
  ]],
  ['platform/current/en/concepts/governance.md', [
    [/title: "Keep publication, request authorization, and tool approval separate"/, 'Governance must name the three-decision boundary'],
    [/^## Start from the decision being made/m, 'Governance must route by decision before policy structure'],
    [/fixed role grants[\s\S]*hosting product may compose[\s\S]*must not redefine/, 'Governance must separate Awaken Agents grants from hosting access levels'],
    [/RequireConfirmation[\s\S]*Awaiting[\s\S]*ResumeTicket/, 'Governance must preserve committed approval state'],
  ]],
  ['platform/current/zh/concepts/governance.md', [
    [/title: "分开处理发布、请求授权与工具审批"/, 'Chinese governance must name the three-decision boundary'],
    [/^## 先判断正在做哪一种决定/m, 'Chinese governance must route by decision before policy structure'],
    [/固定的 role grant[\s\S]*托管产品可以组合[\s\S]*不能重新定义/, 'Chinese governance must separate Awaken Agents grants from hosting access levels'],
    [/RequireConfirmation[\s\S]*Awaiting[\s\S]*ResumeTicket/, 'Chinese governance must preserve committed approval state'],
  ]],
  ['platform/current/en/concepts/credential-custody.md', [
    [/title: "Choose where a credential is stored and opened"/, 'Credential custody must name the deployment choice'],
    [/^## Choose one custody path before publication/m, 'Credential custody must start before publication'],
    [/Open-source or self-hosted[\s\S]*Hosted[\s\S]*Enterprise or customer-owned custody[\s\S]*Fail closed/, 'Credential custody must cover all deployment outcomes without fallback'],
    [/write-only API[\s\S]*exact revision[\s\S]*installed delivery path[\s\S]*admission succeeds/, 'Credential custody must give one secret-free publication sequence'],
  ]],
  ['platform/current/zh/concepts/credential-custody.md', [
    [/title: "选择凭据保存在哪里、由谁打开"/, 'Chinese credential custody must name the deployment choice'],
    [/^## 发布前选择一条凭据保管路径/m, 'Chinese credential custody must start before publication'],
    [/开源版或自托管[\s\S]*云端托管[\s\S]*企业部署或客户自持保管[\s\S]*失败关闭/, 'Chinese credential custody must preserve all deployment outcomes'],
    [/只写 API[\s\S]*精确 revision[\s\S]*唯一已安装交付路径[\s\S]*通过准入后/, 'Chinese credential custody must preserve the same publication sequence'],
  ]],
  ['platform/current/en/how-to/configure-providers-models-credentials.md', [
    [/title: "Make one provider model runnable"/, 'Provider guide must name the runnable outcome'],
    [/^## 1\. Choose the connection you are creating/m, 'Provider guide must route authentication before configuration'],
    [/`secret`[\s\S]*`oauth_helper`[\s\S]*`credential_source_id`[\s\S]*custom endpoint/, 'Provider guide must preserve all four connection choices'],
    [/Provider Connection is the only authoring command[\s\S]*\/v1\/config\/executable-models[\s\S]*new Session/, 'Provider guide must keep one write owner and all completion conditions'],
  ]],
  ['platform/current/zh/how-to/configure-providers-models-credentials.md', [
    [/title: "让一个 provider 模型可运行"/, 'Chinese provider guide must name the runnable outcome'],
    [/^## 1\. 判断要建立哪种连接/m, 'Chinese provider guide must route authentication before configuration'],
    [/`secret`[\s\S]*`oauth_helper`[\s\S]*`credential_source_id`[\s\S]*自定义 endpoint/, 'Chinese provider guide must preserve all four connection choices'],
    [/Provider Connection 是 provider credential 与 endpoint 的唯一写入命令[\s\S]*\/v1\/config\/executable-models[\s\S]*新 Session/, 'Chinese provider guide must keep one write owner and all completion conditions'],
  ]],
  ['platform/current/en/how-to/connect-a-published-agent.md', [
    [/title: "Connect one published Agent to your application"/, 'Application guide must name one bounded integration task'],
    [/^## 1\. Choose one application path/m, 'Application guide must start with one linear path'],
    [/Client → Awaken Agents[\s\S]*recognize later[\s\S]*same Session in Console/, 'Application guide must select once and finish at shared Session state'],
    [/^## Verify[\s\S]*1\.[\s\S]*2\.[\s\S]*3\.[\s\S]*4\./m, 'Application guide must keep four visible acceptance facts'],
    [/I\["\/v1\/ai-sdk\/\*"\][\s\S]*G\["\/v1\/ag-ui"\][\s\S]*M\["\/v1\/agents · \/v1\/sessions"\]/, 'Application guide must quote Mermaid endpoint labels'],
  ]],
  ['platform/current/zh/how-to/connect-a-published-agent.md', [
    [/title: "把一个已发布 Agent 接入应用"/, 'Chinese application guide must name one bounded integration task'],
    [/^## 1\. 选择一条应用接入路径/m, 'Chinese application guide must start with one linear path'],
    [/Client → Awaken Agents[\s\S]*容易辨认[\s\S]*Console 打开同一个 Session/, 'Chinese application guide must select once and finish at shared Session state'],
    [/^## 验证[\s\S]*1\.[\s\S]*2\.[\s\S]*3\.[\s\S]*4\./m, 'Chinese application guide must keep four visible acceptance facts'],
    [/I\["\/v1\/ai-sdk\/\*"\][\s\S]*G\["\/v1\/ag-ui"\][\s\S]*M\["\/v1\/agents · \/v1\/sessions"\]/, 'Chinese application guide must quote Mermaid endpoint labels'],
  ]],
  ['platform/current/en/protocols/connect.md', [
    [/title: "Choose the protocol for one connection"/, 'Protocol matrix must name the connection decision'],
    [/Choose by direction before choosing by protocol name/, 'Protocol matrix must route by initiator before acronym'],
    [/Client → Awaken Agents[\s\S]*Remote Agent → Awaken Agents[\s\S]*Awaken Agents → Remote Agent[\s\S]*Worker → external brain process[\s\S]*Operator → active Session/, 'Protocol matrix must preserve every supported direction under the public product name'],
    [/^## After choosing a row[\s\S]*wire response[\s\S]*same Session or event record/m, 'Protocol matrix must finish with both protocol and state checks'],
  ]],
  ['platform/current/zh/protocols/connect.md', [
    [/title: "为一次连接选择协议"/, 'Chinese protocol matrix must name the connection decision'],
    [/先按方向选择，再看协议名称/, 'Chinese protocol matrix must route by initiator before acronym'],
    [/Client → Awaken Agents[\s\S]*Remote Agent → Awaken Agents[\s\S]*Awaken Agents → Remote Agent[\s\S]*Worker → external brain process[\s\S]*Operator → active Session/i, 'Chinese protocol matrix must preserve every supported direction under the public product name'],
    [/^## 选定一行之后[\s\S]*线路响应[\s\S]*同一个 Session 或 event 记录/m, 'Chinese protocol matrix must finish with both protocol and state checks'],
  ]],
]) {
  const path = join(docsRoot, docsRel);
  requireText(path, patterns);
  rejectText(path, [[/^---[\s\S]*?---[\s\S]{0,700}(?:repository evidence|source proves|代码证明|仓库证据)/i, 'reviewed page opening must lead with the reader action, not proof language']]);
}

for (const docsRel of [
  'platform/current/en/how-to/connect-a-published-agent.md',
  'platform/current/zh/how-to/connect-a-published-agent.md',
]) {
  rejectText(join(docsRoot, docsRel), [[/^\| (?:Existing application|应用现状) \|/m, 'application guide must not copy the canonical protocol-selection table']]);
}

// Cause-effect design for client-rendered diagrams and ordinary code blocks:
// C1: a rendered block is Mermaid; C2: it is ordinary literal code; C3: the
//     document is English or Chinese; C4: clipboard write succeeds or fails.
// E1: Mermaid source remains byte-for-byte free of appended controls before the
//     renderer reads textContent; E2: ordinary code receives one localized Copy
//     control; E3: the control reports success/failure and restores its label.
// Constraint: one renderer-level exclusion owns this behavior; Markdown files
// must not carry per-diagram sentinel comments to absorb UI text.
// Decision table:
// | Rule | block kind | locale | clipboard | Outcome |
// | M1   | Mermaid    | any    | n/a       | no control; render source unchanged |
// | M2   | code       | en/zh  | success   | localized control reports copied |
// | M3   | code       | en/zh  | failure   | localized control reports failure |
requireText(docsPagePath, [
  [/if \(block\.matches\('\.mermaid'\)\) continue;[\s\S]*block\.append\(button\)/, 'shared page must exclude Mermaid before adding the ordinary code-copy control'],
]);

// Cause/effect design for Mermaid 11 edge-label theming:
// C1: flowchart labels render inside HTML `.labelBkg` nodes; C2: some diagrams
// also emit SVG label rectangles; C3: Mermaid's generated grey background can
// conflict with either site theme. E1: both HTML and SVG label backgrounds use
// the site surface token, remain opaque, and keep readable foreground text.
// Decision rule T1 accepts scoped `g.edgeLabel` selectors for both render forms;
// T2 rejects a background-only foreignObject rule because it does not style the
// element Mermaid 11 actually paints.
requireText(join(root, 'astro.config.mjs'), [
  [/g\.edgeLabel rect, g\.edgeLabel \.labelBkg, g\.edgeLabel span\.edgeLabel, g\.edgeLabel p[\s\S]*fill: var\(--color-ink-850\)[\s\S]*background: var\(--color-ink-850\)[\s\S]*opacity: 1/, 'Mermaid edge labels must style both SVG and HTML backgrounds with an opaque site token'],
]);

// Cause/effect design for reader-action quality gates:
// C1: a critical task page can be technically accurate while omitting the
//     outcome, starting conditions, visible result, recovery action, or onward
//     path the reader needs to finish.
// C2: a task that creates durable state can leave readers without a safe stop,
//     continuation, or cleanup choice.
// C3: an architecture page can list components without explaining one causal
//     execution path, the last reliable state after failure, or what its reader
//     should do next.
// C4: implementation evidence can leak into the editorial voice so that the
//     page tells readers what the repository proves instead of what they can do.
// E1: every critical first-success path is an actionable reader journey.
// E2: durable examples end with an explicit safe lifecycle choice.
// E3: each product-level architecture provides both static and dynamic views,
//     failure/recovery guidance, persistence boundary, and explicit non-goals.
// E4: evidence remains a silent release control unless inspecting evidence is
//     itself the reader's task.
// Decision table:
// | Rule | task closure | durable lifecycle | architecture closure | proof-led voice | Outcome |
// | Q1   | complete     | complete/applicable | complete           | absent          | accept  |
// | Q2   | incomplete   | any                 | any                | any             | reject  |
// | Q3   | complete     | missing             | any                | any             | reject  |
// | Q4   | any          | any                 | incomplete         | any             | reject  |
// | Q5   | any          | any                 | any                | present         | reject  |
for (const [docsRel, lifecyclePattern] of [
  ['flow/current/en/tutorials/first-agent-run.md', /^## Clean up/m],
  ['flow/current/zh/tutorials/first-agent-run.md', /^## 清理/m],
]) {
  requireText(join(docsRoot, docsRel), [[lifecyclePattern, 'durable task must explain how to stop, continue, or clean up safely']]);
}

for (const docsRel of [
  'platform/current/en/concepts/architecture.md',
  'platform/current/zh/concepts/architecture.md',
  'harness/current/en/explanation/architecture.md',
  'harness/current/zh/explanation/architecture.md',
  'flow/current/en/concepts/core-concepts.md',
  'flow/current/zh/concepts/core-concepts.md',
]) {
  const path = join(docsRoot, docsRel);
  const isZh = docsRel.includes('/zh/');
  requireText(path, isZh ? [
    [/^## [^\n]*静态/m, 'architecture must include a static structure view'],
    [/所有权|权威/, 'architecture must explain component ownership'],
    [/^## [^\n]*动态/m, 'architecture must follow one dynamic sequence'],
    [/提交|Fact|commit/, 'architecture must identify the persistence boundary'],
    [/失败|拒绝|retry|重试/, 'architecture must explain failure and recovery in reader-visible terms'],
    [/终态|terminal|Ended|RunState/, 'architecture must identify terminal outcomes'],
    [/^## 非目标/m, 'architecture must state explicit non-goals'],
  ] : [
    [/^## [^\n]*Static/m, 'architecture must include a static structure view'],
    [/ownership|authority/i, 'architecture must explain component ownership'],
    [/^## [^\n]*Dynamic/m, 'architecture must follow one dynamic sequence'],
    [/persistence|committed|commit/, 'architecture must identify the persistence boundary'],
    [/failure|rejected|retry|recovery/i, 'architecture must explain failure and recovery in reader-visible terms'],
    [/terminal|Ended|RunState/, 'architecture must identify terminal outcomes'],
    [/^## Non-goals/m, 'architecture must state explicit non-goals'],
  ]);
}

// Cause/effect design for the three product documentation entry points:
// C1: an entry can open with architecture, ownership, or repository evidence
//     before the reader knows the first task and visible result.
// C2: simplifying the opening can erase the one Agent/Session authority, the
//     Runtime extension boundary, or Flow's pinned Issue and external truth.
// C3: a happy path can omit the state that tells the reader to continue,
//     inspect, resolve Attention, retry, or move to the next guide.
// E1: Platform readers choose the product boundary, then run and observe one
//     Session before choosing topology.
// E2: Runtime readers select one code-owned extension point and see one run's
//     resolve, gate, stage, commit, and failure/recovery sequence.
// E3: Flow readers create one Issue, assign work, handle Attention, and accept
//     only a fact returned by the system that owns it.
// E4: each entry keeps its exact technical owner without leading in proof voice.
// Decision table:
// | Rule | first task/result | owner boundary | failure/next action | proof-led opening | Outcome |
// | D1   | present           | present        | present             | absent            | accept  |
// | D2   | absent            | any            | any                 | any               | reject  |
// | D3   | present           | absent         | any                 | any               | reject  |
// | D4   | present           | present        | absent              | any               | reject  |
// | D5   | present           | present        | present             | present           | reject  |
for (const [docsRel, patterns] of [
  ['platform/current/en/index.md', [
    [/^## Choose the smallest boundary/m, 'Platform entry must lead with the product boundary'],
    [/observes[\s\S]*`session\.status_idle`/, 'Platform entry must name the first visible terminal state'],
    [/^## The application contract/m, 'Platform entry must retain the compact static contract'],
    [/Production reliability/, 'Platform entry must route a non-idle Session to recovery'],
  ]],
  ['platform/current/zh/index.md', [
    [/^## 选择最小的系统边界/m, 'Chinese Platform entry must lead with the product boundary'],
    [/看到 `session\.status_idle`/, 'Chinese Platform entry must name the first visible terminal state'],
    [/^## 应用使用的契约/m, 'Chinese Platform entry must retain the compact static contract'],
    [/生产可靠性/, 'Chinese Platform entry must route a non-idle Session to recovery'],
  ]],
  ['harness/current/en/index.md', [
    [/Use this section only when/, 'Runtime entry must state who should enter this section'],
    [/ExecutableAgentSnapshot/, 'Runtime entry must keep one runnable Agent shape'],
    [/^## What happens inside one run/m, 'Runtime entry must show the dynamic execution sequence'],
    [/previous commit as the recovery point/, 'Runtime entry must name failure recovery'],
  ]],
  ['harness/current/zh/index.md', [
    [/只有需要嵌入 Rust Runtime/, 'Chinese Runtime entry must state who should enter this section'],
    [/ExecutableAgentSnapshot/, 'Chinese Runtime entry must keep one runnable Agent shape'],
    [/^## 一次 run 内部会发生什么/m, 'Chinese Runtime entry must show the dynamic execution sequence'],
    [/上一份 commit 是恢复起点/, 'Chinese Runtime entry must name failure recovery'],
  ]],
  ['flow/current/en/index.md', [
    [/^## Create the first Issue/m, 'Flow entry must lead with creation of one work item'],
    [/Attention and retry|Attention.*retry/s, 'Flow entry must explain exception recovery'],
    [/system that owns it|Connector or verifier/, 'Flow entry must preserve external acceptance ownership'],
    [/^## How Workforce carries that Issue/m, 'Workforce entry must retain the dynamic model after the task'],
  ]],
  ['flow/current/zh/index.md', [
    [/^## 创建第一项 Issue/m, 'Chinese Flow entry must lead with creation of one work item'],
    [/Attention 后再重试/, 'Chinese Flow entry must explain exception recovery'],
    [/拥有对应事实的 Connector 或 verifier/, 'Chinese Flow entry must preserve external acceptance ownership'],
    [/^## Workforce 如何承载这项 Issue/m, 'Chinese Workforce entry must retain the dynamic model after the task'],
  ]],
]) {
  requireText(join(docsRoot, docsRel), patterns);
}

// Cause-effect design for the source-aligned Workforce console documentation:
// C1: the source UI exposes Home, Chats, Work, Objects, Library, Overview,
//     Outcomes, Canvases, Issue detail, and solution Workbench while docs still
//     begin from domain nouns.
// C2: Runs, Agent Center, and Objects appear in one composed console and can be
//     mistaken for Workforce-owned execution or business-object authorities.
// C3: an Outcome review can present supporting Run/Issue evidence beside formal
//     deliverables, tempting readers to accept technical completion as business completion.
// C4: the Work page can be described as a stored inbox or a merged approval
//     lifecycle even though it is a projection over distinct owner states.
// C5: Chats and Canvases can be misread as new Workforce-owned transcript and
//     Design stores even though they project Agents and Objects authorities.
// E1: the overview maps each current UI surface to the user decision it supports.
// E2: Agents, Objects, and Workforce retain three explicit, non-overlapping owners.
// E3: the Outcome guide names the formal-deliverable decision boundary and keeps
//     supporting work as evidence only.
// E4: the operations guide names Work as a projection and preserves distinct
//     Attention, business approval, tool-call control, and Resource responsibilities.
// E5: the overview names Chats as an Awaken conversation projection and Canvases
//     as exact Objects Resources, rejecting both parallel authorities.
// Decision table:
// | Rule | UI map | three owners | formal boundary | Work projection | Chats/Canvas owners | Outcome |
// | W1   | yes    | yes          | yes             | yes                  | yes                 | accept  |
// | W2   | no     | any          | any             | any                  | any                 | reject  |
// | W3   | yes    | no           | any             | any                  | any                 | reject  |
// | W4   | yes    | yes          | no              | any                  | any                 | reject  |
// | W5   | yes    | yes          | yes             | no                   | any                 | reject  |
// | W6   | yes    | yes          | yes             | yes                  | no                  | reject  |
for (const locale of ['en', 'zh']) {
  const flow = join(docsRoot, 'flow/current', locale);
  const overview = join(flow, 'index.md');
  const outcomes = join(flow, 'how-to/manage-outcomes.md');
  const needsYou = join(flow, 'operating/inbox-approvals.md');
  requireText(overview, [
    [locale === 'zh' ? /^## 从眼前需要作出的决定进入/m : /^## Start from the decision in front of you/m, `${locale} Workforce overview must begin its UI map from user decisions`],
    [/Workspace \*\*Home\*\*[\s\S]*Workspace \*\*Work\*\*[\s\S]*Workspace \*\*Chats\*\*[\s\S]*Workspace \*\*Objects\*\*[\s\S]*Workspace \*\*Library\*\*[\s\S]*Project \*\*Overview\*\*[\s\S]*\*\*Outcomes\*\*[\s\S]*Project \*\*Canvases\*\*[\s\S]*\*\*Issues\*\*[\s\S]*\*\*Workbench\*\*/, `${locale} Workforce overview must map the current primary console surfaces`],
    [/Awaken Workforce[\s\S]*Awaken Objects[\s\S]*Awaken Agents/, `${locale} Workforce overview must retain exactly named product owners`],
    [/Workforce.*Objects.*Agents.*Workforce/s, `${locale} Workforce overview must show one composed owner path`],
    [/\*\*Chats\*\*[\s\S]*(?:Awaken conversation|Awaken Session)[\s\S]*(?:not a Flow transcript|不是 Flow transcript)[\s\S]*\*\*Canvases\*\*[\s\S]*(?:Objects-owned|Objects 拥有)[\s\S]*(?:not a second Design backend|不是第二套 Design 后台)/, `${locale} Workforce overview must keep Chats and Canvases on their existing authorities`],
  ]);
  requireText(outcomes, [
    [locale === 'zh' ? /^## 在 Console 中从哪里查看/m : /^## Where this appears in the console/m, `${locale} Outcome guide must map Home, Outcomes, and Outcome Review`],
    [/Outcome Review[\s\S]*(?:正式交付物|formal deliverables)[\s\S]*(?:supporting|Supporting)/s, `${locale} Outcome guide must separate formal delivery from supporting work`],
    [/Agents[\s\S]*Objects[\s\S]*Workforce|Workforce[\s\S]*Agents[\s\S]*Objects/s, `${locale} Outcome guide must preserve all three product owners`],
  ]);
  requireText(needsYou, [
    [/Workspace \*\*Work\*\*/, `${locale} operations guide must name the shipping Work surface`],
    [/(?:projection|投影|派生)/, `${locale} Work documentation must reject a second stored lifecycle`],
    [/Workforce[\s\S]*Agents[\s\S]*Objects/s, `${locale} Work guide must preserve work, execution, and object ownership`],
  ]);
}

for (const docsRel of [
  'platform/current/en/index.md',
  'platform/current/zh/index.md',
  'harness/current/en/index.md',
  'harness/current/zh/index.md',
  'flow/current/en/index.md',
  'flow/current/zh/index.md',
]) {
  const path = join(docsRoot, docsRel);
  const text = readFileSync(path, 'utf8');
  if (/successful Run is committed technical evidence|成功的 Run\s*只是已提交的技术证据|proves the mechanism|证明机制/.test(text)) {
    failures.push(`${docsRel}: entry must explain the reader task instead of opening with technical proof`);
  }
}

// Cause/effect design for the three first-result guides:
// C1: a guide can explain architecture or repository evidence before the
//     reader knows the task and its visible finish line.
// C2: a command sequence can finish without naming the exact event, terminal
//     state, transcript, object, or browser result that confirms success.
// C3: a local run can return a surfaced result that needs a correction, or enter
//     a transient state that built-in recovery owns without reader intervention.
// C4: a shorter guide can blur the Platform, embedded Runtime, and Flow
//     workspace boundaries or imply that a local fixture used a live model.
// C5: an inline URL or identifier can widen a mobile page even when fenced
//     code blocks and tables have their own horizontal scroll containers.
// E1: each reader sees one task and finish line before the first procedure.
// E2: Platform ends at a reopened Session, Runtime at a committed NaturalEnd,
//     and Flow at one visible first Issue without a live-model claim.
// E3: each guide separates automatic convergence from externally actionable
//     results and supplies a next task; durable guides also supply an explicit
//     stop, keep, or reset choice.
// E4: the opening tells the reader what to do rather than what the source proves.
// E5: long inline code wraps inside the reading column while fenced code keeps
//     its independent horizontal scrolling behavior.
// Decision table:
// | Rule | task before detail | exact finish | action only after surfaced result | boundary true | proof-led opening | mobile fit | Outcome |
// | F1   | yes                | yes          | yes                | yes           | no                | yes        | accept  |
// | F2   | no                 | any          | any                | any           | any               | any        | reject  |
// | F3   | yes                | no           | any                | any           | any               | any        | reject  |
// | F4   | yes                | yes          | no                 | any           | any               | any        | reject  |
// | F5   | yes                | yes          | yes                | no            | any               | any        | reject  |
// | F6   | yes                | yes          | yes                | yes           | yes               | any        | reject  |
// | F7   | yes                | yes          | yes                | yes           | no                | no         | reject  |
for (const [docsRel, patterns] of [
  ['platform/current/en/get-started.md', [
    [/You are done when[\s\S]*`agent\.message`[\s\S]*`idle`/, 'Agents guide must name the task and first visible finish line'],
    [/`session\.status_idle`/, 'Platform guide must name the exact terminal event'],
    [/^## 6\. Reopen the Session after a restart/m, 'Platform guide must finish by reopening committed history'],
    [/^## Act on an explicit result/m, 'Platform guide must reserve corrective action for explicit results'],
    [/process exits; it does not select another port/, 'Platform guide must not claim automatic alternate-port selection'],
    [/A short `queued` period is normal/, 'Platform guide must classify brief queueing as normal system behavior'],
    [/^## Keep or remove the local state/m, 'Platform guide must provide a safe lifecycle choice'],
  ]],
  ['platform/current/zh/get-started.md', [
    [/打印出 `agent\.message`[\s\S]*回到 `idle`[\s\S]*重启 Awaken 后仍能读到/, 'Chinese Platform guide must name the task and first visible finish line'],
    [/`session\.status_idle`/, 'Chinese Platform guide must name the exact terminal event'],
    [/^## 6\. 重启后重新打开 Session/m, 'Chinese Platform guide must finish by reopening committed history'],
    [/^## 对明确结果采取动作/m, 'Chinese Platform guide must reserve corrective action for explicit results'],
    [/进程会退出，不会自动选择/, 'Chinese Platform guide must not claim automatic alternate-port selection'],
    [/短暂 `queued` 属于正常状态/, 'Chinese Platform guide must classify brief queueing as normal system behavior'],
    [/^## 保留或清理本地状态/m, 'Chinese Platform guide must provide a safe lifecycle choice'],
  ]],
  ['harness/current/en/get-started.md', [
    [/^## 1\. Run the smallest Agent/m, 'Runtime guide must begin with one runnable Agent'],
    [/Ended\(NaturalEnd\)[\s\S]*committed transcript/, 'Runtime guide must name the exact first result'],
    [/cargo test -p awaken-runtime-examples --test hello_agent --test direct_runtime/, 'Runtime guide must keep the checked example path'],
    [/^## Act only on a reported result/m, 'Runtime guide must reserve action for surfaced results'],
    [/do not need an API key[\s\S]*model-visible error result/, 'Runtime guide must classify provider access and Tool errors as built-in behavior'],
    [/^## Leave the Runtime path when/m, 'Runtime guide must route platform tasks to their owner'],
  ]],
  ['harness/current/zh/get-started.md', [
    [/^## 1\. 运行最小 Agent/m, 'Chinese Runtime guide must begin with one runnable Agent'],
    [/Ended\(NaturalEnd\)[\s\S]*已提交 transcript/, 'Chinese Runtime guide must name the exact first result'],
    [/cargo test -p awaken-runtime-examples --test hello_agent --test direct_runtime/, 'Chinese Runtime guide must keep the checked example path'],
    [/^## 只对明确结果采取动作/m, 'Chinese Runtime guide must reserve action for surfaced results'],
    [/不需要 API key[\s\S]*模型可见的错误结果/, 'Chinese Runtime guide must classify provider access and Tool errors as built-in behavior'],
    [/^## 这些需求应离开 Runtime 路径/m, 'Chinese Runtime guide must route platform tasks to their owner'],
  ]],
  ['flow/current/en/quickstart.md', [
    [/You are done when[\s\S]*Explore[\s\S]*Awaken[\s\S]*Workforce/, 'Workforce guide must name the browser-visible finish line'],
    [/does not run a live model/, 'Workforce guide must keep the local fixture boundary explicit'],
    [/"configuration_ready": true[\s\S]*`first_issue`/, 'Workforce guide must name the Bootstrap success response'],
    [/^## When the result differs/m, 'Workforce guide must provide bounded recovery actions'],
    [/^## Stop or start over/m, 'Workforce guide must provide a safe lifecycle choice'],
  ]],
  ['flow/current/zh/quickstart.md', [
    [/显示 \*\*Explore Awaken Workforce\*\*[\s\S]*完成了/, 'Chinese Workforce guide must name the browser-visible finish line'],
    [/不会调用真实模型/, 'Chinese Workforce guide must keep the local fixture boundary explicit'],
    [/"configuration_ready": true[\s\S]*`first_issue`/, 'Chinese Workforce guide must name the Bootstrap success response'],
    [/^## 结果不一致时/m, 'Chinese Workforce guide must provide bounded recovery actions'],
    [/^## 停止或重新开始/m, 'Chinese Workforce guide must provide a safe lifecycle choice'],
  ]],
]) {
  const path = join(docsRoot, docsRel);
  requireText(path, patterns);
  const text = readFileSync(path, 'utf8');
  const frontmatterEnd = text.indexOf('\n---', 4);
  const firstProcedure = text.indexOf('\n## ', frontmatterEnd + 4);
  const opening = text.slice(frontmatterEnd + 4, firstProcedure);
  if (/\b(?:proof|proves|evidence|verified)\b|证明|证据|验证了/.test(opening)) {
    failures.push(`${docsRel}: opening must explain the reader's task, not make a proof claim`);
  }
}

// Cause/effect design for the consolidated Runtime onboarding path:
// C1: the same minimal Agent or Tool program can be copied across a quickstart,
//     tutorial, and how-to, leaving several implementation authorities.
// C2: a Tool id, description, and schema can be repeated between the typed
//     implementation and a hand-written descriptor and drift independently.
// C3: an ephemeral RuntimeRunContext, model-visible Tool error, Awaiting state,
//     or bounded inference retry can be misclassified as an operator fault.
// C4: a real compile/configuration result can survive built-in handling and
//     require a source, registration, or application-assembly correction.
// E1: hello_agent and direct_runtime remain the sole executable first examples;
//     tutorial pages change or trace them without copying a second full program.
// E2: Tool::Args plus const ID/DESCRIPTION derive one descriptor through
//     ToolDescriptor::for_tool and one erasure adapter.
// E3: automatic or explicitly ephemeral behavior has no repair procedure.
// E4: externally actionable results name the exact owner to change.
// Decision table:
// | Rule | copied program | repeated schema/id | built-in behavior called fault | surfaced external correction | Outcome |
// | R1   | no             | no                 | no                            | exact                         | accept  |
// | R2   | yes            | any                | any                           | any                           | reject  |
// | R3   | no             | yes                | any                           | any                           | reject  |
// | R4   | no             | no                 | yes                           | any                           | reject  |
// | R5   | no             | no                 | no                            | vague or absent when needed   | reject  |
for (const locale of ['en', 'zh']) {
  const harness = join(docsRoot, `harness/current/${locale}`);
  const firstAgent = join(harness, 'tutorials/first-agent.md');
  const firstTool = join(harness, 'tutorials/first-tool.md');
  const buildAgent = join(harness, 'how-to/build-an-agent.md');
  const addTool = join(harness, 'how-to/add-a-tool.md');

  requireText(firstAgent, [
    [/hello_agent\.rs[\s\S]*cargo test -p awaken-runtime-examples --test hello_agent/, `${locale} first-Agent tutorial must reuse the checked hello_agent owner`],
    [/AgentConfig[\s\S]*compile_resolved[\s\S]*ExecutableAgentSnapshot[\s\S]*Runtime::run/, `${locale} first-Agent tutorial must preserve the publication sequence`],
  ]);
  rejectText(firstAgent, [
    [/impl Tool for|impl RawTool for/, `${locale} first-Agent tutorial must not duplicate Tool implementation`],
    [/^## (?:Common Errors|常见错误|故障排查)/m, `${locale} deterministic first-Agent path must not add a generic troubleshooting section`],
  ]);

  requireText(firstTool, [
    [/direct_runtime[\s\S]*cargo test -p awaken-runtime-examples --test direct_runtime/, `${locale} first-Tool tutorial must reuse the checked direct_runtime owner`],
    [/ToolCall[\s\S]*Permission(?:Gate| gate)[\s\S]*ToolExecutor[\s\S]*ToolOutput[\s\S]*[Ss]tep commit/, `${locale} first-Tool tutorial must preserve the one execution path`],
    [/model-visible error result|模型可见的错误结果/, `${locale} first-Tool tutorial must keep automatic Tool error delivery out of troubleshooting`],
  ]);
  rejectText(firstTool, [
    [/impl Tool for|impl RawTool for/, `${locale} first-Tool tutorial must not duplicate custom Tool implementation`],
    [/^## (?:Common Errors|常见错误|故障排查)/m, `${locale} first-Tool tutorial must not add generic troubleshooting`],
  ]);

  requireText(addTool, [
    [/const ID:[\s\S]*const DESCRIPTION:/, `${locale} custom Tool guide must use the current typed identity contract`],
    [/ToolDescriptor::for_tool::<WeatherTool>/, `${locale} custom Tool guide must derive the descriptor from the Tool contract`],
    [/erase[\s\S]*(?:sole adapter|唯一 adapter)/, `${locale} custom Tool guide must preserve one erasure owner`],
    [/model-visible error result|模型可见错误结果/, `${locale} custom Tool guide must explain built-in Tool error delivery`],
  ]);
  rejectText(addTool, [
    [/fn id\(&self\)/, `${locale} custom Tool guide must not use the retired typed Tool id method`],
    [/ToolDescriptor::pinned\([\s\S]*get_weather/, `${locale} custom Tool guide must not repeat the typed Tool schema by hand`],
    [/^## (?:Common Errors|常见错误|故障排查)/m, `${locale} custom Tool guide must not add generic troubleshooting`],
  ]);

  requireText(buildAgent, [
    [/RuntimeRunContext::new\(\)[\s\S]*(?:ephemeral run|ephemeral 选择)/, `${locale} application assembly must describe absent persistence as an explicit choice`],
    [/Awaiting[\s\S]*(?:not a failure|不是需要重启的故障)/, `${locale} application assembly must keep waiting out of troubleshooting`],
    [/Tool invocation[\s\S]*(?:model-visible results|模型可见)/, `${locale} application assembly must keep Tool errors on the loop path`],
  ]);
  rejectText(buildAgent, [
    [/impl Tool for|impl RawTool for/, `${locale} application assembly must delegate custom Tool implementation`],
    [/^## (?:Common Errors|常见错误|故障排查)/m, `${locale} application assembly must not add generic troubleshooting`],
  ]);
}

// Cause/effect design for execution choice, model selection, deployment config,
// first-Session correction, and executable-story evidence:
// C1: a condition can be transient and fully owned by claim recovery, candidate
//     failover, local migration, or another built-in convergence path.
// C2: a surfaced parse, validation, bind, dependency, or exact-capability result
//     can survive built-in handling and require a specific external correction.
// C3: documentation can describe a behavior that code cannot perform, such as
//     silently selecting another port after bind failure.
// C4: a page can copy the ACP catalog, protocol matrix, Sandbox procedure, or
//     field reference and create a second authority.
// C5: a structural recording test can pass without a backend, model, ACP CLI,
//     or successful product checkpoint.
// E1: automatic conditions are described as system behavior with no action.
// E2: corrective action appears only beside a surfaced result and names the
//     exact configuration, dependency, or capability to change.
// E3: impossible behavior is absent and the real terminal behavior is stated.
// E4: each page keeps one decision and delegates neighboring inventories.
// E5: recording contract evidence cannot be presented as a current video run.
// Decision table:
// | Rule | automatic | surfaced | external correction | code-reachable | one owner | live evidence | Outcome |
// | P1   | yes       | no       | none                | yes            | yes       | n/a           | accept  |
// | P2   | no        | yes      | exact               | yes            | yes       | n/a           | accept  |
// | P3   | yes       | any      | required            | any            | any       | any           | reject  |
// | P4   | no        | yes      | absent or vague     | any            | any       | any           | reject  |
// | P5   | any       | any      | any                 | no             | any       | any           | reject  |
// | P6   | any       | any      | any                 | yes            | no        | any           | reject  |
// | P7   | n/a       | n/a      | n/a                 | yes            | yes       | structural-only presented as live | reject |
for (const [docsRel, patterns] of [
  ['platform/current/en/concepts/execution-modes.md', [
    [/title: "Choose an execution backend and Sandbox boundary"/, 'execution concept must lead with the two independent choices'],
    [/^## Static structure$/m, 'execution concept must preserve the static owner view'],
    [/^## Dynamic behavior$/m, 'execution concept must preserve the dispatch-to-commit sequence'],
    [/^## What the system handles, and when to act$/m, 'execution concept must separate convergence from intervention'],
    [/Worker crashes or its lease expires[\s\S]*None unless/, 'execution concept must leave claim recovery with the system'],
    [/exact backend is not registered[\s\S]*Provide the required Worker capability/, 'execution concept must keep exact placement failure externally actionable'],
  ]],
  ['platform/current/zh/concepts/execution-modes.md', [
    [/title: "选择执行 backend 与 Sandbox 边界"/, 'Chinese execution concept must lead with the two independent choices'],
    [/^## 静态结构$/m, 'Chinese execution concept must preserve the static owner view'],
    [/^## 动态行为$/m, 'Chinese execution concept must preserve the dispatch-to-commit sequence'],
    [/^## 系统会处理什么，何时需要动作$/m, 'Chinese execution concept must separate convergence from intervention'],
    [/Worker crash 或 lease expiry[\s\S]*否则无需动作/, 'Chinese execution concept must leave claim recovery with the system'],
    [/精确 backend 未注册[\s\S]*提供所需 Worker capability/, 'Chinese execution concept must keep exact placement failure externally actionable'],
  ]],
  ['platform/current/en/how-to/select-models-and-acp-runtimes.md', [
    [/^## Choose a `model\.id`$/m, 'model guide must begin with the selector task'],
    [/^## Static ownership$/m, 'model guide must preserve the shared parser and resolver owners'],
    [/^## Dynamic validation and execution$/m, 'model guide must show validation before immutable storage'],
    [/^## Read the result$/m, 'model guide must route only surfaced selector results to correction'],
    [/Worker lease expires after dispatch[\s\S]*Do not change the selector/, 'model guide must leave lease recovery with the system'],
  ]],
  ['platform/current/zh/how-to/select-models-and-acp-runtimes.md', [
    [/^## 选择 `model\.id`$/m, 'Chinese model guide must begin with the selector task'],
    [/^## 静态所有权$/m, 'Chinese model guide must preserve the shared parser and resolver owners'],
    [/^## 动态校验与执行$/m, 'Chinese model guide must show validation before immutable storage'],
    [/^## 读取结果$/m, 'Chinese model guide must route only surfaced selector results to correction'],
    [/Worker lease expiry[\s\S]*不要修改 selector/, 'Chinese model guide must leave lease recovery with the system'],
  ]],
  ['platform/current/en/reference/configuration.md', [
    [/\| Add execution capacity \| `awaken-worker/, 'configuration reference must route readers to the strict Worker boundary'],
    [/^## Value resolution$/m, 'configuration reference must state precedence before fields'],
    [/^## Validate before startup$/m, 'configuration reference must show the validation sequence'],
    [/local profile needs embedded schema migration[\s\S]*None/, 'configuration reference must classify local migration as automatic'],
    [/listener address is already in use[\s\S]*no alternate port is selected/, 'configuration reference must state terminal bind behavior'],
  ]],
  ['platform/current/zh/reference/configuration.md', [
    [/\| 增加执行容量 \| `awaken-worker/, 'Chinese configuration reference must route readers to the strict Worker boundary'],
    [/^## 值解析$/m, 'Chinese configuration reference must state precedence before fields'],
    [/^## 启动前校验$/m, 'Chinese configuration reference must show the validation sequence'],
    [/本地 profile 需要 embedded schema migration[\s\S]*无/, 'Chinese configuration reference must classify local migration as automatic'],
    [/listener address 已被占用[\s\S]*不会自动选择其他端口/, 'Chinese configuration reference must state terminal bind behavior'],
  ]],
  ['platform/current/en/video-tour.md', [
    [/title: "See Awaken solve a real Agent job"/, 'story page must name the reader action honestly'],
    [/Some stories use a fixed Agent response/, 'story page must disclose controlled Agent responses'],
    [/source evidence[\s\S]*establishes the product mechanisms[\s\S]*not whether[\s\S]*MP4 passed/, 'story page must bound source evidence'],
    [/Recording commands[\s\S]*not published on this page/, 'story page must not advertise unpublished recording commands'],
    [/checkpoint fails[\s\S]*does not establish[\s\S]*claimed effect[\s\S]*publishes no current recording/, 'story page must preserve diagnostic failure meaning'],
    [/https:\/\/github\.com\/AwakenWorks\/awaken[\s\S]*star the repository/, 'story page must end with a source and GitHub Star action'],
  ]],
  ['platform/current/zh/video-tour.md', [
    [/title: "看 Awaken 完成一项真实的 Agent 工作"/, 'Chinese story page must name the reader action honestly'],
    [/部分故事采用固定的 Agent 响应/, 'Chinese story page must disclose controlled Agent responses'],
    [/源码证据[\s\S]*证明产品机制[\s\S]*不能证明某个 MP4 已通过/, 'Chinese story page must bound source evidence'],
    [/录制命令[\s\S]*不在本页公开/, 'Chinese story page must not advertise unpublished recording commands'],
    [/检查点失败[\s\S]*没有建立所声称的效果[\s\S]*不会发布[\s\S]*当前成片/, 'Chinese story page must preserve diagnostic failure meaning'],
    [/https:\/\/github\.com\/AwakenWorks\/awaken[\s\S]*Star 仓库/, 'Chinese story page must end with a source and GitHub Star action'],
  ]],
]) {
  requireText(join(docsRoot, docsRel), patterns);
}

for (const docsRel of [
  'platform/current/en/concepts/execution-modes.md',
  'platform/current/zh/concepts/execution-modes.md',
  'platform/current/en/reference/configuration.md',
  'platform/current/zh/reference/configuration.md',
]) {
  const text = readFileSync(join(docsRoot, docsRel), 'utf8');
  if (/^## (?:Troubleshooting|故障排查)$/m.test(text)) {
    failures.push(`${docsRel}: automatic or validation-owned behavior must not be presented as generic troubleshooting`);
  }
}

for (const docsRel of [
  'platform/current/en/how-to/select-models-and-acp-runtimes.md',
  'platform/current/zh/how-to/select-models-and-acp-runtimes.md',
]) {
  const text = readFileSync(join(docsRoot, docsRel), 'utf8');
  if (/\| Claude Code \| `acp:claude`/.test(text)) {
    failures.push(`${docsRel}: ACP runtime catalog must remain owned by the ACP protocol page`);
  }
}

for (const docsRel of [
  'platform/current/en/get-started.md',
  'platform/current/zh/get-started.md',
]) {
  const text = readFileSync(join(docsRoot, docsRel), 'utf8');
  if (/Use the port printed at startup if `8080` was not available|使用启动信息中打印的端口/.test(text)) {
    failures.push(`${docsRel}: bind failure cannot be described as automatic alternate-port selection`);
  }
}

requireText(join(root, 'src/styles/global.css'), [
  [/\.prose :not\(pre\) > code \{[\s\S]*overflow-wrap: anywhere;/, 'long inline code must wrap on narrow documentation pages without changing fenced code'],
]);

for (const [kind, index] of [
  ['title', titlesByScope],
  ['description', descriptionsByScope],
  ['section order', ordersBySection],
]) {
  for (const paths of index.values()) {
    if (paths.length > 1) failures.push(`${paths.join(', ')}: duplicate ${kind} in one product/locale journey`);
  }
}

// Cause/effect design for the one state model and its typed views:
// C1: persisted Commands remain the sole write/storage vocabulary.
// C2: StateCell/StateKey/FoldStateKey provide typed access over that vocabulary.
// C3: a present value can have a schema mismatch, while an absent value has a
//     valid default.
// E1: docs do not resurrect a typed-map registry or deny the current typed API.
// E2: readers use load/write/commit without creating a parallel store.
// E3: schema drift fails closed unless the caller explicitly chooses leniency.
// Decision rules: S1 requires the untyped and all typed choices together; S2
// requires load versus load_or_default; S3 rejects the former “StateKey does not
// exist” claim in the per-document audit above.
for (const locale of ['en', 'zh']) {
  requireText(join(docsRoot, `harness/current/${locale}/reference/state-keys.md`), [
    [/StateCell<T>[\s\S]*StateKey[\s\S]*FoldStateKey[\s\S]*Command/, `${locale} state reference must route every address and update shape to the one command model`],
    [/load[\s\S]*StateError[\s\S]*load_or_default[\s\S]*try_write/, `${locale} state reference must preserve fail-closed and explicit lenient typed access`],
    [/ThreadCommit::assemble[\s\S]*(?:stamps|写入)[\s\S]*run_id/, `${locale} state reference must preserve trusted Run-scope ownership stamping`],
  ]);
}

// Cause/effect design for state ownership and durable adapter guidance:
// C1: a later Run may need state from the same Thread.
// C2: another Thread may need the same business record or a delivered message.
// C3: a file root may be opened by one process or by competing processes.
// C4: PostgreSQL schema installation may happen at Runtime startup or in a
//     separate deployment phase, and startup hydration may exceed its bound.
// C5: an interrupted final file record may be incomplete, while a complete
//     newline-terminated record may be corrupt.
// E1: same-Thread state uses Scope::Thread and one committed-state reader.
// E2: cross-Thread records use an application Resource; messages use the Outbox.
// E3: the file adapter is documented as single-process and multi-Thread.
// E4: controlled PostgreSQL startup uses migrate plus connect_existing and
//     states the 1,000,000-fact fence.
// E5: torn tails recover automatically; complete corruption fails closed and is
//     the only file-recovery case that asks for external action.
// Decision table:
// | Rule | same Thread | cross Thread | one fs writer | separated DDL | corrupt complete | Outcome |
// | P1   | yes         | no           | yes           | either        | no               | Thread state |
// | P2   | no          | yes          | n/a           | n/a           | n/a              | Resource or Outbox |
// | P3   | either      | either       | no            | n/a           | n/a              | reject fs guidance |
// | P4   | either      | either       | n/a           | yes           | n/a              | verify then hydrate |
// | P5   | either      | either       | yes           | either        | yes              | fail closed and act |
for (const locale of ['en', 'zh']) {
  const harness = join(docsRoot, `harness/current/${locale}`);
  const reference = join(harness, 'reference/state-keys.md');
  const chooser = join(harness, 'state-and-storage.md');
  const file = join(harness, 'how-to/use-file-store.md');
  const postgres = join(harness, 'how-to/use-postgres-store.md');
  const shared = join(harness, 'how-to/use-shared-state.md');

  requireText(reference, [
    [/Scope::Shared[\s\S]*Scope::Profile[\s\S]*(?:do not make either[\s\S]*across Threads|不会让它们跨 Thread 可见)/, `${locale} state reference must keep Shared and Profile inside one Thread read boundary`],
    [/flowchart LR[\s\S]*sequenceDiagram/, `${locale} state reference must show static and dynamic behavior in Mermaid`],
  ]);
  requireText(chooser, [
    [/FsCommitCoordinator[\s\S]*PostgresCommitCoordinator[\s\S]*(?:application-owned store|应用持有的存储)[\s\S]*Outbox/, `${locale} storage chooser must route all four ownership decisions`],
    [/flowchart TB[\s\S]*sequenceDiagram/, `${locale} storage chooser must show static and dynamic behavior in Mermaid`],
  ]);
  requireText(file, [
    [/(?:Do not let two processes open the same store directory|不要\s*让两个进程打开同一个存储目录)/, `${locale} file guide must state the process ownership fence`],
    [/commits\.ndjson[\s\S]*(?:truncate the torn tail|截断不完整尾部)[\s\S]*(?:invalid-data error|无效数据错误)/, `${locale} file guide must distinguish automatic tail recovery from complete corruption`],
    [/flowchart LR[\s\S]*sequenceDiagram/, `${locale} file guide must show static and recovery behavior in Mermaid`],
  ]);
  requireText(postgres, [
    [/migrate[\s\S]*connect_existing[\s\S]*with_existing_pool/, `${locale} Postgres guide must preserve separated migration and startup paths`],
    [/1,000,000[\s\S]*(?:compact or export|压缩或导出)/, `${locale} Postgres guide must disclose the bounded hydration action`],
    [/flowchart LR[\s\S]*sequenceDiagram/, `${locale} Postgres guide must show deployment and commit behavior in Mermaid`],
  ]);
  requireText(shared, [
    [locale === 'en'
      ? /Do not use[\s\S]*Scope::Shared[\s\S]*Scope::Profile[\s\S]*between Threads/
      : /不要用[\s\S]*Scope::Shared[\s\S]*Scope::Profile[\s\S]*多个 Thread/, `${locale} shared-state guide must reject the unsupported cross-Thread interpretation`],
    [locale === 'en'
      ? /Scope::Thread[\s\S]*application-owned[\s\S]*Resource[\s\S]*Outbox/
      : /Scope::Thread[\s\S]*Resource[\s\S]*应用持有[\s\S]*Outbox/, `${locale} shared-state guide must route state, records, and messages to their owners`],
    [/sequenceDiagram[\s\S]*flowchart LR/, `${locale} shared-state guide must show same-Thread behavior and cross-Thread structure in Mermaid`],
  ]);

  for (const page of [reference, chooser, file, postgres, shared]) {
    rejectText(page, [
      [/```text/, `${locale} state and persistence relationships must use Mermaid`],
      [/^## (?:Troubleshooting|Common Errors|故障排查|常见错误)$/m, `${locale} state and persistence guides must not use generic troubleshooting`],
      [/(?:The cross-thread sharing case|State visible beyond a single thread|跨 thread 共享的场景|在单条 thread 之外可见的状态)/i, `${locale} docs must not present Shared as a cross-Thread storage authority`],
      [/(?:Under each thread's directory|Use a stable absolute path per thread|每个 Thread 的目录下|每条 Thread 使用稳定的绝对路径)/i, `${locale} file guide must not invent a per-Thread directory layout`],
      [/(?:Migrations are applied automatically on construction|迁移在构造时自动应用)[\s\S]{0,80}(?:no manual migration|无需手动迁移)/i, `${locale} Postgres guide must not erase the controlled migration path`],
    ]);
  }
}

// Cause/effect design for the four adjacent Harness architecture guides:
// C1: publication resolution can be joined to child-Run delegation even though
//     authoring and execution have different owners and lifetimes.
// C2: an Agent anatomy page can duplicate the detailed lifecycle, state,
//     Tool/Plugin, Skill, catalog, and delegation authorities.
// C3: capability discovery or health can be described as authorization, or a
//     typed Tool descriptor can be repeated through the low-level pinned API.
// C4: architecture rules can be described without the external maintainer's
//     executable check or with a role-led diagram instead of the enforced path.
// E1: resolution ends at an immutable publication and delegates orchestration.
// E2: anatomy routes each change to one owner and keeps only static and dynamic
//     orientation views.
// E3: only permission grants execution; typed identity and schema have one owner;
//     confirmation and Tool errors remain normal resumable/model-visible results.
// E4: metadata remains the dependency authority and one command checks it.
// Decision table:
// | Rule | resolution mixed | duplicated detail | discovery grants | check absent | Outcome |
// | J1   | no               | no                | no               | no           | accept  |
// | J2   | yes              | any               | any              | any          | reject  |
// | J3   | no               | yes               | any              | any          | reject  |
// | J4   | no               | no                | yes              | any          | reject  |
// | J5   | no               | no                | no               | yes          | reject  |
for (const locale of ['en', 'zh']) {
  const harness = join(docsRoot, `harness/current/${locale}/explanation`);
  const resolution = join(harness, 'agent-resolution.md');
  const anatomy = join(harness, 'anatomy-of-an-agent.md');
  const permissions = join(harness, 'capability-and-permissions.md');
  const invariants = join(harness, 'architecture-invariants.md');

  requireText(resolution, [
    [/AgentConfig[\s\S]*compile_published[\s\S]*ExecutableAgentSnapshot[\s\S]*RunActivation/, `${locale} Agent resolution must preserve the authored-to-pinned sequence`],
    [/(?:does not run inference[\s\S]*delegate|不执行 inference[\s\S]*不委托)/, `${locale} Agent resolution must state its execution boundary`],
    [/sequenceDiagram[\s\S]*(?:typed compile error|typed compile error)/, `${locale} Agent resolution must show pre-publication failure`],
  ]);
  rejectText(resolution, [
    [/RunDelegationService|DelegationStep::/, `${locale} Agent resolution must delegate child-Run execution to its owner`],
  ]);

  requireText(anatomy, [
    [/(?:Start from the change|从要改的内容开始)/, `${locale} Agent anatomy must route by the maintainer's change`],
    [/ExecutableAgentSnapshot[\s\S]*ThreadCommit[\s\S]*sequenceDiagram/, `${locale} Agent anatomy must preserve static and dynamic boundaries`],
    [/run-lifecycle-and-phases/, `${locale} Agent anatomy must delegate the detailed state machine`],
  ]);
  rejectText(anatomy, [
    [/\| Catalog \| What it holds \||\| Catalog \| 保存什么 \|/, `${locale} Agent anatomy must not duplicate the catalog inventory`],
    [/^## (?:How it fits together|它们如何组合)$/m, `${locale} Agent anatomy must not restate the full loop after its views`],
  ]);

  requireText(permissions, [
    [/ToolDescriptor::for_tool::<T>\(\)/, `${locale} capability guide must derive the typed Tool descriptor`],
    [/ToolPermissionVerdict::Allow[\s\S]*(?:executable gate outcome|可执行 gate outcome)/, `${locale} capability guide must preserve the sole grant path`],
    [/ToolCapabilityNarrowing[\s\S]*DenyAll/, `${locale} capability guide must preserve non-widening composition`],
    [/(?:need no generic troubleshooting section|不需要通用故障排查)/, `${locale} capability guide must keep automatic outcomes out of troubleshooting`],
  ]);
  rejectText(permissions, [
    [/ToolDescriptor::pinned/, `${locale} capability guide must not teach the low-level duplicate descriptor path`],
    [/(?:Picture authorization fused|设想授权与选择融在一起|with confidence|放心地启用)/, `${locale} capability guide must avoid attack-story or confidence rhetoric`],
  ]);

  requireText(invariants, [
    [/python3 scripts\/ci\/check_crate_boundaries\.py/, `${locale} architecture invariants must provide the external maintenance command`],
    [/(?:repository conformance[\s\S]*not production deployment|仓库符合规则[\s\S]*不代表[\s\S]*生产)/, `${locale} architecture invariants must bound the check evidence`],
  ]);
  rejectText(invariants, [
    [/participant D as Developer/, `${locale} architecture invariants must show the enforced path rather than a role taxonomy`],
  ]);
}

// Cause/effect design for the five Runtime decision and lifecycle guides:
// C1: the trade-off page can duplicate mechanism detail or omit the decision,
//     accepted cost, and authoritative owner for a change.
// C2: human input can use the retired optional-field ticket or resume result,
//     or can mix scheduling and service delivery into the park/resume owner.
// C3: multi-Agent guidance can begin with roles or merge child delegation,
//     independent Runs, and cross-Thread delivery into one state owner.
// C4: Plugin guidance can retain retired capability fields, imply that bounds
//     grant permission, or bypass the sole ResolvedExecutionEnv merge path.
// C5: lifecycle guidance can infer recovery from live output, omit the committed
//     frontier and Indeterminate decision, or render a state model as text art.
// E1: maintainers choose an existing boundary from a static and dynamic view.
// E2: hosts park one closed AwaitTarget and resume through a validated command.
// E3: the three collaboration lifetimes keep separate state and result owners.
// E4: current IdBound declarations resolve into one environment, while failed
//     live refresh retains the prior validated environment automatically.
// E5: Run, Step, and ToolBatch recovery starts from committed facts, and only an
//     Indeterminate external effect requires reconciliation.
// Decision table:
// | Rule | duplicate or stale owner | task decision present | static + dynamic | automatic handling preserved | Outcome |
// | J1   | no                       | yes                   | yes              | yes                          | accept  |
// | J2   | yes                      | any                   | any              | any                          | reject  |
// | J3   | no                       | no                    | any              | any                          | reject  |
// | J4   | no                       | yes                   | no               | any                          | reject  |
// | J5   | no                       | yes                   | yes              | no                           | reject  |
for (const locale of ['en', 'zh']) {
  const harness = join(docsRoot, `harness/current/${locale}/explanation`);
  const tradeoffs = join(harness, 'design-tradeoffs.md');
  const hitl = join(harness, 'human-in-the-loop.md');
  const multiAgent = join(harness, 'multi-agent-patterns.md');
  const plugins = join(harness, 'plugin-internals.md');
  const lifecycle = join(harness, 'run-lifecycle-and-phases.md');

  requireText(tradeoffs, [
    [locale === 'en'
      ? /Start with the change[\s\S]*Cost accepted by the design[\s\S]*Owning page/
      : /从要改的内容开始[\s\S]*接受的代价[\s\S]*所有者页面/, `${locale} trade-off guide must begin with a change, decision, cost, and owner`],
    [/flowchart TB[\s\S]*sequenceDiagram/, `${locale} trade-off guide must show static ownership and one dynamic Step`],
    [/(?:Do not add a parallel owner|不要增加平行 owner)/, `${locale} trade-off guide must prohibit duplicate mechanism ownership`],
  ]);
  rejectText(tradeoffs, [
    [/^## (?:State model|状态模型|Plugin API|插件 API|Run state machine)$/m, `${locale} trade-off guide must delegate mechanism detail to its owner`],
    [/```text/, `${locale} trade-off guide diagrams must use Mermaid`],
  ]);

  requireText(hitl, [
    [/AwaitTarget::ToolCall[\s\S]*AwaitTarget::RemoteInput[\s\S]*ResumeCommand::from_ticket/, `${locale} HITL guide must use the closed current ticket and command`],
    [locale === 'en'
      ? /sequenceDiagram[\s\S]*validate[\s\S]*else allow[\s\S]*else deny/i
      : /sequenceDiagram[\s\S]*校验[\s\S]*else allow[\s\S]*else deny/, `${locale} HITL guide must show validation before allow or deny effects`],
    [locale === 'en'
      ? /leaves the ticket intact[\s\S]*not awaiting/i
      : /不会改动 ticket[\s\S]*not\s+awaiting/i, `${locale} HITL guide must preserve stale and duplicate resume behavior`],
  ]);
  rejectText(hitl, [
    [/pub reason|pub call_id|pub pending_tool/, `${locale} HITL guide must not teach retired optional ticket fields`],
    [/^## (?:Troubleshooting|故障排查)$/m, `${locale} HITL guide must not turn validated or automatic outcomes into generic troubleshooting`],
    [/```text/, `${locale} HITL guide diagrams must use Mermaid`],
  ]);

  requireText(multiAgent, [
    [locale === 'en'
      ? /Choose the mechanism[\s\S]*RunDelegationService[\s\S]*separate ordinary Runs[\s\S]*send_message/
      : /选择机制[\s\S]*RunDelegationService[\s\S]*多个普通 Run[\s\S]*send_message/, `${locale} multi-Agent guide must distinguish all three collaboration lifetimes`],
    [/RunDelegations[\s\S]*ActiveToolBatch[\s\S]*PendingChildRunResults/, `${locale} multi-Agent guide must preserve separate durable state owners`],
    [/sequenceDiagram[\s\S]*DelegationId[\s\S]*flowchart LR/, `${locale} multi-Agent guide must show one delegated result and the parallel decision`],
  ]);
  rejectText(multiAgent, [
    [/^## (?:Agent roles|Agent 角色)$/m, `${locale} multi-Agent guide must begin from work lifetime rather than roles`],
    [/^## (?:Troubleshooting|故障排查)$/m, `${locale} multi-Agent guide must keep automatic retry and delivery out of generic troubleshooting`],
    [/```text/, `${locale} multi-Agent guide diagrams must use Mermaid`],
  ]);

  requireText(plugins, [
    [/CapabilityBound[\s\S]*IdBound[\s\S]*NamespacedExact[\s\S]*Exact\(\[\]\)/, `${locale} Plugin guide must preserve the current capability-bound model`],
    [/flowchart TB[\s\S]*ResolvedExecutionEnv[\s\S]*sequenceDiagram/, `${locale} Plugin guide must show the single static and dynamic resolution path`],
    [locale === 'en'
      ? /failed refresh keeps the prior validated environment/
      : /失败 refresh 保留上一个已校验 environment/, `${locale} Plugin guide must preserve automatic safe live-refresh fallback`],
  ]);
  rejectText(plugins, [
    [/tool_ids|tool_namespaces/, `${locale} Plugin guide must not teach retired capability fields`],
    [/(?:CapabilityBound grants permission|CapabilityBound 授予 permission)/, `${locale} Plugin guide must not treat declaration bounds as authorization`],
    [/^## (?:Troubleshooting|故障排查)$/m, `${locale} Plugin guide must keep safe refresh fallback out of generic troubleshooting`],
    [/```text/, `${locale} Plugin guide diagrams must use Mermaid`],
  ]);

  requireText(lifecycle, [
    [locale === 'en'
      ? /Start with the state you need[\s\S]*latest committed `RunState`/
      : /从要确认的 state 开始[\s\S]*最新 committed `RunState`/, `${locale} lifecycle guide must begin from committed observable state`],
    [/stateDiagram-v2[\s\S]*sequenceDiagram[\s\S]*stateDiagram-v2/, `${locale} lifecycle guide must show Run, Step, and Tool-call behavior in Mermaid`],
    [/(?:Recovery decision table|Recovery 决策表)[\s\S]*Requested[\s\S]*Executing[\s\S]*Awaiting[\s\S]*Ended/, `${locale} lifecycle guide must map every committed recovery frontier`],
    [locale === 'en'
      ? /When external reconciliation is required[\s\S]*Only `Indeterminate`[\s\S]*external effect/
      : /何时需要外部 reconciliation[\s\S]*只有 `Indeterminate`[\s\S]*external effect/, `${locale} lifecycle guide must reserve external repair for unclassified effects`],
  ]);
  rejectText(lifecycle, [
    [/```text/, `${locale} lifecycle state and sequence diagrams must use Mermaid`],
    [/^## (?:Troubleshooting|故障排查)$/m, `${locale} lifecycle guide must not turn automatic recovery into generic troubleshooting`],
  ]);
}

// Cause/effect design for the five extension and delegation tasks:
// C1: Plugin authoring can bypass the registrar or repeat resolution internals.
// C2: permission examples can use descriptor names that parse but never match,
//     or copy the separate ticket-resume protocol into policy configuration.
// C3: child delegation can copy a stale service trait or create another Agent
//     loop instead of using the Host-composed first-class child Run path.
// C4: a handoff page can imply an in-place Runtime contract that is not shipped,
//     or collapse bounded delegation and lasting responsibility into one owner.
// C5: a deferred Tool call can reuse a correlation id, read a retired ticket
//     field, or grow into a second messaging, cancellation, or workflow guide.
// E1: one bounded Plugin contribution is registered and selected for a Run.
// E2: exact lowercase Tool ids reach one runtime-wide permission gate, while the
//     separate HITL page remains the only park/resume procedure owner.
// E3: one typed `{ agent_id, input }` enters the installed delegation service and
//     returns one child result to its parent.
// E4: the current absence of in-place Handoff stays explicit; Host/Flow owns a
//     responsibility package that outlives a Run.
// E5: one committed scheduled call uses call identity and resumes the same Run.
// Decision table:
// | Rule | current seam | exact public input | one owner | Mermaid views | Outcome |
// | X1   | yes          | yes                | yes       | yes           | accept  |
// | X2   | no           | any                | any       | any           | reject  |
// | X3   | yes          | no                 | any       | any           | reject  |
// | X4   | yes          | yes                | no        | any           | reject  |
// | X5   | yes          | yes                | yes       | no            | reject  |
for (const locale of ['en', 'zh']) {
  const howTo = join(docsRoot, `harness/current/${locale}/how-to`);
  const plugin = join(howTo, 'add-a-plugin.md');
  const permission = join(howTo, 'enable-tool-permission-hitl.md');
  const delegation = join(howTo, 'invoke-sub-agent-from-tool.md');
  const handoff = join(howTo, 'use-agent-handoff.md');
  const scheduled = join(howTo, 'start-background-work-from-a-tool.md');

  requireText(plugin, [
    [locale === 'en'
      ? /Use a Plugin when[\s\S]*add a Tool/
      : /当一段行为必须进入 Agent 生命周期时[\s\S]*添加 Tool/, `${locale} Plugin task must begin with the extension choice`],
    [/declare_state_key[\s\S]*register_hook[\s\S]*with_plugin[\s\S]*\.plugins/, `${locale} Plugin task must use the registrar and separate install from activation`],
    [/flowchart LR[\s\S]*sequenceDiagram/, `${locale} Plugin task must show bounded static and dynamic paths`],
  ]);
  rejectText(plugin, [
    [/(?:state_keys|phase_hooks)\.push/, `${locale} Plugin task must not bypass the current Contributions registrar`],
    [/^## (?:Common Errors|Troubleshooting|常见错误|故障排查)$/m, `${locale} Plugin task must not duplicate resolution recovery guidance`],
  ]);

  requireText(permission, [
    [/default_behavior:\s*ToolPermissionBehavior::RequireConfirmation/, `${locale} permission task must start from the safe default`],
    [/rule\("read"[\s\S]*rule\("bash\(command[\s\S]*rule\("write\(file_path[\s\S]*rule\("edit\(file_path/, `${locale} permission task must use exact built-in ids and public fields`],
    [/PermissionGate[\s\S]*with_gate[\s\S]*flowchart LR[\s\S]*sequenceDiagram/, `${locale} permission task must install one gate and show observable outcomes`],
    [/human-in-the-loop/, `${locale} permission task must delegate ticket resume to the HITL owner`],
  ]);
  rejectText(permission, [
    [/(?:rule|Pattern)\("(?:Bash|Edit|Read|Write)/, `${locale} permission task must not teach nonmatching capitalized built-in ids`],
    [/ResumeCommand::from_ticket/, `${locale} permission task must not duplicate the HITL resume procedure`],
    [/^## (?:Common Errors|Troubleshooting|常见错误|故障排查)$/m, `${locale} permission task must not add a generic repair section`],
  ]);

  requireText(delegation, [
    [/"agent_id"[\s\S]*"input"[\s\S]*with_run_delegation/, `${locale} delegation task must preserve the typed model input and composition seam`],
    [/flowchart LR[\s\S]*ChildRunResultInbox[\s\S]*sequenceDiagram/, `${locale} delegation task must show the bounded child result path`],
    [locale === 'en'
      ? /parent receives the child's terminal text/
      : /父 Agent 以 `agent_run` Tool result 收到 child 的终态文本/, `${locale} delegation task must end in one parent-visible result`],
  ]);
  rejectText(delegation, [
    [/pub trait RunDelegationService/, `${locale} delegation task must not copy the evolving service trait`],
    [/Result<String,\s*DelegationExecutionError>/, `${locale} delegation task must not retain the stale string target identity`],
    [/^## (?:Failure boundaries|Troubleshooting|失败边界|故障排查)$/m, `${locale} delegation task must leave lifecycle failures with the explanation owner`],
  ]);

  requireText(handoff, [
    [locale === 'en'
      ? /does not define an in-place[\s\S]*Choose the mechanism/
      : /没有定义在一个 Run 内替换 active Agent[\s\S]*选择机制/, `${locale} handoff task must state the absent in-place contract before guidance`],
    [/agent_run[\s\S]*(?:Host|Flow)[\s\S]*(?:issue|Issue)[\s\S]*artifact[\s\S]*revision[\s\S]*(?:gaps|缺口)[\s\S]*(?:complete|完成)/, `${locale} handoff task must separate bounded work from a usable responsibility package`],
    [/flowchart LR[\s\S]*sequenceDiagram/, `${locale} handoff task must show static and dynamic ownership`],
  ]);
  rejectText(handoff, [
    [/^## (?:Agent roles|Troubleshooting|Agent 角色|故障排查)$/m, `${locale} handoff task must not use role taxonomy or generic troubleshooting`],
  ]);

  requireText(scheduled, [
    [/format!\("sched-\{\}", call\.call_id\)/, `${locale} scheduled task must derive correlation from the Tool call`],
    [/ticket\.reason\(\)[\s\S]*perform_scheduled_action/, `${locale} scheduled task must use the current committed-ticket API`],
    [/flowchart LR[\s\S]*sequenceDiagram/, `${locale} scheduled task must show the deferred static and dynamic paths`],
    [locale === 'en'
      ? /not a cron service or a[\s\S]*general workflow engine/
      : /不是 cron 服务，也不是通用工作流引擎/, `${locale} scheduled task must preserve its narrow product boundary`],
  ]);
  rejectText(scheduled, [
    [/ticket\.reason\s*[,=]/, `${locale} scheduled task must not read the retired public reason field`],
    [/"export-1"|cancel_task|send_message/, `${locale} scheduled task must not reuse a constant id or duplicate adjacent task owners`],
    [/^## (?:Common Errors|Troubleshooting|常见错误|故障排查)$/m, `${locale} scheduled task must not add a generic repair section`],
  ]);
}

// Cause/effect design for state, extension, Thread, and cancellation ownership:
// C1: fact authority can drift back to a mutable snapshot or live projection.
// C2: state guidance can invent a second store, broaden scope, or misstate merge.
// C3: Tool and Plugin pages can copy each other's APIs or retain retired fields.
// C4: Thread reference can represent Awaiting with contradictory optional facts.
// C5: cancellation can collapse live signaling, durable terminalization, and stop.
// C6: an automatic outcome can be rewritten as external troubleshooting, or a
//     relationship can regress to a text chart.
// E1: one ThreadCommit/fact/replay authority remains visible.
// E2: maintainers choose consumer, lifetime, writers, shape, scope, and policy.
// E3: the decision page delegates to one current Tool API owner.
// E4: RunDisposition and ResumeTicket make illegal lifecycle shapes impossible.
// E5: callers route cancellation from committed state and act only on NotActive.
// E6: static and dynamic relationships use Mermaid; automatic recovery stays
//     normal system behavior.
// Decision table:
// | Rule | fact owner | state choice | current Tool | closed Run | cancel route | Mermaid | Outcome |
// | S1   | yes        | yes          | yes          | yes        | yes          | yes     | accept  |
// | S2   | no         | any          | any          | any        | any          | any     | reject  |
// | S3   | yes        | no           | any          | any        | any          | any     | reject  |
// | S4   | yes        | yes          | no           | any        | any          | any     | reject  |
// | S5   | yes        | yes          | yes          | no         | any          | any     | reject  |
// | S6   | yes        | yes          | yes          | yes        | no           | any     | reject  |
// | S7   | yes        | yes          | yes          | yes        | yes          | no      | reject  |
for (const locale of ['en', 'zh']) {
  const harness = join(docsRoot, `harness/current/${locale}`);
  const truth = join(harness, 'explanation/state-and-snapshot-model.md');
  const state = join(harness, 'explanation/state-management.md');
  const boundary = join(harness, 'explanation/tool-and-plugin-boundary.md');
  const tool = join(harness, 'reference/tool-trait.md');
  const thread = join(harness, 'reference/thread-model.md');
  const cancellation = join(harness, 'reference/cancellation.md');

  requireText(truth, [
    [/ThreadCommit[\s\S]*CommitCoordinator[\s\S]*CommittedThreadView[\s\S]*CheckpointReader/, `${locale} truth model must preserve one write authority and its derived reads`],
    [/flowchart LR[\s\S]*sequenceDiagram/, `${locale} truth model must show static and dynamic behavior in Mermaid`],
    [locale === 'en'
      ? /Use this model when a value must still be correct after a process exits/
      : /当一个值在进程退出、Worker 被替换或 Run 恢复后仍须保持正确/, `${locale} truth model must begin with the user's durability decision`],
  ]);
  rejectText(truth, [
    [/^## (?:Troubleshooting|故障排查)$/m, `${locale} truth model must not turn replay into troubleshooting`],
    [/```text/, `${locale} truth model must not use text charts`],
  ]);

  requireText(state, [
    [locale === 'en'
      ? /Consumer:[\s\S]*Lifetime:[\s\S]*Writers:[\s\S]*Shape:/
      : /消费者：[\s\S]*生命周期：[\s\S]*写入者：[\s\S]*数据形状：/, `${locale} state guide must begin from the four key-design decisions`],
    [locale === 'en'
      ? /Scope[\s\S]*Run[\s\S]*Thread[\s\S]*Shared[\s\S]*Profile[\s\S]*Disjoint[\s\S]*Commutative[\s\S]*Exclusive/
      : /作用域[\s\S]*Run[\s\S]*Thread[\s\S]*Shared[\s\S]*Profile[\s\S]*Disjoint[\s\S]*Commutative[\s\S]*Exclusive/, `${locale} state guide must preserve every scope and merge policy`],
    [/StateKey[\s\S]*try_write[\s\S]*load_or_default[\s\S]*sequenceDiagram/, `${locale} state guide must show typed fail-closed flow`],
  ]);
  rejectText(state, [
    [/Two producers stage|两个生产者/, `${locale} state guide must not limit staging to the former two-producer claim`],
    [/^## (?:Troubleshooting|故障排查)$/m, `${locale} state guide must not make validation a repair procedure`],
    [/```text/, `${locale} state guide must not use text charts`],
  ]);

  requireText(boundary, [
    [locale === 'en'
      ? /Choose a \*\*Tool\*\*[\s\S]*Choose a\s+\*\*Plugin\*\*/
      : /选择 \*\*Tool\*\*[\s\S]*选择 \*\*Plugin\*\*/, `${locale} extension boundary must lead with the choice`],
    [/flowchart LR[\s\S]*CapabilityBound[\s\S]*sequenceDiagram[\s\S]*ToolExecutor/, `${locale} extension boundary must show bounded static and dynamic paths`],
    [locale === 'en'
      ? /Permission remains the sole grant/
      : /权限始终是唯一授予路径/, `${locale} extension boundary must keep permission as the sole grant`],
  ]);
  rejectText(boundary, [
    [/pub trait Tool|pub struct CapabilityBound|tool_namespaces/, `${locale} extension boundary must not duplicate current API owners or retired fields`],
    [/```text/, `${locale} extension boundary must not use text charts`],
  ]);

  requireText(tool, [
    [/const ID:[\s\S]*const DESCRIPTION:[\s\S]*JsonSchema/, `${locale} Tool reference must preserve the current typed authoring API`],
    [/pub struct ToolOutput[\s\S]*Vec<ContentBlock>[\s\S]*Vec<StateCommand>[\s\S]*UnavailableBeforeDispatch/, `${locale} Tool reference must preserve exact result and error boundaries`],
    [/current_tool_operation_token[\s\S]*NonRecoverable[\s\S]*ReplaySafe[\s\S]*Idempotent[\s\S]*DurableRequest/, `${locale} Tool reference must preserve durable effect and recovery semantics`],
  ]);
  rejectText(tool, [
    [/fn id\(&self\) -> &str;[\s\S]*async fn call/, `${locale} Tool reference must not teach the retired typed Tool id method`],
    [/```text/, `${locale} Tool reference must not use text charts`],
  ]);

  requireText(thread, [
    [/pub enum RunDisposition[\s\S]*Running[\s\S]*Awaiting\(Box<ResumeTicket>\)[\s\S]*Ended/, `${locale} Thread reference must preserve the closed commit disposition`],
    [/pub trait CommittedThreadView[\s\S]*fn run\([\s\S]*fn latest_run\([\s\S]*pub trait CheckpointReader: CommittedThreadView/, `${locale} Thread reference must preserve the one committed-read hierarchy`],
    [/flowchart TB[\s\S]*sequenceDiagram/, `${locale} Thread reference must show aggregate and commit behavior in Mermaid`],
  ]);
  rejectText(thread, [
    [/pub reason|pub call_id|pub pending_tool/, `${locale} Thread reference must not teach retired optional ResumeTicket fields`],
    [/```text/, `${locale} Thread reference must not use text charts`],
  ]);

  requireText(cancellation, [
    [/LiveCommand::Cancel[\s\S]*Runtime::cancel_run[\s\S]*Runtime::stop_run/, `${locale} cancellation reference must distinguish all three terminal control paths`],
    [/flowchart LR[\s\S]*sequenceDiagram[\s\S]*Error::NotActive/, `${locale} cancellation reference must show control behavior and the actionable rejection`],
    [locale === 'en'
      ? /automatically handles cancellation already observed[\s\S]*require no separate repair procedure/
      : /都由运行时[\s\S]*自动处理，不需要另写修复步骤/, `${locale} cancellation reference must keep automatic outcomes out of troubleshooting`],
  ]);
  rejectText(cancellation, [
    [/^## (?:Troubleshooting|故障排查)$/m, `${locale} cancellation reference must not add generic troubleshooting`],
    [/```text/, `${locale} cancellation reference must not use text charts`],
  ]);
}

// Cause/effect design for operating, recovery, termination, and test guidance:
// C1: an operating entry can duplicate its task pages instead of routing by the
//     change and committed evidence a maintainer needs.
// C2: streaming guidance can retain the retired best-effort trait signature,
//     omit R4, or confuse an unfinished checkpoint with Thread authority.
// C3: observability configuration can imply that accepted protocol, header, and
//     timeout fields are applied by the current HTTP/protobuf exporter.
// C4: termination can treat Indeterminate as non-terminal or move exhaustive
//     source-test conditions into a public configuration task.
// C5: a testing guide can copy Tool/Plugin/state/event APIs and drift from their
//     canonical owners instead of teaching boundary choice and test design.
// C6: relationship and state views can regress to text charts, or automatic
//     recovery can return as generic troubleshooting.
// E1: operate remains a task router with one ownership view and one change loop.
// E2: recovery presents Result errors, R1-R4, one unfinished-turn checkpoint,
//     one committed Thread authority, and one user-observable restart check.
// E3: observability states the current exporter boundary and confirms signals
//     from their sinks without promising ignored configuration.
// E4: termination selects one owner, commits one EndCause, and reserves external
//     action for terminal Indeterminate reconciliation.
// E5: testing alone owns causes, effects, decision rules, and exhaustive paths;
//     API details stay with their reference pages.
// E6: every relationship view is Mermaid and built-in outcomes remain normal.
// Decision table:
// | Rule | task router | current recovery | exact export | terminal stop | test owner | Mermaid | Outcome |
// | O1   | yes         | yes              | yes          | yes           | yes        | yes     | accept  |
// | O2   | no          | any              | any          | any           | any        | any     | reject  |
// | O3   | yes         | no               | any          | any           | any        | any     | reject  |
// | O4   | yes         | yes              | no           | any           | any        | any     | reject  |
// | O5   | yes         | yes              | yes          | no            | any        | any     | reject  |
// | O6   | yes         | yes              | yes          | yes           | no         | any     | reject  |
// | O7   | yes         | yes              | yes          | yes           | yes        | no      | reject  |
for (const locale of ['en', 'zh']) {
  const harness = join(docsRoot, `harness/current/${locale}`);
  const operate = join(harness, 'operate.md');
  const streaming = join(harness, 'how-to/recover-streaming-llms.md');
  const observability = join(harness, 'how-to/enable-observability.md');
  const stop = join(harness, 'how-to/configure-stop-policies.md');
  const testing = join(harness, 'how-to/testing-strategy.md');

  requireText(operate, [
    [locale === 'en'
      ? /Start with the change you need to make[\s\S]*Run lifecycle[\s\S]*Recover streaming LLMs[\s\S]*Enable observability[\s\S]*Testing strategy/
      : /先确定要改变什么[\s\S]*Run 生命周期[\s\S]*恢复流式 LLM[\s\S]*启用可观测性[\s\S]*测试策略/, `${locale} operate must route from the maintainer's task`],
    [/flowchart LR[\s\S]*Committed facts[\s\S]*sequenceDiagram|flowchart LR[\s\S]*已提交事实[\s\S]*sequenceDiagram/, `${locale} operate must show ownership and one change loop in Mermaid`],
  ]);
  rejectText(operate, [
    [/```text/, `${locale} operate must not use text charts`],
    [/^## (?:Troubleshooting|故障排查)$/m, `${locale} operate must not add generic troubleshooting`],
  ]);

  requireText(streaming, [
    [/StreamCheckpointStore[\s\S]*Result<_, StreamCheckpointError>[\s\S]*retry_count/, `${locale} streaming recovery must preserve the explicit current store contract`],
    [/R1[\s\S]*R2[\s\S]*R3[\s\S]*R4/, `${locale} streaming recovery must preserve all four engine outcomes`],
    [locale === 'en'
      ? /Thread commit remains the authority[\s\S]*one complete assistant turn/
      : /Thread commit 始终是[\s\S]*权威[\s\S]*一个完整 assistant 轮次/, `${locale} streaming recovery must separate authority from the restart acceptance result`],
    [/flowchart LR[\s\S]*sequenceDiagram/, `${locale} streaming recovery must show static and dynamic behavior in Mermaid`],
  ]);
  rejectText(streaming, [
    [/async fn get\([^)]*\) -> Option<StreamCheckpoint>|Three recovery strategies|三种恢复策略/, `${locale} streaming recovery must not retain the retired best-effort R1-R3 contract`],
    [/^## (?:Troubleshooting|故障排查)$/m, `${locale} streaming recovery must not turn automatic retry into generic troubleshooting`],
    [/```text/, `${locale} streaming recovery must not use text charts`],
  ]);

  requireText(observability, [
    [/ObservabilityConfig[\s\S]*OtelMetricsRecorder[\s\S]*Prometheus[\s\S]*OTLP/, `${locale} observability must preserve logs, traces, and metrics`],
    [/init\(&config\)[\s\S]*http\/protobuf[\s\S]*(?:exporter builders do not apply|exporter builder 并未应用)/, `${locale} observability must disclose the current typed exporter boundary`],
    [/flowchart LR[\s\S]*sequenceDiagram/, `${locale} observability must show signal ownership and propagation in Mermaid`],
  ]);
  rejectText(observability, [
    [/role's admin|角色的 admin/, `${locale} observability must address the external maintainer without role taxonomy`],
    [/^## (?:Troubleshooting|故障排查)$/m, `${locale} observability must not add generic troubleshooting`],
    [/```text/, `${locale} observability must not use text charts`],
  ]);

  requireText(stop, [
    [/max_steps[\s\S]*with_infer_retries[\s\S]*CancellationToken[\s\S]*Runtime::stop_run[\s\S]*RunEndGuard/, `${locale} termination must preserve every distinct control owner`],
    [locale === 'en'
      ? /Indeterminate[\s\S]*terminal[\s\S]*no later Run fact is promised[\s\S]*reconcile/
      : /Indeterminate[\s\S]*终态[\s\S]*不承诺稍后自动出现另一个 Run[\s\S]*对账/, `${locale} termination must require reconciliation without promising a later fact`],
    [/flowchart LR[\s\S]*stateDiagram-v2/, `${locale} termination must show static ownership and lifecycle behavior in Mermaid`],
  ]);
  rejectText(stop, [
    [/Verify every exit|Exhaustive exit-path coverage|验证每个出口|所有出口的穷尽覆盖|\| Cause \| Test condition|\| 原因 \| 测试条件/, `${locale} termination must not publish internal all-exit test language`],
    [/^## (?:Troubleshooting|故障排查)$/m, `${locale} termination must not add generic troubleshooting`],
    [/```text/, `${locale} termination must not use text charts`],
  ]);

  requireText(testing, [
    [locale === 'en'
      ? /Begin with one behavior claim[\s\S]*causes and effects[\s\S]*Decision-table rules/
      : /从一条行为结论开始[\s\S]*原因和结果[\s\S]*决策表规则/, `${locale} testing must lead from claim to cause-effect rules`],
    [/R1[\s\S]*R2[\s\S]*R3[\s\S]*R4[\s\S]*R5/, `${locale} testing must preserve the example Runtime decision rules`],
    [/LlmExecutor[\s\S]*conformance[\s\S]*E2E[\s\S]*Kani[\s\S]*evaluation/, `${locale} testing must distinguish all evidence boundaries`],
    [/Add a Tool|添加 Tool/, `${locale} testing must delegate current extension APIs to their owners`],
    [/flowchart LR[\s\S]*sequenceDiagram/, `${locale} testing must show derivation and execution in Mermaid`],
  ]);
  rejectText(testing, [
    [/impl Tool for GreetTool|impl Plugin for CounterPlugin/, `${locale} testing must not copy Tool or Plugin reference implementations`],
    [/fn id\(&self\) -> &str \{ "greet" \}/, `${locale} testing must not teach the retired typed Tool id method`],
    [/^## (?:Troubleshooting|故障排查)$/m, `${locale} testing must not add generic troubleshooting`],
    [/```text/, `${locale} testing must not use text charts`],
  ]);
}

// Cause/effect design for the remaining Harness contract clusters:
// C1: dependency direction is metadata-derived, while deny.toml is hygiene only.
// C2: committed reads have one CommittedThreadView/CheckpointReader hierarchy.
// C3: compaction has token/message triggers and one Agent-backed backend path.
// C4: observability uses explicit typed policy and provides both traces and metrics.
// C5: ToolError and plugin composition expose the current closed variants.
// E1: architecture prose cannot resurrect a second boundary authority.
// E2: storage adapters implement the current read contracts.
// E3: operators do not copy a removed summarizer/config API.
// E4: deployments do not depend on library-owned environment parsing or omit metrics.
// E5: callers can handle the current retry and duplicate-plugin classifications.
// Decision table: H1=C1+C2 -> structure pages accepted; H2=C3 -> compaction page
// accepted; H3=C4 -> observability page accepted; H4=C5 -> reference pages
// accepted. Any absent cause rejects its owning bilingual page. Source parity
// below supplies the corresponding implementation-side evidence.
for (const locale of ['en', 'zh']) {
  const harness = join(docsRoot, `harness/current/${locale}`);
  requireText(join(harness, 'explanation/architecture-invariants.md'), [
    [/package\.metadata\.awaken\.\{context,layer,authority\}/, `${locale} architecture invariants must name the metadata authority`],
    [/shared[\s\S]*protocol[\s\S]*runtime[\s\S]*control[\s\S]*coordinator[\s\S]*resources[\s\S]*worker[\s\S]*apps[\s\S]*devtools/, `${locale} architecture invariants must preserve all current contexts`],
    [/(?:not `deny\.toml`[\s\S]{0,80}source of\s+truth|不是 `deny\.toml`[\s\S]{0,40}真相来源)/, `${locale} architecture invariants must not assign dependency direction to deny.toml`],
  ]);
  requireText(join(harness, 'reference/thread-model.md'), [
    [/pub trait CommittedThreadView[\s\S]*fn run\([\s\S]*fn latest_run\([\s\S]*pub trait CheckpointReader: CommittedThreadView/, `${locale} thread model must preserve the one committed-read hierarchy`],
    [/pub enum EventScope[\s\S]*All[\s\S]*Thread[\s\S]*Run/, `${locale} thread model must preserve every event scope`],
  ]);
  requireText(join(harness, 'how-to/optimize-context-window.md'), [
    [/CompactConfig[\s\S]*agent_id[\s\S]*threshold[\s\S]*keep_last[\s\S]*max_tokens[\s\S]*trigger_ratio[\s\S]*prefetch_ratio[\s\S]*instructions/, `${locale} compaction guide must preserve the current policy fields`],
    [/CompactBackend[\s\S]*ContextMessages[\s\S]*ContextWindow/, `${locale} compaction guide must preserve backend and request-only state ownership`],
  ]);
  requireText(join(harness, 'how-to/enable-observability.md'), [
    [/ObservabilityConfig[\s\S]*OtelMetricsRecorder[\s\S]*Prometheus[\s\S]*OTLP/, `${locale} observability guide must preserve logs, traces, and metrics`],
    [/init\(&config\)/, `${locale} observability guide must show explicit typed initialization`],
  ]);
  requireText(join(harness, 'reference/errors.md'), [
    [/pub enum ToolError[\s\S]*Unknown[\s\S]*InvalidArguments[\s\S]*UnavailableBeforeDispatch[\s\S]*Execution/, `${locale} errors reference must preserve all ToolError variants`],
    [/pub enum MergeError[\s\S]*DuplicatePlugin/, `${locale} errors reference must preserve duplicate-plugin failure`],
  ]);
  requireText(join(harness, 'how-to/use-skills-subsystem.md'), [
    [/FixedSkillRegistry::from_specs/, `${locale} skills guide must use the current immutable registry`],
  ]);
}

// Cause-effect design for Managed compatibility, route ownership, and ACP runtime
// selection:
// C1: Managed beta families have distinct header rules, including exclusive
//     Memory, standalone Dreams, and an unenforced Files beta.
// C2: a second HTTP route map or protocol page can duplicate the compatibility
//     matrix and drift from the canonical public API index.
// C3: official, constrained, unsupported, and Awaken-extension surfaces can be
//     collapsed into one overbroad compatibility claim.
// C4: the ACP catalog can omit a runtime or flatten model selection, credential
//     delivery, persistence, and Sandbox placement into one capability flag.
// C5: API guidance can invent a second ACP selector or document a field rejected
//     by the official Managed model DTO.
// C6: a Native-only discovery projection can be presented as a complete ACP
//     authoring directory.
// C7: ingress protocols can be flattened into execution backends, or their
//     catalog can be copied into another detailed compatibility owner.
// C8: a source revision can advance the official SDK baseline, GA resource
//     roots, or family beta vocabulary while public setup remains on the prior
//     client contract.
// E1: clients send accepted headers and can predict explicit rejection.
// E2: one compatibility owner and one route-family owner remain authoritative.
// E3: migrations can distinguish wire parity, known divergence, and extensions.
// E4: operators select only an exact registered ACP backend and separately choose
//     its model route, credential mode, session-home behavior, and isolation tier.
// E5: Agent create/update and Session override reuse the canonical model.id
//     selector, publication resolver, and immutable execution snapshot.
// E6: readers know which discovery endpoints are compatibility projections and
//     where ACP capability is validated instead.
// E7: the product entry and model-selection guide keep ingress independent from
//     execution and delegate catalogs to the protocol and ACP runtime matrices.
// E8: quickstart and compatibility identify the SDK versions used for validation
//     without prescribing a customer dependency, while retaining current family
//     selectors and the method-level evidence boundary from the same source pin.
// Constraints: compatibility.md owns Managed claims; reference/api.md owns public
// route families; protocol pages link to those owners; known_acp_clis() owns the
// five built-in rows. Decision rules R1-R7 below exercise both locales and then
// prove the same constants/routes still exist in source. These prose checks are
// the smallest systematic tests because the changed behavior is public contract
// classification, while runtime edge cases remain covered by source tests.
for (const locale of ['en', 'zh']) {
  const platform = join(docsRoot, 'platform/current', locale);
  const compatibility = join(platform, 'compatibility.md');
  requireText(compatibility, [
    [/managed-agents-2026-04-01/, `${locale} compatibility must name the Managed beta`],
    [/@anthropic-ai\/sdk` 0\.122\.0/, `${locale} compatibility must name the reviewed TypeScript SDK validation version`],
    [/Python `anthropic` 1\.2\.0/, `${locale} compatibility must name the reviewed Python SDK validation version`],
    [/127 (?:current SDK methods|\u4e2a\u65b9\u6cd5)/, `${locale} compatibility must state the source-backed current method inventory`],
    [/3,827[\s\S]*(?:response witnesses|\u54cd\u5e94 witness)/, `${locale} compatibility must state the declaration-derived Python response evidence`],
    [/user-profiles-2026-08-18[\s\S]*user-profiles-2026-03-24/, `${locale} compatibility must preserve the current and legacy User Profiles beta transition`],
    [/GA[\s\S]*Files[\s\S]*Skills[\s\S]*Models/, `${locale} compatibility must disclose the current SDK GA resource roots`],
    [/agent-memory-2026-07-22[\s\S]*managed-agents-2026-04-01[\s\S]*(?:exactly one|只发送一个|两者同时发送会被拒绝)/i, `${locale} compatibility must preserve current-or-legacy exclusive Memory beta behavior`],
    [/dreaming-2026-04-21[\s\S]*(?:Managed beta is not required|不要求 Managed beta)/i, `${locale} compatibility must preserve standalone Dreams beta behavior`],
    [/Files[\s\S]*beta=true[\s\S]*(?:omit|不再发送)[\s\S]*files-api-2025-04-14/i, `${locale} compatibility must disclose the current query-only Files projection transition`],
    [/Skills[\s\S]*beta=true[\s\S]*(?:omit|不再发送)[\s\S]*skills-2025-10-02/i, `${locale} compatibility must disclose the current query-only Skills projection transition`],
    [/skills-2025-10-02[\s\S]*GET \/v1\/skills\/\{id\}\/versions\/\{version\}\/files\/\{path\}/, `${locale} compatibility must retain the SDK-absent Skill file-route beta boundary`],
    [/vault_ids[\s\S]*(?:update|更新)[\s\S]*(?:Rejected|拒绝|400)/i, `${locale} compatibility must disclose Session update vault_ids behavior`],
    [/\/v1\/agents\/\{id\}\/disable[\s\S]*sandbox_stdio[\s\S]*x_awaken[\s\S]*logical_path/, `${locale} compatibility must enumerate inline and adjacent Awaken extensions`],
    [/ModelConfig\.id[\s\S]*executor=acp:<id>/, `${locale} compatibility must point ACP selection at the canonical Managed model id`],
    [/Claude Code[\s\S]*Codex[\s\S]*Gemini[\s\S]*OpenCode[\s\S]*Hermes/, `${locale} compatibility must expose every built-in ACP runtime`],
  ]);
  rejectText(compatibility, [
    [/ModelConfig\.x_awaken\.acp/, `${locale} compatibility documents an unsupported ACP field`],
    [/@anthropic-ai\/sdk` 0\.120\.0/, `${locale} compatibility retains the prior SDK as the reviewed baseline`],
  ]);
  requireText(join(platform, 'protocols/managed-agents.md'), [
    [/compatibility\//, `${locale} Managed protocol page must delegate detail to compatibility`],
    [/wire adapter|wire adapter/, `${locale} Managed protocol page must preserve adapter ownership`],
  ]);
  rejectText(join(platform, 'protocols/managed-agents.md'), [
    [/server does not currently gate|服务器目前并不据此进行门控/, `${locale} Managed protocol page retains the stale unenforced-beta claim`],
  ]);

  const api = join(platform, 'reference/api.md');
  requireText(api, [
    [/single application route-family index|唯一索引/, `${locale} API page must own the application route-family index`],
    [/\/v1\/durable\/threads\/\{thread\}[\s\S]*\/pause[\s\S]*\/resume[\s\S]*quarantine-retry-exhausted[\s\S]*dead-letters[\s\S]*requeue[\s\S]*purge/, `${locale} API page must preserve every durable-control family`],
    [/\/v1\/config\/webhook-subscriptions/, `${locale} API page must name the Awaken webhook extension`],
  ]);
  requireText(api, locale === 'en' ? [
    [/max_attempts=<positive integer>[\s\S]*omitted or invalid[\s\S]*`0`[\s\S]*\{"quarantined": n\}[\s\S]*`409`[\s\S]*every[\s\S]*dead-lettered dispatch/, 'English API page must preserve safe quarantine parameters and outcomes'],
  ] : [
    [/max_attempts=<正整数>[\s\S]*缺失或无法解析[\s\S]*`0`[\s\S]*\{"quarantined": n\}[\s\S]*`409`[\s\S]*全部 dead-lettered dispatch/, 'Chinese API page must preserve safe quarantine parameters and outcomes'],
  ]);
  rejectText(api, [
    [/POST\s+\/reap/, `${locale} API page retains the nonexistent durable reap route`],
    [/(?:exhausted work reaches dead letters|耗尽的工作进入 dead letters)/, `${locale} API page mistakes explicit quarantine for automatic retry exhaustion`],
  ]);

  // Webhook connection cause/effect graph:
  // C1: a reader can mistake outbound lifecycle notifications for an inbound
  //     Agent protocol or the Session SSE stream.
  // C2: the compatible delivery wire and Awaken authoring route have different
  //     owners, so copying Anthropic CRUD helpers would document an absent API.
  // C3: create returns a secret once; later reads and updates are secret-free.
  // C4: retries can duplicate or reorder events, and a non-2xx acknowledgement
  //     can degrade or disable a subscription.
  // E1: direction and use case select Webhooks only for Awaken -> backend.
  // E2: the page names the Awaken config extension and delegates the wire catalog.
  // E3: the receiver stores the secret before leaving and verifies raw bytes.
  // E4: receiver acceptance includes dedupe, resource fetch, 2xx, and observable
  //     active/degraded/paused/failure states.
  const webhookGuide = join(platform, 'how-to/manage-webhooks.md');
  requireText(webhookGuide, locale === 'en' ? [
    [/title: "Send signed lifecycle events to your backend"/, 'English Webhook guide must name the outbound job'],
    [/outbound notification path[\s\S]*Session event\s+stream[\s\S]*without polling/, 'English Webhook guide must separate outbound notifications from live Agent output'],
    [/not an\s+Anthropic Webhook CRUD route[\s\S]*\/v1\/config\/webhook-subscriptions/, 'English Webhook guide must identify the Awaken authoring extension'],
    [/one-time banner[\s\S]*ANTHROPIC_WEBHOOK_SIGNING_KEY[\s\S]*cannot show[\s\S]*does not\s+return it/, 'English Webhook guide must preserve one-time secret custody'],
    [/webhook-id[\s\S]*webhook-timestamp[\s\S]*webhook-signature[\s\S]*deduplicate[\s\S]*fetch[\s\S]*2xx/, 'English Webhook guide must close receiver acceptance'],
    [/Active[\s\S]*Delivery retrying[\s\S]*Paused[\s\S]*Disabled after failures/, 'English Webhook guide must distinguish authored and delivery state'],
  ] : [
    [/title: "向你的后端发送签名生命周期事件"/, 'Chinese Webhook guide must name the outbound job'],
    [/向外发送通知[\s\S]*Session[\s\S]*事件流[\s\S]*不轮询/, 'Chinese Webhook guide must separate outbound notifications from live Agent output'],
    [/不是 Anthropic Webhook CRUD[\s\S]*\/v1\/config\/webhook-subscriptions/, 'Chinese Webhook guide must identify the Awaken authoring extension'],
    [/复制一次性提示[\s\S]*ANTHROPIC_WEBHOOK_SIGNING_KEY[\s\S]*无法再次返回[\s\S]*不会再次返回密钥/, 'Chinese Webhook guide must preserve one-time secret custody'],
    [/webhook-id[\s\S]*webhook-timestamp[\s\S]*webhook-signature[\s\S]*去重[\s\S]*读取[\s\S]*2xx/, 'Chinese Webhook guide must close receiver acceptance'],
    [/正常[\s\S]*投递重试中[\s\S]*已暂停[\s\S]*失败后已停用/, 'Chinese Webhook guide must distinguish authored and delivery state'],
  ]);
  rejectText(webhookGuide, [
    [/\bbeta\.webhooks\b/, `${locale} Webhook guide must not claim an unverified SDK helper`],
    [/\/v1\/webhook_endpoints/, `${locale} Webhook guide must not invent Anthropic Webhook CRUD`],
    [/(?:events emitted while|停用期间产生的事件)[\s\S]*(?:backfilled|补发)[^.。]*(?:are|会)(?! not|不会)/i, `${locale} Webhook guide must not promise backfill`],
  ]);
  const connectMatrix = join(platform, 'protocols/connect.md');
  requireText(connectMatrix, [
    [/Webhooks[\s\S]*Awaken Agents →[\s\S]*\/v1\/config\/webhook-subscriptions[\s\S]*manage-webhooks/, `${locale} connection matrix must route outbound Webhooks to their guide`],
  ]);
  if (existsSync(join(platform, 'reference/http-api.md'))) {
    failures.push(`${locale} reference/http-api.md: duplicate route-map owner must stay removed`);
  }

  const acp = join(platform, 'protocols/acp.md');
  requireText(acp, [
    [/AttemptExecutorRegistry[\s\S]*AcpRunExecutor[\s\S]*AgentChannelSource/, `${locale} ACP page must name the current execution owners`],
    [/acp:claude[\s\S]*acp:codex[\s\S]*acp:gemini[\s\S]*acp:opencode[\s\S]*acp:hermes/, `${locale} ACP matrix must contain all five exact backend refs`],
    [/@agentclientprotocol\/claude-agent-acp@0\.69\.0[\s\S]*@agentclientprotocol\/codex-acp@1\.1\.9[\s\S]*0\.53\.1[\s\S]*1\.18\.12[\s\S]*0\.19\.0/, `${locale} ACP matrix must preserve pinned runtime requirements`],
    [/Claude Code[\s\S]*projects[\s\S]*Codex[\s\S]*(?:None|无)[\s\S]*Gemini[\s\S]*tmp[\s\S]*OpenCode[\s\S]*storage[\s\S]*Hermes[\s\S]*(?:None|无)/, `${locale} ACP matrix must preserve per-runtime session persistence`],
    [/(?:separate axes|independent choices|两个维度|独立维度|两个独立选择)[\s\S]*local[\s\S]*namespace[\s\S]*docker[\s\S]*podman[\s\S]*k8s/i, `${locale} ACP page must separate runtime selection from Sandbox placement`],
    [/ModelSwitch::Relaunch/, `${locale} ACP page must disclose per-turn relaunch model switching`],
  ]);
  rejectText(acp, [
    [/DispatchRunExecutor|AcpBridge::run_turn|RunEventSink/, `${locale} ACP page names retired implementation owners`],
    [/Claude Code (?:and|与) Codex[\s\S]{0,80}(?:portable|可移植)/, `${locale} ACP page assigns portable local session state to Codex`],
  ]);

  const modelSelection = join(platform, 'how-to/select-models-and-acp-runtimes.md');
  requireText(modelSelection, [
    [/model\.id[\s\S]*provider=<provider>[\s\S]*api=<dialect>[\s\S]*endpoint=<endpoint>[\s\S]*executor=acp:<runtime>/, `${locale} model-selection guide must document the canonical selector grammar`],
    [/\/v1\/agents[\s\S]*agent_with_overrides[\s\S]*\/v1\/config\/agents\/\*/, `${locale} model-selection guide must cover Agent, Session override, and configuration API entry points`],
    [/ExecutableAgentSnapshot[\s\S]*AttemptExecutorRegistry/, `${locale} model-selection guide must show the static publication-to-runtime boundary`],
    [/sequenceDiagram[\s\S]*Publication resolver[\s\S]*(?:immutable snapshot|不可变 snapshot)/, `${locale} model-selection guide must show dynamic resolution and failure behavior`],
    [/\/v1\/config\/executable-models[\s\S]*(?:for Native readiness|用于查看 Native readiness)/, `${locale} model-selection guide must disclose the current discovery boundary`],
    [/(?:Model vendor[\s\S]{0,120}hosting responsibility are[\s\S]{0,80}separate|模型供应商[\s\S]{0,120}托管责任是不同的选择)/, `${locale} model-selection guide must separate model vendor from hosted-service compatibility`],
    [/(?:model selector does not choose application ingress|Model selector 不选择应用 ingress)[\s\S]*protocols\/connect/, `${locale} model-selection guide must separate ingress selection from execution`],
    [/protocols\/connect[\s\S]*protocols\/acp|protocols\/acp[\s\S]*protocols\/connect/, `${locale} model-selection guide must delegate protocol and ACP details to their canonical matrices`],
  ]);
  rejectText(modelSelection, [
    [/ModelConfig\.x_awaken\.acp/, `${locale} model-selection guide documents an unsupported ACP field`],
    [/acp:claude[\s\S]*acp:codex[\s\S]*acp:gemini[\s\S]*acp:opencode[\s\S]*acp:hermes/, `${locale} model-selection guide must not duplicate the five-runtime ACP catalog`],
  ]);

  requireText(join(platform, 'index.md'), [
    [/Managed Agents[\s\S]*AI SDK[\s\S]*AG-UI[\s\S]*A2A[\s\S]*MCP[\s\S]*protocols\/connect/, `${locale} product entry must expose multi-protocol value and link to its canonical matrix`],
    [/(?:all enter this one contract|都进入这一份契约)/, `${locale} product entry must explain the shared Agent and Session value`],
  ]);
}

// Cause/effect graph for the task-first protocol references:
// C1: AI SDK and AG-UI expose best-effort live events before the committed
//     Session outcome, and a browser can disconnect during that interval.
// C2: each frontend protocol accepts a bounded input/continuation contract;
//     malformed, unsupported, or stale caller state must fail closed.
// C3: A2A has inbound and outbound directions, with one context containing
//     immutable Tasks that may normally wait in input-required.
// C4: ACP selects one exact catalog row independently from one Sandbox tier;
//     model relaunch, process reap, neutral-history reconstruction, and the one
//     pre-prompt handshake retry are system lifecycle behavior rather than
//     manual repair. Admission rejection and committed ACP launch/turn failures
//     survive those mechanisms and end the current Run.
// C5: Live Inbox is a process-local native-attempt queue. Consumption removes
//     edit identity, ACP has no inbox, and durable Session events own fallback.
// Effects:
// E1: a reader can distinguish responsive display from durable completion and
//     does not invent a reconnect or orphan-cleanup procedure.
// E2: only a condition the caller can observe and correct appears in the action
//     table; unsupported fields and stale identities are stated explicitly.
// E3: input-required stays a continuation, terminal A2A Tasks stay immutable,
//     and a follow-up cannot silently restart the same terminal Task.
// E4: ACP recovery remains on the authoritative executor/ledger path, with the
//     gated real-CLI evidence limit visible. Automatic branches have no repair
//     instructions; terminal `acp_failure` branches require a bounded evidence
//     bundle, correction when identifiable, and a new Run rather than replay.
// E5: Live Inbox users know exactly when to refresh, use committed history, or
//     send a durable event, without treating normal drain as a fault.
// Decision table:
// | Rule | Causes | Required effects |
// | P1 | C1+C2, AI SDK | E1+E2 |
// | P2 | C1+C2, AG-UI | E1+E2 |
// | P3 | C3 | E3 |
// | P4 | C4 | E4 |
// | P5 | C5 | E5 |
// These content checks are the smallest systematic tests for changed public
// guidance. Runtime transition correctness remains owned by the fixed-revision
// Rust tests cited in each page; duplicating those transitions here would create
// a second implementation-level source of truth.
for (const locale of ['en', 'zh']) {
  const protocols = join(docsRoot, 'platform/current', locale, 'protocols');
  requireText(join(protocols, 'ai-sdk.md'), [
    [/UIMessage[\s\S]*RunApplication[\s\S]*(?:[Cc]ommitted Session history|已提交 Session 历史)/, `${locale} AI SDK page must lead from the frontend task to the shared execution and history owners`],
    [/data: \[DONE\][\s\S]*(?:committed tail|已提交 tail)/, `${locale} AI SDK page must separate SSE completion framing from committed authority`],
    [/(?:browser disconnect|浏览器断线)[\s\S]*(?:interrupt|自动)/i, `${locale} AI SDK page must describe disconnect cleanup as automatic behavior`],
    [/(?:Conditions the application must correct|应用需要纠正的条件)[\s\S]*toolCallId/, `${locale} AI SDK page must retain only caller-correctable request and tool-decision conditions`],
    [/(?:partial live output|部分实时输出)[\s\S]*(?:committed history|已提交历史)[\s\S]*(?:Do not resend|不要仅因)/i, `${locale} AI SDK page must require committed-history reconciliation before repeating partial output`],
  ]);
  rejectText(join(protocols, 'ai-sdk.md'), [
    [/(?:manually clean up|请手工清理|(?<!不)需要手工清理).{0,30}(?:Run|运行)/i, `${locale} AI SDK page must not prescribe orphan cleanup after automatic interruption`],
  ]);

  requireText(join(protocols, 'ag-ui.md'), [
    [/HttpAgent[\s\S]*RunApplication[\s\S]*(?:Session history|Session 历史)/, `${locale} AG-UI page must preserve client, execution, and history ownership`],
    [/(?:per-run|每次 run)[\s\S]*tools[\s\S]*context[\s\S]*parentRunId[\s\S]*forwardedProps/, `${locale} AG-UI page must disclose the unsupported input extensions`],
    [/RUN_ERROR[\s\S]*503[\s\S]*(?:disconnect|断线)[\s\S]*(?:interrupt|自动)/i, `${locale} AG-UI page must distinguish caller errors, unavailable history, and automatic disconnect cleanup`],
    [/(?:History `503`|历史读取返回 `503`)[\s\S]*(?:bounded backoff|有界退避)[\s\S]*(?:empty history|空历史)/i, `${locale} AG-UI page must preserve state while history is unavailable`],
    [/POST \/v1\/ag-ui[\s\S]*(?:Public HTTP API|公共 HTTP API)[\s\S]*(?:complete route index|完整路由索引)/i, `${locale} AG-UI page must delegate the complete route family to the API reference`],
  ]);
  rejectText(join(protocols, 'ag-ui.md'), [
    [/\/v1\/ag-ui\/agents\/\{agent_id\}[\s\S]*\/v1\/ag-ui\/threads\/\{thread_id\}\/messages/, `${locale} AG-UI page must not duplicate the complete route inventory`],
  ]);

  requireText(join(protocols, 'a2a.md'), [
    [/(?:both directions|两个方向)[\s\S]*(?:Remote client to Awaken|远端 client 调用 Awaken)[\s\S]*(?:Awaken to remote Agent|Awaken 调用远端 Agent)/, `${locale} A2A page must begin with inbound and outbound choices`],
    [/contextId[\s\S]*taskId[\s\S]*input-required[\s\S]*(?:not[\s\S]{0,30}failed|不是[\s\S]{0,20}失败)/, `${locale} A2A page must preserve normal same-task continuation`],
    [/(?:terminal A2A Task is immutable|A2A terminal Task 不可变)[\s\S]*(?:new task|新 task)/, `${locale} A2A page must preserve terminal task immutability`],
  ]);

  requireText(join(protocols, 'acp.md'), [
    [/acp:<id>[\s\S]*sandbox_tier[\s\S]*AttemptExecutorRegistry[\s\S]*AcpRunExecutor[\s\S]*AgentChannelSource/, `${locale} ACP page must lead from the two choices into the authoritative static structure`],
    [/(?:What the system resolves without manual repair|系统自动处理的情况)[\s\S]*ModelSwitch::Relaunch|(?:What the system resolves without manual repair|系统自动处理的情况)[\s\S]*(?:relaunch|重新启动)/i, `${locale} ACP page must classify built-in lifecycle recovery outside troubleshooting`],
    [/(?:handshake)[\s\S]*(?:before `session\/new` returns an id|`session\/new` 返回 id 之前)[\s\S]*(?:automatic|自动)/i, `${locale} ACP page must keep the only safe pre-prompt handshake retry automatic`],
    [/acp_failure[\s\S]*(?:credential|凭据|credential)[\s\S]*(?:quota|rate-limit)[\s\S]*(?:transport|协议|protocol)[\s\S]*(?:new Run|新 Run)/i, `${locale} ACP page must classify the terminal failures that survive built-in recovery`],
    [/(?:backend_ref)[\s\S]*(?:runtime pin)[\s\S]*sandbox_tier[\s\S]*(?:launch stage)[\s\S]*acp_failure[\s\S]*(?:sanitized|脱敏)/i, `${locale} ACP terminal-failure guidance must request a bounded sanitized evidence bundle`],
    [/(?:permission wait)[\s\S]*(?:not a failure|不是失败)[\s\S]*(?:resume ticket)/i, `${locale} ACP page must keep committed permission waiting out of failure repair`],
    [/(?:gated real-CLI|需要真实 CLI)[\s\S]*(?:not a default CI result|不是 CI 常规结果)/, `${locale} ACP page must disclose the live recovery evidence limit`],
  ]);

  requireText(join(protocols, 'live-inbox.md'), [
    [/(?:best-effort\s+steering window|best-effort 操控窗口)[\s\S]*(?:ordinary\s+Session events|普通 Session event)/, `${locale} Live Inbox page must separate editing from durable ingress`],
    [/(?:process-local|进程内)[\s\S]*(?:does not[\s\S]{0,50}ACP\s+executor|不会[\s\S]{0,30}ACP\s+executor)/, `${locale} Live Inbox page must disclose its native process-local execution boundary`],
    [/404 Not Found[\s\S]*409 Conflict[\s\S]*410 Gone[\s\S]*500 Internal Server Error/, `${locale} Live Inbox page must preserve every externally actionable HTTP outcome`],
    [/(?:Normal consumption needs no troubleshooting|正常消费不需要故障排查)[\s\S]*(?:committed history|committed history)/, `${locale} Live Inbox page must keep automatic drain out of troubleshooting`],
  ]);

  for (const page of ['ai-sdk.md', 'ag-ui.md', 'a2a.md', 'acp.md', 'live-inbox.md']) {
    rejectText(join(protocols, page), locale === 'en' ? [
      [/(?:Who can act|Platform operator)/i, `${locale} protocol guidance must not require role classification`],
    ] : [
      [/(?:谁可以处理|平台人员)/, `${locale} 协议说明不得要求读者先做角色分类`],
    ]);
  }
}

// Cause-effect design for Awaken configuration and architecture alignment:
// C1: a retired command or deployment environment key appears in an active page.
// C2: role docs omit the data owner or allow a Worker to own authority stores.
// C3: architecture skips the immutable publication-to-execution contract.
// C4: navigation does not reveal user, developer, internal, and reference lanes.
// E1: copy/paste startup fails or creates a parallel configuration authority.
// E2: operators deploy an unsafe topology or run migrations from the wrong role.
// E3: contributors cannot trace retries, fencing, or terminal ownership.
// E4: readers mix product tasks with implementation internals.
// Constraints: typed TOML is the product configuration authority; Control owns
// publication/config, Coordinator owns run truth, Resources owns Resource truth,
// and Worker is database-free. Decision rules R1-R4 below require the canonical
// owner pages and lane registry to preserve every cause/effect boundary.
for (const locale of ['en', 'zh']) {
  const platform = join(docsRoot, 'platform/current', locale);
  requireText(join(platform, 'reference/configuration.md'), [
    [/role\s*=\s*"(?:all-in-one|control|coordinator|worker)"/, `${locale} configuration must use a canonical process role`],
    [/awaken database migrate/, `${locale} configuration must name the explicit server migration command`],
    [/Worker|工作节点/, `${locale} configuration must document Worker ownership`],
    [/package_image_registry[\s\S]*package_registry_auth_file[\s\S]*package_registry_insecure[\s\S]*package_image_builder[\s\S]*package_local_cache_ttl_secs/, `${locale} configuration must preserve current package-image operator controls`],
  ]);
  requireText(join(platform, 'concepts/architecture.md'), [
    [/Control[\s\S]*Coordinator[\s\S]*Resources[\s\S]*Worker/, `${locale} architecture must preserve the four role boundaries`],
    [/ExecutableAgentSnapshot/, `${locale} architecture must name the immutable execution contract`],
    [/OCI registry[\s\S]*(?:durable|\u6301\u4e45) image-build[\s\S]*lease/, `${locale} architecture must preserve package-image authority and coordination`],
    [/configuration-to-execution/, `${locale} architecture must link the detailed mechanism owner`],
  ]);
  requireText(join(platform, 'concepts/configuration-to-execution.md'), [
    [/AgentConfig[\s\S]*ExecutableAgentSnapshot[\s\S]*CommitOperation/, `${locale} mechanism must trace authoring through commit`],
    [/failure|失败|故障/i, `${locale} mechanism must document failure behavior`],
    [/retry|重试/i, `${locale} mechanism must document retry behavior`],
  ]);
}

// Cause/effect design for the consolidated authorization profiles:
// C1: Control and Resources actions are qualified through one Workspace profile.
// C2: Hosted Run lifecycle remains a separate relying-party profile.
// C3: Awaken owns fixed role grants while a hosting product may compose exact
//     Workspace bindings into its own access model.
// C4: copying a host's Member/Administrator mapping into Platform docs would
//     create a second product-access authority and drift from other hosts.
// E1: docs expose one Workspace action vocabulary and one producer.
// E2: Run actions do not leak into the Workspace profile.
// E3: fixed Platform grants remain exact and the host cannot redefine them.
// E4: the agent executor remains a workload identity, not a human access level.
// Decision table:
// | Rule | Workspace profile | Runtime profile | fixed grants | host mapping copied | Outcome |
// | A1   | current           | current         | exact        | no                  | accept  |
// | A2   | split/legacy      | any             | any          | any                 | reject  |
// | A3   | current           | merged/absent   | any          | any                 | reject  |
// | A4   | current           | current         | changed      | any                 | reject  |
// | A5   | current           | current         | exact        | yes                 | reject  |
for (const locale of ['en', 'zh']) {
  const governance = join(docsRoot, `platform/current/${locale}/concepts/governance.md`);
  requireText(governance, [
    [/Workspace action vocabulary[\s\S]*workspace\.\*[\s\S]*apikey\.\*[\s\S]*model_supply\.\*[\s\S]*file\.\*[\s\S]*skill\.\*/, `${locale} governance must preserve the one Workspace action vocabulary`],
    [/awaken\.workspace:hosted_admin[\s\S]*awaken\.workspace:hosted_builder[\s\S]*awaken\.workspace:workspace_user[\s\S]*awaken\.workspace:publisher[\s\S]*awaken\.workspace:credential_ingress[\s\S]*awaken\.workspace:tunnel_manager/, `${locale} governance must preserve fixed Workspace role grants`],
    [/awaken\.runtime:workspace_admin[\s\S]*awaken\.runtime:workspace_user[\s\S]*awaken\.runtime:agent_executor/, `${locale} governance must preserve fixed Runtime role grants`],
    [/(?:hosting product may compose|托管产品可以组合)[\s\S]*(?:must not redefine|不能重新定义)/, `${locale} governance must keep hosting access composition outside Platform authority`],
    [/awaken\.runtime:agent_executor[\s\S]*(?:workload identity|工作负载身份)/, `${locale} governance must keep agent_executor outside human access levels`],
  ]);
  rejectText(governance, [
    [/^\| (?:Member|Administrator|成员|管理员) \|/m, `${locale} governance must not copy a hosting product's user-facing access mapping`],
  ]);
}

// Cause-effect design for localized documentation navigation:
// C1: audience and journey keys are stable contracts used by frontmatter.
// C2: rendered labels vary by locale and can drift if a hub translates them.
// C3: leaving English labels in the Chinese map makes a translated guide harder
//     to scan even though the underlying key remains unchanged.
// E1: all callers use the same five audience keys and section keys.
// E2: English and Chinese readers see one section and subsection label derived
//     from the same owner.
// Decision rule: keep canonical keys in English, localize only their rendered
// labels in this taxonomy, and reject page-local label registries.
const taxonomyPath = join(root, 'src/lib/docsTaxonomy.ts');
requireText(taxonomyPath, [
  [/manual[\s\S]*developer[\s\S]*operator[\s\S]*internals[\s\S]*reference/, 'taxonomy must preserve all five audience values'],
  [/manual: \{ en: 'User manual', zh: '使用指南' \}[\s\S]*developer: \{ en: 'Developer guide', zh: '开发指南' \}[\s\S]*operator: \{ en: 'Operator guide', zh: '运营指南' \}[\s\S]*internals: \{ en: 'Internal mechanisms', zh: '内部机制' \}/, 'audience labels must be localized by the canonical taxonomy'],
  [/Start: \{ en: 'Start', zh: '开始' \}[\s\S]*Build: \{ en: 'Build an Agent', zh: '构建 Agent' \}[\s\S]*Connect: \{ en: 'Connect an application', zh: '接入应用' \}[\s\S]*Govern: \{ en: 'Run and govern', zh: '运行与治理' \}[\s\S]*Operate: \{ en: 'Operate and recover', zh: '运营与恢复' \}/, 'journey labels must be localized by the canonical taxonomy'],
  [/DOC_SUBSECTION_ZH[\s\S]*'Agent setup': '配置 Agent'[\s\S]*'Execution boundary': '执行边界'[\s\S]*'Governance and reliability': '治理与可靠性'[\s\S]*docSubsectionLabel/, 'Chinese subsection labels must be localized by the canonical taxonomy'],
]);

// Cause-effect design for Flow's consolidated work and Pack model:
// C1: Outcome can be described as a writable aggregate or second status machine.
// C2: dynamic parallelism can return to hidden multi-Executor/join branches.
// C3: Pack authors can be sent to the retired ResourcePack parser.
// C4: Resource can be made Issue-owned or an Agent can gain ambient object tools.
// C5: Flow can duplicate Awaken's executable Environment or omit exact activation.
// C6: Outcome delivery can regress to child/Run aggregation or a boolean status.
// E1: work progress, acceptance, retry, cancellation, or audit disagree.
// E2: two execution graphs become scheduling authorities.
// E3: two descriptors and validators accept different releases.
// E4: Resource lifetime/authorization diverges across transports.
// E5: authoring and execution identities drift or a live Session changes substrate.
// E6: displayed acceptance disagrees with the root Workflow output contract.
// Constraints: Outcome is a root-Issue projection; child Issue DAG is the only
// dynamic graph; PackDescriptor v2 is the one author format; every Resource
// consumer crosses the scoped operations boundary; Environment activation is the
// exact Flow-to-Awaken bridge; formal delivery uses only root accepted outputs.
// R1-R6 exercise the bilingual canonical owners because the behavior is prose.
for (const locale of ['en', 'zh']) {
  const flow = join(docsRoot, 'flow/current', locale);
  requireText(join(flow, 'designing/define-an-agent.md'), [
    [/\/api\/actors[\s\S]*\/api\/projects\/\{project\}\/agents\/\{definition\}\/revision[\s\S]*\/activations\/\{activation_id\}/, `${locale} Agent guide must preserve Actor, immutable revision, and activation boundaries`],
    [/"kind": "direct"[\s\S]*"mode": "provider_model"[\s\S]*(?:Workflow-backed|Workflow-backed Agent)/, `${locale} Agent guide must preserve direct and Workflow-backed execution rules`],
  ]);
  requireText(join(flow, 'how-to/publish-a-pack.md'), [
    [/\/api\/pack-studio\/drafts\/\{draft_id\}\/publish[\s\S]*\/api\/scopes\/\{scope\}\/domain-pack-imports[\s\S]*\/api\/scopes\/\{scope\}\/domain-pack-adoption/, `${locale} Pack guide must preserve publication, import, and adoption ownership`],
  ]);
  requireText(join(flow, 'how-to/capability-requirements.md'), [
    [/resource-requirements\/assessment[\s\S]*missing_resource[\s\S]*resource-requirements\/fulfillment[\s\S]*bind_existing[\s\S]*create_resource[\s\S]*store_credential/, `${locale} Resource requirement guide must preserve selectors, statuses, and every fulfillment command`],
  ]);
  requireText(join(flow, 'concepts/issues.md'), [
    [/OutcomeView/, `${locale} Issue concept must define the root projection`],
    [/issue\.decompose/, `${locale} Issue concept must define the decomposition authority`],
    [/last child|最后一个子 Issue/i, `${locale} Issue concept must distinguish ready from accepted`],
    [/acceptance_deliverables[\s\S]*acceptance_summary/, `${locale} Issue concept must expose formal deliverables and their summary`],
    [/pending[\s\S]*fulfilled[\s\S]*accepted[\s\S]*canceled/, `${locale} Issue concept must preserve the closed deliverable state table`],
  ]);
  requireText(join(flow, 'concepts/domain-packs.md'), [
    [/PackDescriptor[\s\S]*contract_version:\s*2/, `${locale} Pack concept must name the one author format`],
    [/foundation[\s\S]*integration[\s\S]*domain[\s\S]*solution/, `${locale} Pack concept must preserve tier direction`],
    [/five component|\u4e94\u79cd component/, `${locale} Pack concept must include the fifth Environment owner`],
  ]);
  requireText(join(flow, 'concepts/resource-model.md'), [
    [/without any Issue|完全没有 Issue/, `${locale} Resource concept must preserve independent lifetime`],
    [/Workspace \*\*Objects\*\*[\s\S]*(?:schema-declared|schema 声明)[\s\S]*(?:nested|嵌套)[\s\S]*(?:provider-specific|供应商专用)/, `${locale} Resource concept must explain the generic schema-driven Objects UI`],
    [/(?:Pack supplies the data contract|Pack 提供数据契约)[\s\S]*(?:Action[\s\S]*owns|Action 自己拥有)[\s\S]*(?:impact|影响)/, `${locale} Resource concept must keep data and presentation hints with the Pack and Action`],
    [/resource_access/, `${locale} Resource concept must preserve explicit Agent access`],
    [/resource-operations/, `${locale} Resource concept must preserve one application boundary`],
    [/ResourceContentStore[\s\S]*ContentDescriptor/, `${locale} Resource concept must preserve one content custody boundary`],
    [/resource\.submit[\s\S]*resource\.content\.get/, `${locale} Resource concept must name explicit content mutation and read grants`],
    [/put immutable bytes|put \u4e0d\u53ef\u53d8 byte/, `${locale} Resource concept must preserve content commit ordering`],
  ]);
  requireText(join(flow, 'concepts/object-model.md'), [
    [/resource\.types[\s\S]*resource\.query[\s\S]*resource\.get[\s\S]*resource\.realize[\s\S]*resource\.changes/, `${locale} object model must preserve the five fixed scope-console tools`],
  ]);
  rejectText(join(flow, 'concepts/object-model.md'), [
    [/resource\.invoke/, `${locale} object model must not resurrect the absent ambient invoke tool`],
    [/six generic|\u516d\u4e2a\u901a\u7528/, `${locale} object model must not describe six fixed Resource tools`],
  ]);
  requireText(join(flow, 'how-to/manage-outcomes.md'), [
    [/\/api\/projects\/\{project\}\/outcomes/, `${locale} Outcome guide must name the read projection endpoint`],
    [/read-only|只读/, `${locale} Outcome guide must not create a command authority`],
    [/acceptance_deliverables[\s\S]*acceptance_summary\.complete/, `${locale} Outcome guide must teach formal delivery inspection`],
  ]);
  requireText(join(flow, 'concepts/environments.md'), [
    [/fifth Pack component|第五种 Pack component/, `${locale} Environment concept must reuse the Pack owner path`],
    [/\/v1\/environments/, `${locale} Environment concept must preserve Awaken execution authority`],
    [/EnvironmentActivation[\s\S]*ExecutionSnapshotV1/, `${locale} Environment concept must trace activation into the frozen snapshot`],
    [/\/api\/projects\/\{project\}\/environment-activations/, `${locale} Environment concept must name the Project activation API`],
    [/fail(?:s|ed)?\s+closed/i, `${locale} Environment concept must document closed failure behavior`],
  ]);
  requireText(join(flow, 'reference/workflow-config.md'), [
    [/"kind": "environment"[\s\S]*"activation_id"/, `${locale} Workflow contract must bind an Environment activation`],
  ]);
}

for (const locale of ['en', 'zh']) {
  const flow = join(docsRoot, 'flow/current', locale);
  requireText(join(flow, 'quickstart.md'), [
    [/config schema/, 'quickstart must generate the configuration schema'],
    [/project bootstrap/, 'quickstart must use the canonical Project Bootstrap CLI'],
    [/--first-issue/, 'quickstart must reach a visible first Issue'],
    [/configuration_ready/, 'quickstart must name the terminal readiness signal'],
  ]);
  requireText(join(flow, 'tutorials/first-agent-run.md'), [
    [/does not (?:execute|produce)|不会产生|不执行 Agent/, 'manual Workflow tutorial must disclose that no Agent Run occurs'],
    [/project bootstrap/, 'manual Workflow tutorial must reuse canonical onboarding'],
  ]);
  requireText(join(flow, 'reference/config.md'), [
    [/config schema/, 'configuration reference must point to the generated schema'],
  ]);
}

// Cause-effect design for the feature-first public journey and execution-owner
// migration:
// C1: Flow's source guardrails mark the WorkUnit-to-Run link and sole Awaken
//     Worker authority Built while the public concept still says Target.
// C2: overview copy can lead with recovery internals and omit the complete user
//     function path from configuration through application use.
// C3: the retired bulk porter can be restored and overwrite canonical audited
//     pages from an obsolete repository and output path.
// E1: public status understates shipped source behavior and contradicts its pin.
// E2: evaluators cannot discover what the products do before reading internals.
// E3: a second documentation update mechanism recreates drift and duplicate truth.
// Constraints: Flow invariants/code own execution facts; existing overview pages
// own adoption routing; exact reference stays in its current owner; no bulk porter
// is supported. Decision rules R1/R2 require Built plus the early-preview
// boundary, R3 requires the functional overview, and R4 rejects the obsolete
// mechanism. These prose checks are the smallest systematic tests for the changed
// documentation behavior.
for (const locale of ['en', 'zh']) {
  const flow = join(docsRoot, 'flow/current', locale);
  const agentRuns = join(flow, 'concepts/agents-runs.md');
  requireText(agentRuns, [
    [/WorkUnit↔Run link\s*\| Built/, `${locale} Agent/Run concept must mark the durable link Built`],
    [/(?:Sole|唯一) fleet\/worker authority\s*\| Built/, `${locale} Agent/Run concept must mark Awaken's sole Worker authority Built`],
    [/(?:Workforce remains in early preview|Workforce 仍处于提前预览阶段)/, `${locale} Built rows must retain the Workforce product maturity`],
  ]);
  rejectText(agentRuns, [
    [/Working-tree implementation|G169\/G170[^\n]*Target|remain Target|仍是 Target/, `${locale} Agent/Run concept retains the superseded Target status`],
  ]);

  const platform = join(docsRoot, 'platform/current', locale, 'index.md');
  requireText(platform, [
    [locale === 'zh' ? /跑通第一条路径/ : /Run the first path/, `${locale} Awaken overview must route the complete functional journey to its owner`],
  ]);
}

const obsoletePorter = join(root, 'scripts/port-awaken-docs.mjs');
if (existsSync(obsoletePorter)) {
  failures.push('scripts/port-awaken-docs.mjs: obsolete bulk porter recreates a parallel documentation source');
}

// Cause-effect design for the adoption boundary:
// C1: public positioning can make an existing Agent a prerequisite.
// C2: a source-folder name can leak into public home, docs navigation, or search.
// C3: product copy can collapse Agents, Objects, and Workforce ownership.
// C4: the docs hub can hardcode translated responsibility labels that drift from
//     the audience taxonomy used by every generated product page.
// E1: Agents supports create, adopt, and connect without requiring Workforce.
// E2: all three public products retain a distinct route and authority.
// E3: Coding fixtures can drift into the public product category.
// E4: one taxonomy supplies localized responsibility labels to the hub and all
//     generated documentation routes.
// Decision rules: public site copy preserves the long-term work boundary; the
// company homepage owns company purpose while the Awaken product copy owns the
// create/adopt/connect actions; one visibility authority marks previews
// across generated public surfaces; one audience taxonomy owns both English and
// Chinese responsibility labels. These source checks are the smallest
// systematic tests because the behavior is static routing/copy, while exact
// marketing headlines may change.
// Managed compatibility is retained only where the Awaken adapter and its named
// SDK validation record provide implementation evidence. Application examples from other
// repositories are deliberately outside this corpus.
for (const locale of ['en', 'zh']) {
  const platform = join(docsRoot, 'platform/current', locale);
  requireText(join(platform, 'compatibility.md'), [
    [/0\.117\.1[\s\S]*0\.105\.0/, `${locale} compatibility must name the verified current and matrix SDK versions`],
    [/invalid_request_error/, `${locale} compatibility must document beta-header enforcement`],
  ]);
}

const siteContentPath = join(root, 'src/i18n/content.ts');
requireText(siteContentPath, [
  [/Awaken Agents is open-source, self-hostable infrastructure designed for building and operating production AI Agent applications\./, 'English public copy must own the canonical Agents category'],
  [/en:\s*{[\s\S]*products:\s*{[\s\S]*managed:\s*{[\s\S]*name: 'Awaken Agents'[\s\S]*objects:\s*{[\s\S]*name: 'Awaken Objects'[\s\S]*workforce:\s*{[\s\S]*name: 'Awaken Workforce'/, 'English home must expose exactly the three public product owners'],
  [/zh:\s*{[\s\S]*products:\s*{[\s\S]*managed:\s*{[\s\S]*name: 'Awaken Agents'[\s\S]*objects:\s*{[\s\S]*name: 'Awaken Objects'[\s\S]*workforce:\s*{[\s\S]*name: 'Awaken Workforce'/, 'Chinese home must expose exactly the three public product owners'],
  [/creating an Agent, adopting a supported Agent, or connecting behavior you already own/, 'English Awaken copy must preserve all Agent entry modes'],
  [/创建 Agent、采用受支持的 Agent，或接入已有行为/, 'Chinese Awaken copy must preserve all Agent entry modes'],
  [/en:\s*{[\s\S]*slug: 'pilot'[\s\S]*adoption: 'Create a thin Agent application'[\s\S]*slug: 'deepseek-harness'[\s\S]*adoption: 'Build an advanced Agent workbench'[\s\S]*slug: 'design'[\s\S]*adoption: 'Build a domain-rich AI product'/, 'English cases must cover thin app, workbench, and domain-rich product shapes'],
  [/zh:\s*{[\s\S]*slug: 'pilot'[\s\S]*adoption: '创建轻量 Agent 应用'[\s\S]*slug: 'deepseek-harness'[\s\S]*adoption: '开发高级 Agent Workbench'[\s\S]*slug: 'design'[\s\S]*adoption: '构建领域型 AI 产品'/, 'Chinese cases must cover thin app, workbench, and domain-rich product shapes'],
]);
rejectText(siteContentPath, [
  [/\bCoding Agent\b/, 'public site must not collapse the product category into Coding Agent'],
  [/AI Workforce Operating System/i, 'vision-only AI Workforce Operating System label must not appear as current public product copy'],
]);

// Cause-effect design for the GEO/SEO concept layer:
// C1: a reader or answer engine asks what an Agent Runtime is; C2: framework,
// Runtime, and application infrastructure are treated as interchangeable;
// C3: a translated page drifts from the canonical implementation evidence;
// C4: a discoverable page has visible prose but no article relationship to the
// product; C5: a second /concepts route tree duplicates Docs ownership.
// E1: one answer-first bilingual definition lives inside the existing Agents
// Docs collection; E2: one neutral three-layer comparison states ownership;
// E3: both locales cite identical verified code coordinates; E4: generated
// pages, search index, and llms.txt expose the concepts; E5: TechArticle and
// BreadcrumbList nodes point at the stable Agents entity; E6: no parallel
// public concept route exists.
// Decision table:
// | Rule | definition | comparison | locale/evidence | outputs/schema | route owner | Outcome |
// | G1   | present    | present    | same            | complete       | Docs        | accept  |
// | G2   | missing    | any        | any             | any            | any         | reject  |
// | G3   | present    | missing    | any             | any            | any         | reject  |
// | G4   | present    | present    | drift           | any            | any         | reject  |
// | G5   | present    | present    | same            | incomplete     | any         | reject  |
// | G6   | present    | present    | same            | complete       | parallel    | reject  |
const geoConcepts = [
  {
    source: join(docsRoot, 'platform/current/en/concepts/agent-runtime.md'),
    peer: join(docsRoot, 'platform/current/zh/concepts/agent-runtime.md'),
    output: join(distRoot, 'docs/agents/concepts/agent-runtime/index.html'),
    peerOutput: join(distRoot, 'zh/docs/agents/concepts/agent-runtime/index.html'),
    title: 'What is an AI Agent Runtime?',
    definition: /An <strong>AI Agent runtime<\/strong> is the execution layer/,
  },
  {
    source: join(docsRoot, 'platform/current/en/concepts/framework-runtime-infrastructure.md'),
    peer: join(docsRoot, 'platform/current/zh/concepts/framework-runtime-infrastructure.md'),
    output: join(distRoot, 'docs/agents/concepts/framework-runtime-infrastructure/index.html'),
    peerOutput: join(distRoot, 'zh/docs/agents/concepts/framework-runtime-infrastructure/index.html'),
    title: 'Agent Framework vs Agent Runtime vs Agent Application Infrastructure',
    definition: /An <strong>Agent framework<\/strong> helps developers define Agent behavior/,
  },
];
for (const concept of geoConcepts) {
  for (const path of [concept.source, concept.peer, concept.output, concept.peerOutput]) {
    if (!existsSync(path)) failures.push(`${relative(root, path)}: canonical GEO concept or localized output is missing`);
  }
  requireText(concept.source, [
    [new RegExp(`title: "${concept.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), 'canonical concept must retain its direct query title'],
    [/## Static structure[\s\S]*## Dynamic behavior/, 'concept must explain both ownership and execution behavior'],
  ]);
  requireText(concept.output, [
    [concept.definition, 'concept must answer the query in the first visible paragraph'],
    [/"@type":"TechArticle"/, 'concept output must expose TechArticle metadata'],
    [/"@type":"BreadcrumbList"/, 'concept output must expose breadcrumb metadata'],
    [/"dateModified":"2026-09-03T00:00:00\.000Z"/, 'concept output must expose its reviewed date'],
    [/"about":\{"@id":"https:\/\/awakenworks\.com\/#awaken-agents"\}/, 'concept article must point at the stable Agents entity'],
  ]);
  requireText(concept.peerOutput, [
    [/"@type":"TechArticle"/, 'localized concept output must expose TechArticle metadata'],
    [/"about":\{"@id":"https:\/\/awakenworks\.com\/#awaken-agents"\}/, 'localized concept article must point at the same Agents entity'],
  ]);
}
if (existsSync(join(root, 'src/pages/concepts'))) {
  failures.push('src/pages/concepts: concepts must remain in the canonical Docs collection instead of a parallel route tree');
}
for (const [path, patterns] of [
  [join(distRoot, 'docs/search-index.json'), [/What is an AI Agent Runtime\?/, /Agent Framework vs Agent Runtime vs Agent Application Infrastructure/]],
  [join(distRoot, 'docs/llms.txt'), [/What is an AI Agent Runtime\?/, /Agent Framework vs Agent Runtime vs Agent Application Infrastructure/]],
  [join(distRoot, 'zh/docs/search-index.json'), [/什么是 AI Agent Runtime/, /Agent Framework、Agent Runtime 与 Agent 应用基础设施的区别/]],
  [join(distRoot, 'zh/docs/llms.txt'), [/什么是 AI Agent Runtime/, /Agent Framework、Agent Runtime 与 Agent 应用基础设施的区别/]],
]) requireText(path, patterns.map((pattern) => [pattern, 'generated discovery output must include both canonical GEO concepts']));

for (const [path, href] of [
  [join(distRoot, 'index.html'), '/docs/agents/concepts/agent-runtime'],
  [join(distRoot, 'zh/index.html'), '/zh/docs/agents/concepts/agent-runtime'],
  [join(distRoot, 'agents/index.html'), '/docs/agents/concepts/agent-runtime'],
  [join(distRoot, 'zh/agents/index.html'), '/zh/docs/agents/concepts/agent-runtime'],
  [join(distRoot, 'docs/index.html'), '/docs/agents/concepts/agent-runtime'],
  [join(distRoot, 'zh/docs/index.html'), '/zh/docs/agents/concepts/agent-runtime'],
]) requireText(path, [[new RegExp(`href="${href}"`), 'home, product, and Docs hub must link to the canonical Runtime concept']]);

const docsIndexPath = join(root, 'src/components/DocsIndex.astro');
const uiCatalogPath = join(root, 'src/i18n/ui.ts');
requireText(uiCatalogPath, [
  [/Build or connect an Agent application[\s\S]*Operate Agent infrastructure[\s\S]*Understand business objects[\s\S]*Manage work that must keep progressing/, 'English docs hub must route readers across all three product tasks'],
  [/构建或接入 Agent 应用[\s\S]*运营 Agent 基础设施[\s\S]*理解业务对象[\s\S]*管理一项持续推进的工作/, 'Chinese docs hub must route readers across all three product tasks'],
]);
requireText(docsIndexPath, [
  [/docAudienceLabel\(audience, lang\)/, 'docs hub responsibility labels must derive from the canonical taxonomy'],
  [/docsIndexCopy\[lang\]/, 'docs hub copy must derive from the locale catalog without component branches'],
]);

// Cause-effect design for the documentation navigation source of truth:
// C1: a product sidebar can be hardcoded in DocsShell as a fallback.
// C2: a product page supplies collection-derived navGroups.
// C3: the docs hub omits navGroups because it owns adoption links, not product content.
// E1: hardcoded and frontmatter-derived sidebars drift into competing navigation.
// E2: product pages render the authoritative collection-derived sidebar.
// E3: the bilingual hub still renders its small product-entry navigation.
// E4: advanced execution internals remain reachable inside Awaken Agents
//     without creating a second product or an eighth top-level journey stage.
// C5: rendering every stage expanded makes a simple Session task compete with
//     the complete Runtime maintenance inventory.
// E5: the canonical groups remain visible, but only the group containing the
//     current page opens by default; users can expand every other stage.
// Constraint: docsRoutes.ts is the only product-sidebar owner. Decision rules:
// R1 rejects the former navTrees duplicate; R2 requires the one hub-only fallback;
// R3 is exercised for both locales by the generated-link build scan below; R4
// keeps the seven Agents journey stages in task order; R5 accepts current-group
// disclosure and rejects an always-expanded list.
const docsShellPath = join(root, 'src/components/DocsShell.astro');
const docsRoutesPath = join(root, 'src/lib/docsRoutes.ts');
const docsShell = readFileSync(docsShellPath, 'utf8');
if (/\bnavTrees\b/.test(docsShell)) {
  failures.push('src/components/DocsShell.astro: product sidebar fallback duplicates docsRoutes.ts');
}
requireText(docsShellPath, [
  [/const docsHubNav = \[\{ group: 'Products'/, 'all docs-hub locales must reuse one Products navigation structure'],
  [/const nav = navGroups \?\? docsHubNav/, 'DocsShell must prefer collection-derived product navigation'],
]);
requireText(docsRoutesPath, [
  [/export function canonicalDocsEntry[\s\S]*new RegExp\(`\/\$\{parsed\.lang\}\(\?=\/\|\$\)`\)[\s\S]*'\/en'/, 'navigation must resolve localized index and nested pages through their canonical English peer'],
  [/const canonical = canonicalDocsEntry\(entries, e\)[\s\S]*canonical\.data\.section[\s\S]*canonical\.data\.subsection/, 'navigation rows must derive structural metadata from English'],
  [/tie\(aRow\.section\) - tie\(bRow\.section\)[\s\S]*audienceOrder\.indexOf/, 'product journey sections must sort before audience tie-breakers'],
  [/if \(p\.product === 'harness'\)[\s\S]*parts: \['runtime', \.\.\.p\.parts\]/, 'Agents navigation must map Runtime pages under the Agents product path'],
  [/agents: \['Start', 'Build', 'Connect', 'Govern', 'Operate', 'Understand', 'Reference'\]/, 'Agents navigation must follow the seven-stage user journey'],
]);

// Cause/effect design for the shared bilingual page renderer:
// C1: English and Chinese routes can each own a copy of the page layout.
// C2: the shared page can derive neighbors from the canonical sidebar or from
//     a second manually maintained relation.
// E1: purpose, journey, and accessibility changes remain identical by locale.
// E2: every adjacent link follows the same authoritative order as the sidebar.
// Decision table: D1 accepts the default route plus one parameterized locale
// route importing DocsPage; D2
// accepts docsNeighbors in DocsPage; either copied layout or manual adjacency
// rejects the build.
for (const route of [
  join(root, 'src/pages/docs/[...slug].astro'),
  join(root, 'src/pages/[lang]/docs/[...slug].astro'),
]) {
  requireText(route, [[/import DocsPage[\s\S]*<DocsPage/, 'locale route must delegate to the shared DocsPage renderer']]);
  rejectText(route, [[/import Base|<article|buildAwakenNav|buildNav\(/, 'locale route duplicates shared page rendering or navigation']]);
}
requireText(docsPagePath, [
  [/canonicalDocsEntry\(all, entry\)[\s\S]*canonical\.data\.section[\s\S]*canonical\.data\.audience/, 'shared page must render localized journeys from canonical English structure'],
  [/docsNeighbors\(navGroups, basePath\)/, 'shared page must derive adjacency from canonical navigation'],
  [/data-doc-purpose[\s\S]*data-doc-journey[\s\S]*data-doc-neighbor="previous"[\s\S]*data-doc-neighbor="next"/, 'shared page must render purpose and both journey directions'],
  [/\.prose pre[\s\S]*navigator\.clipboard\.writeText/, 'shared page must copy the current code block'],
  [/data-copy-aria=\{copy\.copyAria\}/, 'shared page must project the localized code-copy label into the client script'],
  [/scrollWidth > table\.clientWidth[\s\S]*data-table-scroll-hint[\s\S]*table\.before\(hint\)[\s\S]*previousElementSibling\.remove/, 'shared page must add and remove a visible hint for genuinely scrollable tables'],
]);
requireText(uiCatalogPath, [
  [/copyAria: 'Copy code'/, 'UI catalog must own the English code-copy control'],
  [/copyAria: '复制代码'/, 'UI catalog must own the Chinese code-copy control'],
  [/scrollTable: 'Scroll horizontally to read all columns'/, 'UI catalog must own the English table-scroll instruction'],
  [/scrollTable: '横向滚动以查看全部列'/, 'UI catalog must own the Chinese table-scroll instruction'],
]);

// Cause/effect design for critical task-page scanability:
// C1: a reader starts without knowing the terminal outcome.
// C2: an unmet prerequisite is discovered only after state changes begin.
// C3: instructions describe actions but no observable success signal.
// C4: the first common failure has no recovery route.
// C5: a completed task becomes a dead end.
// E1-E5: Goal, Prerequisites, numbered Steps, Verify, and Next steps remain
// visible in that scan order in both locales. Troubleshooting is present only
// when a source-reachable condition requires external action. The page voice tells
// readers what to do rather than announcing what the repository proves.
// Constraint: this rule applies only to the highest-frequency executable
// journeys below; landing, concept, and reference pages must not acquire empty
// procedural headings. Decision rule T1 accepts all nine semantic owners; T2
// rejects any missing owner in either peer.
const criticalTaskPages = [
  'platform/current/{locale}/how-to/configure-providers-models-credentials.md',
  'platform/current/{locale}/how-to/configure-sandbox-tiers.md',
  'platform/current/{locale}/how-to/connect-a-published-agent.md',
  'platform/current/{locale}/how-to/build-an-agent-with-the-assistant.md',
  'platform/current/{locale}/how-to/integrate-ai-sdk-frontend.md',
  'platform/current/{locale}/how-to/integrate-copilotkit-ag-ui.md',
  'platform/current/{locale}/how-to/expose-http-sse.md',
  'platform/current/{locale}/how-to/connect-an-a2a-server.md',
  'platform/current/{locale}/how-to/run-a-remote-hand.md',
  'platform/current/{locale}/how-to/manage-a-session.md',
  'platform/current/{locale}/how-to/configure-agent-behavior.md',
  'platform/current/{locale}/how-to/manage-webhooks.md',
  'platform/current/{locale}/how-to/self-host.md',
  'flow/current/{locale}/how-to/create-and-follow-an-issue.md',
  'flow/current/{locale}/how-to/manage-outcomes.md',
  'flow/current/{locale}/how-to/cycles.md',
  'flow/current/{locale}/tutorials/first-agent-run.md',
  'harness/current/{locale}/tutorials/first-agent.md',
  'harness/current/{locale}/tutorials/first-tool.md',
];
for (const locale of ['en', 'zh']) {
  const patterns = locale === 'en'
    ? [
        [/^## (?:Goal|Outcome)$/m, 'critical task must state its goal'],
        [/^## Prerequisites$/m, 'critical task must state prerequisites'],
        [/^## 1\./m, 'critical task must expose numbered actions'],
        [/^## (?:\d+\. )?(?:Verify|Verification)$/m, 'critical task must expose observable verification'],
        [/^## (?:Next steps|Which Doc To Read Next)$/m, 'critical task must provide the next route'],
      ]
    : [
        [/^## (?:目标|目标与成功信号)$/m, '关键任务必须说明目标'],
        [/^## 前置条件$/m, '关键任务必须说明前置条件'],
        [/^## 1\./m, '关键任务必须提供编号步骤'],
        [/^## (?:\d+\. )?(?:验证|验收)$/m, '关键任务必须提供可观察验证'],
        [/^## (?:下一步|下一步阅读)$/m, '关键任务必须提供后续路径'],
      ];
  for (const template of criticalTaskPages) {
    const path = join(docsRoot, template.replace('{locale}', locale));
    requireText(path, patterns);
    rejectText(path, locale === 'en' ? [
      [/\bThis (?:tutorial|page|path) proves\b/i, 'task voice must explain what the reader can do, not what the page proves'],
    ] : [
      [/本(?:教程|页|路径)[^。\n]*证明/, '任务语言应说明读者要做什么，而不是页面证明了什么'],
    ]);
  }
}

// Cause/effect design for SSE, outbound A2A, and standalone Hand tasks:
// C1 an SSE client can treat a live delta as completion or incremental reconnect
//    as supported; C2 an A2A retry can create a second remote task; C3 a relay
//    listener can be mistaken for product placement or successful execution.
// E1 committed terminal events, full-snapshot replay, and event-ID dedup are visible;
// E2 one publication-pinned endpoint and persisted remote task own recovery;
// E3 a real tool crosses the checked relay and indeterminate outcomes stay explicit.
// Decision table: N1 requires snapshot, terminal, reconnect, and ingress checks;
// N2 requires card, exact backend, direct Run, recovery, then delegation; N3
// requires topology choice, end-to-end test, ledger semantics, and no second
// placement owner. Missing any effect rejects the corresponding locale peer.
for (const locale of ['en', 'zh']) {
  const rootPath = join(docsRoot, `platform/current/${locale}/how-to`);
  requireText(join(rootPath, 'expose-http-sse.md'), locale === 'en' ? [
    [/curl -N[\s\S]*full committed snapshot[\s\S]*Last-Event-ID[\s\S]*Deduplicate by event ID[\s\S]*production ingress/, 'SSE task must distinguish committed replay, live delivery, and production proxy behavior'],
  ] : [
    [/curl -N[\s\S]*完整的已提交 snapshot[\s\S]*Last-Event-ID[\s\S]*按 event ID 去重[\s\S]*生产 ingress/, 'SSE 任务必须区分已提交重放、实时投递与生产代理行为'],
  ]);
  requireText(join(rootPath, 'connect-an-a2a-server.md'), locale === 'en' ? [
    [/GET \/v1\/a2a\/agent-card[\s\S]*a2a:<absolute-http-url>[\s\S]*recognizable task[\s\S]*committed task identity[\s\S]*Add delegation only after direct execution works/, 'A2A task must verify one exact remote identity and recovery before delegation'],
  ] : [
    [/GET \/v1\/a2a\/agent-card[\s\S]*a2a:<absolute-http-url>[\s\S]*容易辨认的任务[\s\S]*已提交的 task identity[\s\S]*直连成功后再增加委托/, 'A2A 任务必须先验证一个确切 remote identity 与恢复，再增加委托'],
  ]);
  requireText(join(rootPath, 'run-a-remote-hand.md'), locale === 'en' ? [
    [/does not create another placement authority[\s\S]*Choose the transport[\s\S]*hand_role --features hand[\s\S]*hand_dial_role --features hand[\s\S]*HandResult::Indeterminate/, 'Hand task must validate real transport effects without adding placement authority'],
  ] : [
    [/不创建[\s\S]*placement authority[\s\S]*选择要验证的 transport[\s\S]*hand_role --features hand[\s\S]*hand_dial_role --features hand[\s\S]*HandResult::Indeterminate/, 'Hand 任务必须验证真实 transport effect，且不增加 placement authority'],
  ]);
}

// Cause/effect design for external-maintainer troubleshooting:
// C1 a page has no source-reachable condition that survives built-in recovery and
//    needs external action; C2 a reachable request, configuration, credential,
//    network, or reconciliation condition does need external action; C3 support
//    cannot continue safely without stable identifiers and sanitized observations;
// C4 retrying, changing endpoints, or sharing credentials can increase impact.
// E1 C1 produces no Troubleshooting section; E2 C2 produces at least one
// symptom/check/action row; E3 C3 names the minimum evidence bundle; E4 C4 states
// a redaction or safe-stop boundary. Decision table: T1 no heading => accept; T2
// heading + data row + evidence + redaction => accept; T3 heading without any of
// those elements => reject; T4 role-assignment prose => reject.
const supportBoundaryPages = [
  'configure-providers-models-credentials.md',
  'configure-sandbox-tiers.md',
  'connect-a-published-agent.md',
  'build-an-agent-with-the-assistant.md',
  'integrate-ai-sdk-frontend.md',
  'integrate-copilotkit-ag-ui.md',
  'expose-http-sse.md',
  'connect-an-a2a-server.md',
  'run-a-remote-hand.md',
  'configure-agent-behavior.md',
  'manage-a-session.md',
  'self-host.md',
];
for (const locale of ['en', 'zh']) {
  const rootPath = join(docsRoot, `platform/current/${locale}/how-to`);
  for (const page of supportBoundaryPages) {
    const path = join(rootPath, page);
    const text = readFileSync(path, 'utf8');
    const heading = locale === 'en' ? '## Troubleshooting' : '## 故障排查';
    const start = text.indexOf(heading);
    if (start >= 0) {
      const afterHeading = start + heading.length;
      const nextHeading = text.indexOf('\n## ', afterHeading);
      const section = text.slice(start, nextHeading < 0 ? undefined : nextHeading);
      const patterns = locale === 'en' ? [
        [/\| Symptom \| Check \| Action \|/, 'troubleshooting must give an observable symptom/check/action sequence'],
        [/If the table does not resolve the problem,[\s\S]*(?:ID|command|route)/, 'troubleshooting must name a minimum support evidence bundle'],
        [/(?:Do\s+not\s+(?:include|attach|send)|Remove\s+(?:tokens|bearer tokens))/i, 'troubleshooting must state a redaction or safe-stop boundary'],
      ] : [
        [/\| 现象 \| 检查 \| 处理 \|/, '故障排查必须提供可观察的现象、检查与处理步骤'],
        [/如果表中步骤仍未解决问题，请先记录[\s\S]*(?:ID|command|route)/, '故障排查必须给出最小支持证据包'],
        [/(?:不要附带|不要发送|先删除)/, '故障排查必须说明脱敏或安全停止边界'],
      ];
      const tableHeader = locale === 'en' ? /^\| Symptom \|/ : /^\| 现象 \|/;
      const dataRows = section.split('\n').filter((line) => (
        /^\| [^|]+ \| [^|]+ \| [^|]+ \|$/.test(line)
        && !tableHeader.test(line)
        && !/^\|\s*:?-+/.test(line)
      ));
      if (dataRows.length === 0) {
        failures.push(`${relative(root, path)}: ${locale === 'en'
          ? 'troubleshooting must contain at least one externally actionable data row'
          : '故障排查必须至少包含一条外部维护者可执行的数据行'}`);
      }
      for (const [pattern, message] of patterns) {
        if (!pattern.test(section)) failures.push(`${relative(root, path)}: ${message}`);
      }
    }
    rejectText(path, locale === 'en' ? [
      [/\*\*Who can act:\*\*/, 'external-maintainer troubleshooting must not require role classification'],
    ] : [
      [/\*\*谁可以处理：\*\*/, '外部维护者故障排查不得要求角色分类'],
    ]);
  }
}

// Cause/effect design for troubleshooting inclusion:
// C1 immutable snapshots, archived writes, and full SSE replay are expected
//    contract behavior; C2 A2A task recovery, interrupt receipts, Worker fencing,
//    and eligible-Worker selection have system-owned convergence paths; C3 a
//    strict Hand relay is not a product placement selector.
// E1 expected outcomes stay in the normal task or verification flow; E2
// automatically converged states do not ask the reader to intervene; E3 only a
// source-reachable condition that needs configuration, network, credential, or
// reconciliation action remains under Troubleshooting.
// Decision table: A1 expected + no action => exclude; A2 automatic + no terminal
// error => exclude; A3 surfaced terminal/configuration error + external repair =>
// include; A4 indeterminate side effect + reconciliation required => include.
const automaticTroubleshootingPatterns = {
  en: new Map([
    ['build-an-agent-with-the-assistant.md', /request needs a secret|published change is absent|No draft card appears/i],
    ['configure-agent-behavior.md', /Session still shows the old behavior|Publish is unavailable/i],
    ['expose-http-sse.md', /Reconnection repeats old events|stream closes with no useful result/i],
    ['connect-an-a2a-server.md', /transport error occurs after task creation/i],
    ['run-a-remote-hand.md', /relay works but an Agent cannot use it/i],
    ['connect-a-published-agent.md', /second protocol creates unrelated work/i],
    ['configure-sandbox-tiers.md', /Session remains unplaced/i],
    ['manage-a-session.md', /Output streamed but disappears|Interrupt has no receipt|new event returns a conflict/i],
    ['self-host.md', /stale Worker commit is fenced|Worker registers but claims no work/i],
  ]),
  zh: new Map([
    ['build-an-agent-with-the-assistant.md', /请求需要秘密|已发布改动没有出现在|没有出现草稿卡片/],
    ['configure-agent-behavior.md', /Session 仍表现为旧行为|无法执行 Publish/],
    ['expose-http-sse.md', /重连后旧事件再次出现|stream 关闭却没有有用结果/],
    ['connect-an-a2a-server.md', /创建 task 后出现 transport error/],
    ['run-a-remote-hand.md', /Relay 正常，但 Agent 无法使用/],
    ['connect-a-published-agent.md', /第二种 protocol 创建了无关工作/],
    ['configure-sandbox-tiers.md', /Session 一直无法 placement/],
    ['manage-a-session.md', /输出曾经流出，但刷新后消失|中断没有回执|新事件返回 conflict/],
    ['self-host.md', /stale Worker commit 被 fenced|Worker 注册后没有领取工作/],
  ]),
};
for (const locale of ['en', 'zh']) {
  const rootPath = join(docsRoot, `platform/current/${locale}/how-to`);
  const troubleshooting = locale === 'en' ? 'Troubleshooting' : '故障排查';
  const next = locale === 'en' ? 'Next steps' : '下一步';
  for (const [page, automaticPattern] of automaticTroubleshootingPatterns[locale]) {
    const scoped = new RegExp(
      `^## ${troubleshooting}$[\\s\\S]*(?:${automaticPattern.source})[\\s\\S]*^## ${next}$`,
      'mi',
    );
    rejectText(join(rootPath, page), [[scoped, 'expected or automatically handled behavior must stay out of troubleshooting']]);
  }
}

// Cause/effect design for task-local failure summaries outside the Platform
// support-page set:
// C1 a lost NATS hint is absorbed by the poll fallback; C2 root readiness,
// pending deliverables, immutable revision pins, and open Issues after Cycle close
// are normal Flow states; C3 an Outcome integrity error has no public projection
// repair command and is surfaced as a 500 rather than an externally repairable
// view; C4 a malformed Cycle membership command is rejected with a stable 422;
// C5 a state-machine reminder is deliberately suppressed during its cooldown;
// C6 an in-process Tool exposes call start and committed result but has no mid-call
// progress channel. E1 C1-C3 and C5-C6 stay in normal behavior or verification
// prose, never troubleshooting; E2 only C4 remains as an exact
// symptom/check/action rule. Decision table: F1 automatic/expected/no public
// repair => no troubleshooting row; F2 surfaced validation error + corrected
// public command => keep; F3 invented rebuild or direct-storage action => reject.
for (const [path, patterns] of [
  [join(docsRoot, 'platform/current/en/how-to/use-nats-wake-signal.md'), [
    [/^## Diagnose failures$/m, 'lost wake, lease recovery, and commit fencing are system-owned behavior, not troubleshooting'],
  ]],
  [join(docsRoot, 'platform/current/zh/how-to/use-nats-wake-signal.md'), [
    [/^## 诊断失败$/m, '丢失 wake、lease 恢复与 commit fencing 属于系统行为，不是故障排查'],
  ]],
  [join(docsRoot, 'flow/current/en/how-to/manage-outcomes.md'), [
    [/^## Troubleshooting$/m, 'Outcome normal states and non-repairable projection invariants must not be troubleshooting'],
    [/repair the projection|rebuild the projection/i, 'Outcome has no public projection repair command'],
  ]],
  [join(docsRoot, 'flow/current/zh/how-to/manage-outcomes.md'), [
    [/^## 故障排查$/m, 'Outcome 正常状态与不可由外部修复的投影不变量不得成为故障排查'],
    [/修复投影|重建投影/, 'Outcome 没有公共投影修复命令'],
  ]],
  [join(docsRoot, 'flow/current/en/how-to/cycles.md'), [
    [/\| Activation does not promote an Issue \||\| A closed Cycle still has open Issues \|/, 'optional intake and independent Issue lifecycle are normal Cycle behavior'],
  ]],
  [join(docsRoot, 'flow/current/zh/how-to/cycles.md'), [
    [/\| 激活后 Issue 没有推进 \||\| Cycle 已关闭但仍有 open Issue \|/, '可选 intake 与独立 Issue 生命周期属于 Cycle 正常行为'],
  ]],
  [join(docsRoot, 'harness/current/en/how-to/constrain-tool-order-with-a-state-machine.md'), [
    [/\| Reminder never appears \| Still cooling down \|/, 'configured reminder cooldown is expected throttling, not an external failure'],
  ]],
  [join(docsRoot, 'harness/current/en/how-to/report-tool-progress.md'), [
    [/\| Expected mid-call progress from an in-process tool \|/, 'the in-process Tool progress boundary belongs in normal design prose, not Common Errors'],
  ]],
]) {
  rejectText(path, patterns);
}

// Cause/effect design for Flow's troubleshooting index and first-run tutorial:
// C1 queued work, pending approval, live leases, dependency recovery, and bounded
//    execution converge through polling, re-evaluation, or terminalization; C2
//    Subject state and its state_entered Event commit through one unit of work;
// C3 startup configuration errors, a configuration-specific execution_gated
//    detail, open Attention with a remedy, and no_transition need external action;
// C4 an unresolved external condition needs stable identifiers and redaction.
// E1 C1 is absent from troubleshooting rows; E2 C2 has no invented projection
// repair action; E3 C3 stays as exact observable evidence plus a public action;
// E4 C4 yields a small safe evidence bundle on every retained Flow runbook.
// Decision table: G1 automatic/expected => exclude; G2 atomic invariant with no
// public repair route => exclude; G3 surfaced error + public correction => keep;
// G4 retained correction without evidence/redaction => reject.
for (const [path, patterns] of [
  [join(docsRoot, 'flow/current/en/troubleshooting.md'), [
    [/\| Issue will not dispatch \||\| WorkUnit stays queued \||\| WorkUnit is active with no progress \||\| Tool is pending \||\| Pack type is not ready \|/, 'automatic or expected Flow states must stay out of troubleshooting'],
    [/repair (?:or rebuild )?(?:the )?projection|patch (?:the )?view/i, 'Flow troubleshooting must not invent a public projection repair path'],
  ]],
  [join(docsRoot, 'flow/current/zh/troubleshooting.md'), [
    [/\| Issue 不 dispatch \||\| WorkUnit 一直 queued \||\| WorkUnit active 但无进展 \||\| Tool pending \||\| Pack type not ready \|/, '自动或预期的 Flow 状态不得写成故障排查'],
    [/修复或重建 projection|修复 projection|重建 projection|修补查询视图/, 'Flow 故障排查不得虚构公共 projection 修复路径'],
  ]],
  [join(docsRoot, 'flow/current/en/tutorials/first-agent-run.md'), [
    [/Timeline and Issue state disagree|repair or rebuild the projection/i, 'Subject state and timeline commit atomically and have no public projection repair step'],
  ]],
  [join(docsRoot, 'flow/current/zh/tutorials/first-agent-run.md'), [
    [/timeline 与 Issue state 不一致|修复或重建 projection/, 'Subject state 与 timeline 原子提交，不存在公共 projection 修复步骤'],
  ]],
  [join(docsRoot, 'flow/current/en/how-to/create-and-follow-an-issue.md'), [
    [/\| \*\*Create issue\*\* is disabled \||\| Issue cannot dispatch \|/, 'form preconditions and readiness-gated scheduling are not troubleshooting failures'],
  ]],
  [join(docsRoot, 'flow/current/zh/how-to/create-and-follow-an-issue.md'), [
    [/\| \*\*Create issue\*\* 不可用 \||\| Issue 无法 dispatch \|/, '表单前置条件与 readiness-gated scheduling 不是故障'],
  ]],
  [join(docsRoot, 'flow/current/en/how-to/stuck-runs.md'), [
    [/\/api\/issues\/\{id\}\/attention(?!-signals)|\/api\/scopes\/\{scope\}\/workers/, 'intervention guide must use the public diagnosis, Attention, and fleet routes'],
    [/resolve backlog, dependencies|inspect the selected WorkUnit's[\s\S]*lease/i, 'automatic scheduling and lease convergence must not become manual repair'],
  ]],
  [join(docsRoot, 'flow/current/zh/how-to/stuck-runs.md'), [
    [/\/api\/issues\/\{id\}\/attention(?!-signals)|\/api\/scopes\/\{scope\}\/workers/, '干预指南必须使用公共 diagnosis、Attention 与 fleet route'],
    [/解决 backlog、dependency|检查所选 WorkUnit[\s\S]*lease/, '自动 scheduling 与 lease 收敛不得变成人工修复'],
  ]],
]) {
  rejectText(path, patterns);
}
for (const [path, patterns] of [
  ...[
    'troubleshooting.md',
    'how-to/stuck-runs.md',
    'how-to/create-and-follow-an-issue.md',
    'how-to/cycles.md',
    'tutorials/first-agent-run.md',
  ].map((page) => [join(docsRoot, `flow/current/en/${page}`), [
    [/correlation ID/, 'retained Flow troubleshooting must name stable support evidence'],
    [/(?:Do not include|Remove)\s+(?:tokens|credentials)/, 'retained Flow troubleshooting must state a redaction boundary'],
  ]]),
  ...[
    'troubleshooting.md',
    'how-to/stuck-runs.md',
    'how-to/create-and-follow-an-issue.md',
    'how-to/cycles.md',
    'tutorials/first-agent-run.md',
  ].map((page) => [join(docsRoot, `flow/current/zh/${page}`), [
    [/correlation ID/, '保留的 Flow 故障排查必须给出稳定的支持证据'],
    [/(?:不要附带|分享前(?:先)?删除)\s+(?:token|credential)/, '保留的 Flow 故障排查必须说明脱敏边界'],
  ]]),
]) {
  requireText(path, patterns);
}

// Cause/effect design for Run-recovery documentation:
// C1 a lease, wake, stream, or response can fail while durable state remains
//    recoverable; C2 retry exhaustion reaches the shared fenced terminal path;
// C3 a maintainer can explicitly quarantine exhausted work; C4 an external tool
//    effect can remain indeterminate after every internal state path converges.
// E1 C1 and C2 are explained as automatic behavior, not troubleshooting tasks;
// E2 C3 is reachable only through the public quarantine/list/requeue/purge routes;
// E3 C4 requires reconciliation before replay; E4 API reference remains the one
// route-list owner while the concept page owns the decision boundary.
// Decision table: R1 C1 => no action; R2 C2 => Ended(Indeterminate), no automatic
// dead letter; R3 C3 => explicit dead letter plus public repair route; R4 C4 =>
// stop and reconcile. Any internal method name, nonexistent route, duplicate
// post-dispatch fault matrix, or automatic-dead-letter claim rejects the docs.
for (const locale of ['en', 'zh']) {
  const platform = join(docsRoot, `platform/current/${locale}`);
  const reliability = join(platform, 'concepts/production-reliability.md');
  const execution = join(platform, 'concepts/configuration-to-execution.md');
  requireText(reliability, locale === 'en' ? [
    [/no terminal error[\s\S]*Do not repair or duplicate the Run/, 'automatic lease and wake recovery must not become an intervention task'],
    [/retry budget is exhausted[\s\S]*Ended\(Indeterminate\)[\s\S]*does not create a dead letter/, 'retry exhaustion must preserve automatic terminalization'],
    [/explicit maintenance decision[\s\S]*Public HTTP API[\s\S]*single[\s\S]*exact quarantine/, 'manual quarantine detail must delegate to the one API route owner'],
    [/external system[\s\S]*Reconcile the original business operation/, 'indeterminate external effects must stop before replay'],
  ] : [
    [/没有终态错误[\s\S]*不要修复或复制/, '自动 lease 与 wake 恢复不得成为人工排查任务'],
    [/retry budget 耗尽[\s\S]*Ended\(Indeterminate\)[\s\S]*不会产生 dead letter/, 'retry budget 耗尽必须保持自动终态语义'],
    [/显式维护决定[\s\S]*公共 HTTP API[\s\S]*唯一说明/, '人工隔离细节必须交给唯一 API 路由所有者'],
    [/外部系统[\s\S]*核对原业务 operation/, '无法判断的外部副作用必须先核对再重试'],
  ]);
  rejectText(reliability, [
    [/dead_letters\(\)|requeue\(run_id\)/, `${locale} reliability page exposes internal repository methods instead of public operations`],
    [/\/(?:v1\/durable\/threads\/\{thread\}\/)?(?:quarantine-retry-exhausted|dead-letters)/, `${locale} reliability concept duplicates exact routes owned by the API reference`],
    [/(?:enters? (?:a )?dead[- ]letter|进入 dead[- ]letter|达到上限后进入 dead[- ]letter)/i, `${locale} reliability page presents explicit quarantine as automatic retry behavior`],
  ]);
  requireText(execution, locale === 'en' ? [
    [/^## Act only on errors surfaced before dispatch/m, 'execution concept must limit intervention to surfaced pre-dispatch errors'],
    [/claim loss[\s\S]*handled by the queue[\s\S]*Production reliability/, 'execution concept must delegate automatic post-dispatch recovery'],
  ] : [
    [/^## 只处理 dispatch 之前明确返回的错误/m, '执行概念必须把人工介入限制在明确的 dispatch 前错误'],
    [/claim 丢失[\s\S]*自动处理[\s\S]*生产可靠性/, '执行概念必须把 dispatch 后自动恢复交给可靠性页'],
  ]);
  rejectText(execution, [
    [/^## (?:Failure and retry matrix|失败与重试矩阵)$/m, `${locale} execution concept must not duplicate the recovery matrix`],
    [/(?:recovered, dead-lettered|recovered、dead-lettered)/, `${locale} execution concept retains the incorrect automatic dead-letter outcome`],
  ]);
}

// Cause/effect design for the standalone Worker documentation path:
// C1 `awaken worker` is rejected by the product launcher; C2 `awaken-worker`
// accepts one strict Worker schema; C3 product-launcher warm-pool, proxy,
// package-builder, and wake fields are unknown to that standalone schema.
// E1 every launch command names the real binary; E2 the reference exposes one
// exact Worker field owner; E3 Sandbox instructions do not create a second,
// permissive configuration path. Decision table: W1 standalone binary + strict
// subset => accept; W2 retired subcommand or copied launcher-only fields => reject.
for (const locale of ['en', 'zh']) {
  const rootPath = join(docsRoot, `platform/current/${locale}`);
  requireText(join(rootPath, 'how-to/self-host.md'), [
    [/awaken-worker --config \/etc\/awaken\/worker\.toml --server/, 'self-hosting must start the real standalone Worker binary'],
  ]);
  requireText(join(rootPath, 'how-to/self-host.md'), locale === 'en' ? [
    [/known pending Run[\s\S]*GET \/readyz[\s\S]*\/dispatches[\s\S]*idle Worker[\s\S]*healthy/, 'self-host troubleshooting must distinguish an ineligible pending Run from healthy idleness'],
  ] : [
    [/已知 pending Run[\s\S]*GET \/readyz[\s\S]*\/dispatches[\s\S]*Worker 空闲[\s\S]*正常状态/, '自托管排查必须区分不符合条件的 pending Run 与正常空闲'],
  ]);
  requireText(join(rootPath, 'reference/configuration.md'), locale === 'en' ? [
    [/awaken-worker --config <path>[\s\S]*strict schema[\s\S]*standalone Worker[\s\S]*strict Worker schema rejects unknown keys/, 'configuration reference must separate the strict Worker schema from product-launcher fields'],
  ] : [
    [/awaken-worker --config <path>[\s\S]*严格 schema[\s\S]*独立 Worker[\s\S]*严格的 Worker schema 会拒绝未知 key/, '配置参考必须区分严格 Worker schema 与 product-launcher field'],
  ]);
  requireText(join(rootPath, 'how-to/configure-sandbox-tiers.md'), locale === 'en' ? [
    [/Choose the boundary[\s\S]*awaken-worker --config[\s\S]*awaken config --json[\s\S]*Verify fail-closed behavior/, 'Sandbox task must choose, validate, exercise, and fail closed through the real binaries'],
  ] : [
    [/选择边界[\s\S]*awaken-worker --config[\s\S]*awaken config --json[\s\S]*验证 fail-closed 行为/, 'Sandbox 任务必须通过真实 binary 完成选择、校验、运行与 fail closed'],
  ]);
}

// Cause/effect design for adjacent Agent-authoring and frontend-integration tasks:
// C1: a natural-language request can omit the Agent ID, finish line, allowed
//     capabilities, or approval boundary and still produce a syntactically valid draft.
// C2: AI SDK's client-side `id` is not automatically Awaken's request `threadId`.
// C3: CopilotKit `runtimeUrl` addresses Copilot Runtime, not a raw AG-UI run route.
// C4: a transient browser stream or server log can be mistaken for durable completion.
// C5: a local browser example can be copied to production with a Workspace
//     service key or without an application-scoped authorization boundary.
// E1: the author reviews one saved draft and explicitly publishes its exact diff.
// E2: every AI SDK turn sends the stable thread ID in the request body.
// E3: local CopilotKit uses HttpAgent, while production connection choices retain
//     their authentication, licensing, and proxy boundaries.
// E4: both frontend tasks finish by reading the same committed thread history.
// E5: production browser paths use a short-lived token bound to one authorized
//     Session; provider credentials and Workspace service keys stay server-side.
// Constraint: schema fields and full route/event catalogs remain in their existing
// reference owners. Decision table: F1 accepts prompt, review, and publish; F2
// accepts request-body identity plus committed replay; F3 accepts HttpAgent plus
// the local/production boundary and committed replay. Any missing effect rejects
// the corresponding bilingual task.
for (const locale of ['en', 'zh']) {
  const rootPath = join(docsRoot, `platform/current/${locale}/how-to`);
  const assistantPath = join(rootPath, 'build-an-agent-with-the-assistant.md');
  const aiSdkPath = join(rootPath, 'integrate-ai-sdk-frontend.md');
  const copilotKitPath = join(rootPath, 'integrate-copilotkit-ag-ui.md');
  requireText(assistantPath, locale === 'en' ? [
    [/Create an unpublished Agent with display name Support Triage and stable ID support-triage[\s\S]*Save and[\s\S]*do not publish[\s\S]*Open in editor[\s\S]*Check draft[\s\S]*Review & publish/, 'Assistant task must carry one human-readable name and stable identity through saved-draft review and explicit publication'],
    [/clean validation result[\s\S]*does not[\s\S]*behavior is good enough/, 'Assistant task must not equate configuration validation with behavior quality'],
  ] : [
    [/创建一个显示名称为 Support Triage、稳定 ID 为 support-triage 的未发布 Agent[\s\S]*保存并校验草稿[\s\S]*不要发布[\s\S]*在编辑器打开[\s\S]*检查草稿[\s\S]*审阅并发布/, 'Assistant 任务必须把人类可读名称、稳定标识和明确意图贯穿草稿保存、审阅与显式发布'],
    [/校验通过[\s\S]*不表示 Agent 的行为已经适合/, 'Assistant 任务不得把配置校验等同于行为质量'],
  ]);
  requireText(aiSdkPath, locale === 'en' ? [
    [/useChat\(\{ id \}\)[\s\S]*request body's `threadId`[\s\S]*prepareSendMessagesRequest[\s\S]*body: \{ threadId, messages \}/, 'AI SDK task must distinguish client ID and send Awaken thread identity in the body'],
    [/\/v1\/ai-sdk\/threads\/support-demo-1\/messages[\s\S]*returned `items`[\s\S]*committed/, 'AI SDK task must verify the committed thread rather than logs alone'],
    [/short-lived application[\s\S]*thread\.run[\s\S]*thread\.messages\.read[\s\S]*service keys never belong in frontend code/, 'AI SDK task must keep production browser access Session-bound and least-scope'],
  ] : [
    [/useChat\(\{ id \}\)[\s\S]*请求体的[\s\S]*`threadId`[\s\S]*prepareSendMessagesRequest[\s\S]*body: \{ threadId, messages \}/, 'AI SDK 任务必须区分客户端 ID，并在请求体发送 Awaken thread 身份'],
    [/\/v1\/ai-sdk\/threads\/support-demo-1\/messages[\s\S]*返回的 `items`[\s\S]*已经提交/, 'AI SDK 任务必须验证已提交 thread，而不是只看日志'],
    [/短期 application access token[\s\S]*thread\.run[\s\S]*thread\.messages\.read[\s\S]*service key[\s\S]*不得进入前端代码/, 'AI SDK 任务必须让生产浏览器访问绑定 Session 且保持最小权限'],
  ]);
  requireText(copilotKitPath, locale === 'en' ? [
    [/agents__unsafe_dev_only[\s\S]*selfManagedAgents[\s\S]*runtimeUrl[\s\S]*does not point directly[\s\S]*new HttpAgent/, 'CopilotKit task must separate local direct, production direct, and Runtime proxy paths'],
    [/\/v1\/ag-ui\/threads\/copilotkit-demo-1\/messages[\s\S]*returned `items`[\s\S]*committed/, 'CopilotKit task must verify the committed thread rather than logs alone'],
    [/short-lived[\s\S]*application access token[\s\S]*authorized Session binding[\s\S]*Workspace service keys may not/, 'CopilotKit task must keep production direct access Session-bound and least-scope'],
  ] : [
    [/agents__unsafe_dev_only[\s\S]*selfManagedAgents[\s\S]*runtimeUrl[\s\S]*不能直接指向[\s\S]*new HttpAgent/, 'CopilotKit 任务必须区分本地直连、生产直连与 Runtime 代理路径'],
    [/\/v1\/ag-ui\/threads\/copilotkit-demo-1\/messages[\s\S]*返回的 `items`[\s\S]*已经提交/, 'CopilotKit 任务必须验证已提交 thread，而不是只看日志'],
    [/短期 application access token[\s\S]*已授权 Session binding[\s\S]*Workspace service key 不可以/, 'CopilotKit 任务必须让生产直连访问绑定 Session 且保持最小权限'],
  ]);
}

// Cause/effect design for the three adjacent Platform tasks changed together:
// C1: save and validate use different Agent payloads, so a passing validation
//     does not describe the draft that will be published.
// C2: Session controls are presented without their lifecycle consequences.
// C3: an operator splits roles before proving the smaller topology or omits the
//     before-traffic and rollback decisions.
// E1: one named file feeds PUT and validation before explicit publication.
// E2: continue, interrupt, archive, and post-archive work map to visible results.
// E3: self-hosting starts with a stopping-point choice and ends with verification
//     plus a bounded rollback path.
// Constraint: exact Agent fields, Session state, and deployment keys remain with
// their existing reference owners. Decision table: P1 accepts the single-payload
// Agent sequence; P2 accepts all four Session choices; P3 accepts smallest-first
// deployment plus verify/rollback. Any missing effect rejects the documentation.
for (const locale of ['en', 'zh']) {
  const rootPath = join(docsRoot, `platform/current/${locale}/how-to`);
  const configurePath = join(rootPath, 'configure-agent-behavior.md');
  const sessionPath = join(rootPath, 'manage-a-session.md');
  const selfHostPath = join(rootPath, 'self-host.md');
  requireText(configurePath, locale === 'en' ? [
    [/Save this payload as `agent\.json`[\s\S]*-X PUT[\s\S]*-d @agent\.json[\s\S]*\/validate[\s\S]*-d @agent\.json[\s\S]*\/publish/, 'Agent task must save and validate one payload before publication'],
    [/Build → Skills & MCP[\s\S]*Ask before use[\s\S]*Allow without asking[\s\S]*New tools discovered[\s\S]*Custom Tool[\s\S]*calling application executes it/, 'Agent task must cover MCP ToolSet defaults and the Custom Tool execution owner'],
  ] : [
    [/保存为 `agent\.json`[\s\S]*-X PUT[\s\S]*-d @agent\.json[\s\S]*\/validate[\s\S]*-d @agent\.json[\s\S]*\/publish/, 'Agent 任务必须先保存并校验同一份 payload，再发布'],
    [/构建 → Skills 与 MCP[\s\S]*使用前询问[\s\S]*无需询问即可使用[\s\S]*后续发现[\s\S]*Custom Tool[\s\S]*调用方应用负责执行/, 'Agent 任务必须覆盖 MCP ToolSet 默认值与 Custom Tool 执行责任'],
  ]);
  requireText(sessionPath, locale === 'en' ? [
    [/What you need now[\s\S]*start or continue work[\s\S]*stop active work[\s\S]*keep history but block new input[\s\S]*work again after archive/, 'Session task must map all four operator choices to outcomes'],
  ] : [
    [/现在要做什么[\s\S]*开始或继续工作[\s\S]*停止活跃工作[\s\S]*保留历史但禁止新输入[\s\S]*归档后再次开始工作/, 'Session 任务必须把四种操作选择映射到结果'],
  ]);
  requireText(selfHostPath, locale === 'en' ? [
    [/Choose where to stop[\s\S]*local AllInOne[\s\S]*hardened AllInOne[\s\S]*split services[\s\S]*## Verify[\s\S]*Roll back a split deployment/, 'self-host task must choose the smallest topology and retain verification plus rollback'],
  ] : [
    [/选择在哪里停下[\s\S]*本地 AllInOne[\s\S]*加固后的 AllInOne[\s\S]*拆分服务[\s\S]*## 验证[\s\S]*回滚拆分部署/, '自托管任务必须选择最小拓扑，并保留验证与回滚'],
  ]);
}

// Cause/effect design for one searchable and machine-readable documentation
// corpus:
// C1: search maintains a second title or URL registry and drifts from routes.
// C2: English and Chinese endpoints use different index builders.
// C3: result rendering injects indexed text as HTML.
// C4: keyboard and navigation controls have no accessible names.
// C5: an llms.txt endpoint hand-maintains another corpus.
// E1: index records derive from the content collection and docsRoutes.
// E2: both endpoints remain thin locale adapters over one builder.
// E3: indexed strings render with textContent.
// E4: search, header, sidebar, mobile product nav, and TOC are named.
// E5: both llms.txt endpoints project the same records as search.
// Decision rules S1-S5 require all five properties and reject a parallel index
// dependency, hand-maintained corpus, or locale drift.
const docsSearchPath = join(root, 'src/lib/docsSearch.ts');
requireText(docsSearchPath, [
  [/buildDocsSearchIndex[\s\S]*parseId\(entry\.id\)[\s\S]*urlSlug\(parsed\)[\s\S]*entry\.body/, 'search index must derive records and routes from the docs collection'],
  [/buildDocsLlmIndex[\s\S]*buildDocsSearchIndex\(entries, lang\)/, 'machine-readable index must project the shared search corpus'],
]);
for (const route of [
  join(root, 'src/pages/docs/search-index.json.ts'),
  join(root, 'src/pages/[lang]/docs/search-index.json.ts'),
]) {
  requireText(route, [[/getCollection\('docs'\)[\s\S]*buildDocsSearchIndex/, 'search endpoint must delegate to the shared collection index']]);
}
for (const route of [
  join(root, 'src/pages/docs/llms.txt.ts'),
  join(root, 'src/pages/[lang]/docs/llms.txt.ts'),
]) {
  requireText(route, [[/getCollection\('docs'\)[\s\S]*buildDocsLlmIndex/, 'llms.txt endpoint must delegate to the shared collection index']]);
}
requireText(docsShellPath, [
  [/data-docs-search-open[\s\S]*data-docs-search[\s\S]*aria-labelledby="docs-search-title"/, 'DocsShell must expose an accessible search dialog'],
  [/fetch\(dialog\.dataset\.indexUrl/, 'search must load the locale index'],
  [/replaceChildren\(\)[\s\S]*textContent = record\.title/, 'search must render indexed text without HTML injection'],
  [/aria-label=\{copy\.header\}[\s\S]*label=\{copy\.sidebar\}[\s\S]*aria-label=\{copy\.productDocs\}[\s\S]*label=\{copy\.mobileNav\}[\s\S]*aria-label=\{copy\.mobileToc\}[\s\S]*aria-label=\{copy\.toc\}/, 'DocsShell must name every desktop and mobile navigation region from the locale catalog'],
]);
const docsNavigationPath = join(root, 'src/components/DocsNavigation.astro');
requireText(docsNavigationPath, [
  [/<nav class=\{compact[\s\S]*aria-label=\{label\}/, 'shared documentation navigation must apply the caller-owned accessible name'],
  [/groupContainsActive[\s\S]*<details open=\{groupContainsActive\(group\)\}[\s\S]*class="group\/nav"/, 'sidebar must expand only the current reader stage from the canonical navigation'],
]);

// Cause/effect design for the canonical Managed onboarding journey:
// C1: setup can bypass Provider Connection and create a second credential path.
// C2: a quickstart can stop at object creation without proving streamed work,
//     an idle terminal state, or committed replay after restart.
// C3: reference prose can copy the generated management schema by hand.
// E1: one Provider Connection command owns credential and endpoint writes.
// E2: the official SDK example covers Session create, event send, stream completion,
//     and durable history in both locales.
// E3: reference pages link to the generated artifact and operational limits.
// Decision table: O1 accepts the single Provider write owner; O2 accepts the
// complete SDK lifecycle plus a non-prescriptive install and named validation
// record; O3 accepts generated-schema delegation plus explicit
// failure, retry, budget, capture, and erasure contracts. Missing any effect
// rejects the corresponding localized journey.
for (const locale of ['en', 'zh']) {
  const platform = join(docsRoot, 'platform/current', locale);
  requireText(join(platform, 'get-started.md'), locale === 'en' ? [
    [/npm install @anthropic-ai\/sdk[\s\S]*validated with TypeScript SDK 0\.122\.0[\s\S]*not a dependency requirement/, `${locale} quickstart must separate the validation record from customer SDK choice`],
    [/Provider connection[\s\S]*events\.stream[\s\S]*events\.send[\s\S]*session\.status_idle/i, `${locale} quickstart must preserve the canonical streamed Session lifecycle`],
    [/restart[\s\S]*(?:committed events|committed event list|same history)/i, `${locale} quickstart must verify durable replay after restart`],
  ] : [
    [/npm install @anthropic-ai\/sdk[\s\S]*TypeScript SDK 0\.122\.0[\s\S]*不是依赖要求/, `${locale} quickstart must separate the validation record from customer SDK choice`],
    [/(?:供应商连接|provider connection)[\s\S]*events\.stream[\s\S]*events\.send[\s\S]*session\.status_idle/i, `${locale} quickstart must preserve the canonical streamed Session lifecycle`],
    [/重启[\s\S]*(?:已提交 events|已提交 event list|同一段历史)/i, `${locale} quickstart must verify durable replay after restart`],
  ]);
  requireText(join(platform, 'how-to/configure-providers-models-credentials.md'), [
    [/Provider Connection[\s\S]*(?:only authoring command|唯一写入命令)/i, `${locale} provider guide must name the single write owner`],
    [/\/v1\/config\/provider-connections[\s\S]*\/v1\/config\/executable-models/, `${locale} provider guide must verify connection and executable-model readiness`],
  ]);
  requireText(join(platform, 'reference/management-openapi.md'), [
    [/contracts\/openapi\.generated\.json[\s\S]*openapi_contract/, `${locale} management reference must delegate to the generated contract and parity test`],
  ]);
  requireText(join(platform, 'reference/operational-contracts.md'), [
    [/(?:300|three hundred)[\s\S]*(?:1200|1,200)[\s\S]*budget_reached[\s\S]*(?:retry|重试)[\s\S]*(?:erasure|删除)/i, `${locale} operational reference must cover limits, budgets, retry, and erasure`],
  ]);
}

// Cause/effect design for the five adjacent Platform contract references:
// C1: a route index can grow into a second hand-maintained schema catalog.
// C2: a raw generator command can update OpenAPI alone and bypass the complete
//     contract bundle or its mounted-router parity gate.
// C3: a model or credential failure can be documented as permission for Runtime
//     to search the catalog, inspect environment, or silently change candidates.
// C4: reconnect, retry success, budget stop, capture policy, erasure replay, or
//     ordinary retry exhaustion can be misclassified as an incident.
// C5: Console form state can be presented as a second configuration authority.
// C6: registration can fail after publication storage succeeds, which can be
//     mistaken for a partial Console write or a reason to delete durable state.
// E1: API readers select an owning contract while the route index stays unique.
// E2: the complete generation script and bidirectional parity test gate consumers.
// E3: configuration changes end in explicit publication; automatic retry and
//     frozen fallback remain normal behavior and execution never reselects.
// E4: the operational page separates no-action results from only those surfaced
//     outcomes an external maintainer can correct safely.
// E5: Console and automation use one save/validate/publish lifecycle, with
//     rejected writes leaving no partial Console-only state.
// E6: a retryable registration outage reuses the durable fingerprint and startup
//     recovery replays it; a conflict remains fail-closed with diagnostic facts.
// Constraint: exact fields, routes, procedures, compatibility, and protocol
// payloads remain with their existing owners. Decision table: R1 accepts E1;
// R2 accepts E2; R3 accepts E3; R4 accepts E4; R5 accepts E5; R6 accepts E6. A
// missing effect rejects the corresponding bilingual reference page.
for (const locale of ['en', 'zh']) {
  const reference = join(docsRoot, 'platform/current', locale, 'reference');
  requireText(join(reference, 'api.md'), locale === 'en' ? [
    [/Find the contract you need[\s\S]*official Managed Agents SDK[\s\S]*generated OpenAPI contract[\s\S]*No dead-letter repair[\s\S]*Quarantine, requeue, and purge/, 'API reference must route by task and keep ordinary retry exhaustion out of repair'],
  ] : [
    [/找到需要的契约[\s\S]*官方 Managed Agents SDK[\s\S]*生成的 OpenAPI 契约[\s\S]*不需要 dead-letter 修复[\s\S]*Quarantine、requeue 与 purge/, 'API 参考必须按任务分流，并避免把普通 retry exhaustion 写成修复流程'],
  ]);
  requireText(join(reference, 'management-openapi.md'), locale === 'en' ? [
    [/scripts\/contract\/generate-contracts\.sh --check[\s\S]*Static generation chain[\s\S]*scripts\/contract\/generate-contracts\.sh[\s\S]*change-gate failures/, 'management contract must use one complete generator and classify parity failures as change gates'],
  ] : [
    [/scripts\/contract\/generate-contracts\.sh --check[\s\S]*静态生成链[\s\S]*scripts\/contract\/generate-contracts\.sh[\s\S]*变更门禁/, '管理契约必须使用完整 generator，并把 parity failure 归为变更门禁'],
  ]);
  requireText(join(reference, 'provider-model-config.md'), locale === 'en' ? [
    [/Decide where the change belongs[\s\S]*temporary attempt fails and retry succeeds[\s\S]*frozen fallback candidate succeeds[\s\S]*Do not search the global catalog/, 'model contract must map change ownership and preserve automatic retry without runtime reselection'],
  ] : [
    [/先决定应该修改哪里[\s\S]*暂态 attempt 失败[\s\S]*已冻结的 fallback candidate 成功[\s\S]*不要为了让某个 Run 继续而搜索全局 catalog/, '模型契约必须映射变更所有权，并保留自动重试而不允许 runtime reselection'],
  ]);
  requireText(join(reference, 'operational-contracts.md'), locale === 'en' ? [
    [/Decide whether to act[\s\S]*429 rate_limit_error[\s\S]*stream disconnect[\s\S]*session\.budget_reached[\s\S]*retry exhaustion[\s\S]*lower-than-requested content capture[\s\S]*repeated erasure receipt[\s\S]*400 invalid_request_error[\s\S]*409[\s\S]*503 api_error[\s\S]*explicit dead letter/, 'operational contract must separate automatic or intentional outcomes from externally correctable results'],
  ] : [
    [/先判断是否需要动作[\s\S]*429 rate_limit_error[\s\S]*stream 断开[\s\S]*session\.budget_reached[\s\S]*retry exhaustion[\s\S]*内容采集低于 requested level[\s\S]*重复的 erasure receipt[\s\S]*400 invalid_request_error[\s\S]*409[\s\S]*503 api_error[\s\S]*显式 dead letter/, '运维契约必须区分自动或有意结果与外部可修正结果'],
  ]);
  requireText(join(reference, 'admin-console.md'), locale === 'en' ? [
    [/Use the Console[\s\S]*Use the management API[\s\S]*same Workspace-scoped services[\s\S]*save AgentConfig draft[\s\S]*publish reviewed revision[\s\S]*401 authentication_error[\s\S]*403 permission_error[\s\S]*503 agent_registration_unavailable[\s\S]*reuses the durable fingerprint[\s\S]*startup recovery[\s\S]*409 agent_registration_conflict[\s\S]*Do not repair domain storage/, 'Console reference must keep one lifecycle and explain post-storage registration recovery without direct store repair'],
  ] : [
    [/使用 Console[\s\S]*使用管理 API[\s\S]*同一组 Workspace-scoped service[\s\S]*保存 AgentConfig 草稿[\s\S]*发布已审阅 revision[\s\S]*401 authentication_error[\s\S]*403 permission_error[\s\S]*503 agent_registration_unavailable[\s\S]*复用持久化 fingerprint[\s\S]*启动恢复[\s\S]*409 agent_registration_conflict[\s\S]*不要直接修复领域存储/, 'Console 参考必须共用一个生命周期，并说明写入后 registration recovery 而无需直接修复 store'],
  ]);
}

// Cause-effect design for the AI Workforce category boundary:
// C1: a vision-level “Operating System” claim can be presented as shipped.
// C2: “AI Worker” can collapse the Agent actor into the infrastructure Worker.
// C3: product entry pages can assign business acceptance to Awaken or Agent
//     execution to Flow, creating overlapping authorities.
// C4: a market report can compare only application vendors or only runtimes.
// E1: readers infer product surfaces and guarantees that do not exist.
// E2: product/API vocabulary loses the actor-versus-capacity distinction.
// E3: Flow and Awaken become competing work or execution systems.
// E4: strategy misses either enterprise control planes or infrastructure substitutes.
// Constraints: one public copy owner, one Agent execution owner, one work owner;
// the external report is required only when its path is passed to this check.
// Decision table: R1 rejects an unbounded vision label from public copy; R2 and
// R3 verify ownership in English and Chinese entry pages; R4 verifies C4/E4
// plus dated source discipline when a report artifact is supplied.

for (const [locale, platformPattern, flowPattern] of [
  ['en', /A Session records Agent execution; it does not[\s\S]*business acceptance record/, /Workforce is the work, responsibility, and outcome[\s\S]*Awaken[\s\S]*sole Agent execution and control/],
  ['zh', /Session 记录 Agent 执行[\s\S]*不代替业务验收记录/, /Workforce 是工作、责任与结果[\s\S]*Awaken[\s\S]*唯一 Agent 执行与控制/],
]) {
  requireText(join(docsRoot, `platform/current/${locale}/index.md`), [
    [platformPattern, `${locale} Awaken entry must preserve the cross-product AI Workforce boundary`],
  ]);
  requireText(join(docsRoot, `flow/current/${locale}/index.md`), [
    [flowPattern, `${locale} Flow entry must preserve the cross-product AI Workforce boundary`],
  ]);
}

const competitorReportPath = process.argv[2];
if (competitorReportPath) {
  const report = resolve(competitorReportPath);
  if (!existsSync(report)) failures.push(`${report}: requested competitor report is missing`);
  else requireText(report, [
    [/基准日期：2026-07-31/, 'competitor report must state its market snapshot date'],
    [/Microsoft Agent 365[\s\S]*OpenAI Frontier[\s\S]*Salesforce Agentforce[\s\S]*ServiceNow AI Control Tower/, 'report must cover direct enterprise control and digital-labor competitors'],
    [/Amazon Bedrock AgentCore[\s\S]*LangSmith[\s\S]*Temporal/, 'report must cover runtime and durable-execution substitutes'],
    [/## 5\. 能力对比矩阵[\s\S]*## 6\. AwakenWorks 的可防守定位[\s\S]*## 7\. 产品差距与优先级/, 'report must connect comparison to differentiation and product gaps'],
    [/资料原则[\s\S]*https:\/\//, 'report must state source discipline and include source links'],
  ]);
}

const versionRegistryPath = join(root, 'src/i18n/docsVersions.ts');
const versionRegistry = readFileSync(versionRegistryPath, 'utf8');
function registryRevision(product) {
  const match = new RegExp(`${product}: \\[\\{[\\s\\S]*?sourceRevision: '([0-9a-f]{40})'`).exec(versionRegistry);
  if (!match) failures.push(`src/i18n/docsVersions.ts: missing exact 40-character sourceRevision for ${product}`);
  return match?.[1];
}

// Version evidence is a committed input, not ambient workspace state. This
// makes the same candidate produce the same result in CI, a source archive, or
// a developer checkout with unrelated sibling repositories.
for (const [product, repository] of [['flow', provenance.repositories?.flow], ['platform', provenance.repositories?.awaken]]) {
  const documented = registryRevision(product);
  if (!repository) failures.push(`config/source-provenance.json: missing ${product} source evidence`);
  else if (documented && documented !== repository.revision) {
    failures.push(`src/i18n/docsVersions.ts: ${product} sourceRevision ${documented} does not match committed provenance ${repository.revision}`);
  }
}
if (!provenance.repositories?.awaken?.evidenceCoordinates?.length) {
  failures.push('config/source-provenance.json: Awaken evidence coordinates are empty');
}
const harnessRevision = registryRevision('harness');
const platformRevision = registryRevision('platform');
if (harnessRevision && platformRevision && harnessRevision !== platformRevision) {
  failures.push('src/i18n/docsVersions.ts: Harness and Platform must pin the same Awaken release authority');
}
if (!existsSync(distRoot)) failures.push('dist: missing; run the Astro build before this check');
else {
  // Generated-index decision table:
  // G1: every current localized source appears once -> accept.
  // G2: a source is absent/duplicated or locales expose different route suffixes
  //     -> reject.
  // G3: an indexed href has no generated page or includes internal market copy
  //     -> reject.
  // G4: llms.txt has a different record count or omits a search record -> reject.
  const generatedSearch = new Map();
  for (const [locale, indexPath] of [
    ['en', join(distRoot, 'docs/search-index.json')],
    ['zh', join(distRoot, 'zh/docs/search-index.json')],
  ]) {
    if (!existsSync(indexPath)) {
      failures.push(`${relative(root, indexPath)}: missing generated search index`);
      continue;
    }
    let records = [];
    try {
      records = JSON.parse(readFileSync(indexPath, 'utf8'));
    } catch {
      failures.push(`${relative(root, indexPath)}: search index is not valid JSON`);
      continue;
    }
    const expected = markdown.filter((path) => {
      const docsPath = relative(docsRoot, path);
      return docsPath.includes(`/current/${locale}/`);
    }).length;
    if (records.length !== expected) {
      failures.push(`${relative(root, indexPath)}: indexed ${records.length} records for ${expected} current ${locale} sources`);
    }
    const llmsPath = locale === 'zh'
      ? join(distRoot, 'zh/docs/llms.txt')
      : join(distRoot, 'docs/llms.txt');
    if (!existsSync(llmsPath)) {
      failures.push(`${relative(root, llmsPath)}: missing generated machine-readable index`);
    } else {
      const llmsText = readFileSync(llmsPath, 'utf8');
      const llmsRecords = [...llmsText.matchAll(/^- \[[^\]]+\]\([^)]+\): /gm)].length;
      if (llmsRecords !== records.length) {
        failures.push(`${relative(root, llmsPath)}: projected ${llmsRecords} records for ${records.length} search records`);
      }
      for (const record of records) {
        const absoluteHref = `https://awakenworks.com${record.href}`;
        if (!llmsText.includes(`[${record.title}](${absoluteHref}): ${record.description}`)) {
          failures.push(`${relative(root, llmsPath)}: missing shared index record ${record.href}`);
        }
      }
    }
    const hrefs = new Set();
    for (const record of records) {
      if (!record.title || !record.description || !record.href || !record.product || !record.text) {
        failures.push(`${relative(root, indexPath)}: search record is missing a required field`);
        continue;
      }
      if (hrefs.has(record.href)) failures.push(`${relative(root, indexPath)}: duplicate href ${record.href}`);
      hrefs.add(record.href);
      const prefixCorrect = locale === 'zh' ? record.href.startsWith('/zh/docs/') : record.href.startsWith('/docs/');
      if (!prefixCorrect) failures.push(`${relative(root, indexPath)}: wrong locale href ${record.href}`);
      const target = join(distRoot, record.href, 'index.html');
      if (!existsSync(target)) failures.push(`${relative(root, indexPath)}: missing indexed page ${record.href}`);
    }
    generatedSearch.set(locale, hrefs);
  }
  if (generatedSearch.has('en') && generatedSearch.has('zh')) {
    const enSuffixes = [...generatedSearch.get('en')].map((href) => href.replace(/^\/docs\//, '')).sort();
    const zhSuffixes = [...generatedSearch.get('zh')].map((href) => href.replace(/^\/zh\/docs\//, '')).sort();
    if (JSON.stringify(enSuffixes) !== JSON.stringify(zhSuffixes)) {
      failures.push('dist: English and Chinese search indexes must expose the same canonical route suffixes');
    }
  }

  let renderedDocPages = 0;
  const renderedTitles = new Map();
  const renderedCanonicals = new Map();
  const renderedHtmlPages = filesBelow(distRoot, (candidate) => candidate.endsWith('.html'));
  for (const path of renderedHtmlPages) {
    const html = readFileSync(path, 'utf8');
    const builtRelative = relative(distRoot, path);
    // Cause/effect design for the full rendered-route experience:
    // C1: a source template can build while omitting or duplicating its H1,
    //     title, description, or canonical URL on one generated route.
    // C2: shared document titles can collide across products or languages and
    //     make search results indistinguishable even when body headings differ.
    // C3: visitors may land on any route; a template without the shared
    //     GitHub event path loses the requested community-growth exit.
    // E1: every rendered route has one readable identity and one canonical URL.
    // E2: metadata remains distinct and descriptions state a complete purpose.
    // E3: every indexable route exposes a measurable GitHub Star path.
    // Decision table:
    // | Rule | Identity complete | Unique title/canonical | Star | Outcome |
    // | W1   | yes               | yes                    | yes  | accept  |
    // | W2   | no                | any                    | any  | reject  |
    // | W3   | yes               | no                     | any  | reject  |
    // | W4   | yes               | yes                    | no   | reject  |
    const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? '';
    const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1]?.trim() ?? '';
    const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1]?.trim() ?? '';
    const h1Count = [...html.matchAll(/<h1\b/g)].length;
    if (h1Count !== 1) failures.push(`${relative(root, path)}: rendered route must contain exactly one H1; found ${h1Count}`);
    if (!title) failures.push(`${relative(root, path)}: rendered route is missing a title`);
    if (description.length < 20 || description.length > 220) {
      failures.push(`${relative(root, path)}: rendered description must contain 20-220 characters; found ${description.length}`);
    }
    if (!canonical) failures.push(`${relative(root, path)}: rendered route is missing a canonical URL`);
    if (!html.includes('data-umami-event="github_star_selected"')) {
      failures.push(`${relative(root, path)}: route is missing a measurable GitHub Star path`);
    }
    if (builtRelative.startsWith('docs/') || builtRelative.startsWith('zh/docs/')) {
      for (const placement of ['docs-header', 'docs-mobile-nav']) {
        if (!html.includes(`data-umami-event-location="${placement}"`)) {
          failures.push(`${relative(root, path)}: docs route is missing the ${placement} GitHub Star path`);
        }
      }
    }
    if (title) renderedTitles.set(title, [...(renderedTitles.get(title) ?? []), builtRelative]);
    if (canonical) renderedCanonicals.set(canonical, [...(renderedCanonicals.get(canonical) ?? []), builtRelative]);

    if (html.includes('data-doc-purpose')) {
      renderedDocPages += 1;
      const neighborKinds = [...html.matchAll(/data-doc-neighbor="(previous|next)"/g)].map((match) => match[1]);
      // Cause/effect test design for every rendered page journey:
      // C1: a retained Markdown page renders without its purpose marker.
      // C2: currentHref is absent or duplicated in canonical navigation.
      // C3: an edge page has one neighbor; an interior page has two.
      // E1: every retained page exposes its purpose before the body.
      // E2: builds fail inside docsNeighbors instead of silently isolating a page.
      // E3: every page has a valid onward/backward path without duplicate direction.
      // Rules: J1=one unique neighbor is a journey edge; J2=previous+next is an
      // interior page; zero, more than two, or duplicate directions are rejected.
      if (neighborKinds.length < 1 || neighborKinds.length > 2 || new Set(neighborKinds).size !== neighborKinds.length) {
        failures.push(`${relative(root, path)}: rendered docs page must have one or two distinct canonical neighbors`);
      }
    }
    for (const match of html.matchAll(/href="([^"#?]+)[^"]*"/g)) {
      const href = match[1];
      if (!href.startsWith('/') || href.startsWith('//')) continue;
      const target = extname(href) ? join(distRoot, href) : join(distRoot, href, 'index.html');
      if (!existsSync(target)) failures.push(`${relative(root, path)}: broken internal link ${href}`);
    }
  }
  if (renderedDocPages !== markdown.length) {
    failures.push(`dist: rendered ${renderedDocPages} purpose-marked docs pages for ${markdown.length} Markdown sources`);
  }
  for (const [kind, values] of [['title', renderedTitles], ['canonical URL', renderedCanonicals]]) {
    for (const [value, paths] of values) {
      if (paths.length > 1) failures.push(`dist: duplicate rendered ${kind} ${JSON.stringify(value)} in ${paths.join(', ')}`);
    }
  }
}

// Cause/effect test design for Mermaid sequence syntax:
// C1: an ASCII semicolon terminates a sequence statement, so trailing prose is
//     parsed as a new and invalid statement.
// C2: a participant identifier can collide case-insensitively with a Mermaid
//     control keyword such as `loop`.
// C3: Astro can build the page before Mermaid parses it in the browser.
// E1: every repository-owned sequenceDiagram is accepted by the exact Mermaid
//     version installed for the site.
// E2: a syntax regression fails this canonical docs check with source and line.
// Decision table: R1 sequenceDiagram + valid grammar -> accept; R2
// sequenceDiagram + invalid grammar -> reject with location; R3 other Mermaid
// diagram type -> retain its existing renderer path and exclude it from this
// sequence-parser-specific gate.
const mermaidEntryDir = dirname(fileURLToPath(import.meta.resolve('mermaid')));
const mermaidChunkDir = join(mermaidEntryDir, 'chunks', 'mermaid.core');
const sequenceParserFiles = readdirSync(mermaidChunkDir).filter((name) =>
  /^sequenceDiagram-[A-Z0-9]+\.mjs$/u.test(name),
);
if (sequenceParserFiles.length !== 1) {
  failures.push(
    `mermaid: expected one installed sequence parser, found ${sequenceParserFiles.length}`,
  );
} else {
  try {
    const { diagram } = await import(
      pathToFileURL(join(mermaidChunkDir, sequenceParserFiles[0])).href
    );
    let sequenceDiagramCount = 0;
    const contentMarkdown = filesBelow(join(root, 'src/content'), (path) => extname(path) === '.md');
    for (const path of contentMarkdown) {
      const text = readFileSync(path, 'utf8');
      for (const match of text.matchAll(/```mermaid[^\S\r\n]*\r?\n([\s\S]*?)```/gu)) {
        const source = match[1];
        if (!source.trimStart().startsWith('sequenceDiagram')) continue;
        sequenceDiagramCount += 1;
        const fenceLine = text.slice(0, match.index).split('\n').length;
        try {
          diagram.db.clear();
          diagram.parser.yy = diagram.db;
          if (diagram.parser.parser) diagram.parser.parser.yy = diagram.db;
          diagram.parser.parse(source);
        } catch (error) {
          const reason = String(error?.str ?? error?.message ?? error).split('\n')[0];
          failures.push(
            `${relative(root, path)}:${fenceLine}: Mermaid sequence syntax error: ${reason}`,
          );
        }
      }
    }
    if (sequenceDiagramCount === 0) failures.push('mermaid: no sequenceDiagram blocks were checked');
  } catch (error) {
    failures.push(`mermaid: failed to load installed sequence parser: ${error?.message ?? error}`);
  }
}

if (failures.length) {
  process.stderr.write(`Documentation checks failed (${failures.length}):\n${failures.map((item) => `- ${item}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`Documentation checks passed: ${markdown.length} Markdown files and generated internal links.\n`);
