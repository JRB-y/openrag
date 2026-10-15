import { describe, expect, it } from "vitest";
import { isMediaWikiHost, preprocessMediaWikiHtml } from "./mediawiki.js";

describe("isMediaWikiHost", () => {
  it("matches Wikipedia and sibling MediaWiki hosts", () => {
    expect(isMediaWikiHost("fr.wikipedia.org")).toBe(true);
    expect(isMediaWikiHost("en.wikipedia.org")).toBe(true);
    expect(isMediaWikiHost("commons.wikimedia.org")).toBe(true);
    expect(isMediaWikiHost("fr.wiktionary.org")).toBe(true);
  });

  it("does not match unrelated hosts", () => {
    expect(isMediaWikiHost("example.com")).toBe(false);
    expect(isMediaWikiHost("notwikipedia.org")).toBe(false);
  });
});

describe("preprocessMediaWikiHtml", () => {
  it("hoists the heading out of its mw-heading wrapper", () => {
    const html = `
      <div class="mw-heading mw-heading2">
        <h2 id="Enjeux">Enjeux</h2>
        <span class="mw-editsection"><a href="#">modifier</a></span>
      </div>
      <p>Contenu de la section.</p>
    `;

    const result = preprocessMediaWikiHtml(html);

    expect(result).toContain("<h2 id=\"Enjeux\">Enjeux</h2>");
    expect(result).not.toContain("mw-heading");
  });

  it("drops the edit-section link alongside the wrapper", () => {
    const html = `
      <div class="mw-heading mw-heading3">
        <h3>Sous-section</h3>
        <span class="mw-editsection"><a href="#">modifier le code</a></span>
      </div>
    `;

    const result = preprocessMediaWikiHtml(html);

    expect(result).toContain("<h3>Sous-section</h3>");
    expect(result).not.toContain("modifier le code");
  });
});
