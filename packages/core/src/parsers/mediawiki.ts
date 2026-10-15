import { JSDOM } from "jsdom";

const MEDIAWIKI_HOSTS = [/(^|\.)wikipedia\.org$/, /(^|\.)wikimedia\.org$/, /(^|\.)wiktionary\.org$/];

export function isMediaWikiHost(hostname: string): boolean {
  return MEDIAWIKI_HOSTS.some((pattern) => pattern.test(hostname));
}

// MediaWiki's modern (Parsoid) rendering wraps each heading in
// <div class="mw-heading"><h2>Title</h2><span class="mw-editsection">
// [modifier]</span></div>. Readability's content-density scoring treats
// that wrapper div as boilerplate and drops it - heading and all - so
// every chunk ends up with no heading breadcrumb. Hoisting the heading
// out of its wrapper (and dropping the edit-section link) before handing
// the page to Readability keeps the headings intact.
export function preprocessMediaWikiHtml(html: string): string {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  for (const wrapper of document.querySelectorAll("div.mw-heading")) {
    wrapper.querySelectorAll(".mw-editsection").forEach((link) => link.remove());
    wrapper.replaceWith(...Array.from(wrapper.childNodes));
  }

  return dom.serialize();
}
