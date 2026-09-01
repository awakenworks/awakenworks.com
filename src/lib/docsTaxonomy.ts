// Navigation is organized by the reader's job, not by the repository folder
// that happens to contain a page. A section key is canonical; its localized
// label is derived only when the page is rendered.
import type { Lang } from '../i18n/locales';
export const DOC_SECTIONS = [
  'Start',
  'Build',
  'Connect',
  'Govern',
  'Operate',
  'Maintain',
  'Design',
  'Packs',
  'Use',
  'Understand',
  'Protocols',
  'Reference',
] as const;

export const DOC_AUDIENCES = ['manual', 'developer', 'operator', 'internals', 'reference'] as const;

export type DocsSection = (typeof DOC_SECTIONS)[number];
export type DocsAudience = (typeof DOC_AUDIENCES)[number];

// Public product naming has one owner. Navigation, search, metadata, and
// machine-readable indexes derive from this function instead of maintaining
// parallel product-label maps.
export function docsProductName(product: string): string {
  if (product === 'agents' || product === 'platform' || product === 'harness') return 'Awaken Agents';
  if (product === 'objects') return 'Awaken Objects';
  if (product === 'workforce' || product === 'flow') return 'Awaken Workforce';
  return 'AwakenWorks';
}

export const DOC_SECTION_LABELS: Record<DocsSection, Record<Lang, string>> = {
  Start: { en: 'Start', zh: '开始' },
  Build: { en: 'Build an Agent', zh: '构建 Agent' },
  Connect: { en: 'Connect an application', zh: '接入应用' },
  Govern: { en: 'Run and govern', zh: '运行与治理' },
  Operate: { en: 'Operate and recover', zh: '运营与恢复' },
  Maintain: { en: 'Contribute and extend', zh: '贡献与扩展' },
  Design: { en: 'Design and automate', zh: '设计与自动化' },
  Packs: { en: 'Build Domain Packs', zh: '构建 Domain Pack' },
  Use: { en: 'Manage work', zh: '管理工作' },
  Understand: { en: 'Understand', zh: '理解系统' },
  Protocols: { en: 'Protocols', zh: '协议' },
  Reference: { en: 'Reference', zh: '参考' },
};

export const DOC_AUDIENCE_LABELS: Record<DocsAudience, Record<Lang, string>> = {
  manual: { en: 'User manual', zh: '使用指南' },
  developer: { en: 'Developer guide', zh: '开发指南' },
  operator: { en: 'Operator guide', zh: '运营指南' },
  internals: { en: 'Internal mechanisms', zh: '内部机制' },
  reference: { en: 'Reference', zh: '参考' },
};

export function docSectionLabel(section: string, lang: Lang): string {
  return DOC_SECTION_LABELS[section as DocsSection]?.[lang] ?? section;
}

const DOC_SUBSECTION_ZH: Record<string, string> = {
  'API tutorial': 'API 教程',
  'Agent setup': '配置 Agent',
  Appendix: '附录',
  'Build Domain Packs': '构建 Domain Pack',
  'Connect applications': '接入应用',
  Contribute: '参与贡献',
  'Core model': '核心模型',
  'Decide and recover': '判断与恢复',
  Deployment: '部署',
  'Design work': '设计工作',
  Develop: '开发',
  'Everyday use': '日常使用',
  'Execution boundary': '执行边界',
  Extensions: '扩展',
  'Fleet operations': '集群运营',
  'Follow work': '跟进工作',
  'Governance and reliability': '治理与可靠性',
  'Manage work': '管理工作',
  Operations: '运行维护',
  'Plan work': '规划工作',
  'Resources and governance': '资源与治理',
  'State & Storage': '状态与存储',
  'System model': '系统模型',
  'Tune & Operate': '调优与运行',
  'Work model': '工作模型',
};

export function docSubsectionLabel(subsection: string, lang: Lang): string {
  return DOC_SUBSECTION_LABELS[lang][subsection] ?? subsection;
}

const DOC_SUBSECTION_LABELS: Record<Lang, Record<string, string>> = {
  en: {},
  zh: DOC_SUBSECTION_ZH,
};

// Audience is derived from the reader's task by default, while frontmatter may
// override a page whose implementation depth differs from its sidebar section.
// This keeps one content tree and one canonical page per fact instead of
// cloning Platform and Runtime material into parallel manuals.
export function docAudience(
  product: string,
  section?: string,
  explicit?: DocsAudience,
): DocsAudience {
  if (explicit) return explicit;
  if (section === 'Reference') return 'reference';
  if (product === 'harness') return 'internals';
  if (product === 'platform') {
    if (section === 'Start') return 'manual';
    if (section === 'Govern' || section === 'Operate') return 'operator';
    if (section === 'Understand' || section === 'Maintain') return 'internals';
    return 'developer';
  }
  if (product === 'flow') {
    if (section === 'Start' || section === 'Use' || section === 'Understand') {
      return 'manual';
    }
    if (section === 'Operate') return 'operator';
    if (section === 'Maintain') return 'internals';
    return 'developer';
  }
  return 'manual';
}

export function docAudienceLabel(audience: DocsAudience, lang: Lang): string {
  return DOC_AUDIENCE_LABELS[audience][lang];
}
