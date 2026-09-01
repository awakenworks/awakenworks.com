import { withSiteBase } from '../config/siteDeployment.mjs';

const urlProperties = ['href', 'src', 'poster', 'action'];

function prefixRawHtml(value, basePath) {
  return value.replace(
    /(\b(?:href|src|poster|action)=["'])(\/(?!\/)[^"']*)/gu,
    (_match, prefix, url) => `${prefix}${withSiteBase(url, basePath)}`,
  );
}

export default function prefixMarkdownSiteUrls({ basePath = '/' } = {}) {
  return function transform(tree) {
    const visit = (node) => {
      if (node?.type === 'element' && node.properties) {
        for (const property of urlProperties) {
          const value = node.properties[property];
          if (typeof value === 'string') {
            node.properties[property] = withSiteBase(value, basePath);
          }
        }
      } else if (node?.type === 'raw' && typeof node.value === 'string') {
        node.value = prefixRawHtml(node.value, basePath);
      }
      if (Array.isArray(node?.children)) node.children.forEach(visit);
    };
    visit(tree);
  };
}
