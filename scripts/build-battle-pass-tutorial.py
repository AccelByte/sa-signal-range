"""Render the approved Markdown as a portable, root-level HTML tutorial.

Build dependencies: markdown-it-py, beautifulsoup4, Pygments, Pillow.
Run from any directory: python scripts/build-battle-pass-tutorial.py
The output needs no server, JavaScript framework, or CDN.
"""

from __future__ import annotations

import html
import math
import re
from pathlib import Path
from urllib.parse import quote, urlsplit

from bs4 import BeautifulSoup
from markdown_it import MarkdownIt
from PIL import Image
from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import TextLexer, get_lexer_by_name
from pygments.util import ClassNotFound


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/sa-content-studio/content/battle-pass-tutorial.md"
OUTPUT = ROOT / "battle-pass-tutorial.html"
FORMATTER = HtmlFormatter(nowrap=True, style="monokai")


def slug(text: str) -> str:
    return re.sub(r"[^\w -]", "", text.lower()).replace(" ", "-")


def root_url(value: str) -> str:
    parts = urlsplit(value)
    if parts.scheme or parts.netloc or value.startswith("#"):
        return value
    target = (SOURCE.parent / parts.path).resolve()
    relative = target.relative_to(ROOT).as_posix()
    return quote(relative, safe="/-_.") + (f"#{parts.fragment}" if parts.fragment else "")


def syntax(code: str, language: str, _attrs: str) -> str:
    try:
        lexer = get_lexer_by_name(language) if language else TextLexer()
    except ClassNotFound:
        lexer = TextLexer()
    return highlight(code, lexer, FORMATTER)


CSS = r"""
:root{color-scheme:light;--ink:#172b3a;--muted:#5c6d78;--blue:#1457c4;--line:#dbe3e9;--paper:#fff;--canvas:#f5f7fa;--gold:#edd153;--dark:#14221b;--radius:10px}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:100px}body{margin:0;background:var(--canvas);color:var(--ink);font:17px/1.75 "Segoe UI",Arial,sans-serif}a{color:var(--blue);text-underline-offset:3px;overflow-wrap:anywhere}a:hover{text-decoration-thickness:2px}button,summary{font:inherit}button,a,summary{-webkit-tap-highlight-color:transparent}:focus-visible{outline:3px solid #e2b52e;outline-offset:4px}button{cursor:pointer}.skip-link{position:fixed;top:-80px;left:16px;z-index:99;background:white;padding:10px 16px;border:2px solid var(--blue)}.skip-link:focus{top:10px}
.site-header{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.97);border-top:4px solid var(--gold);border-bottom:1px solid var(--line)}.header-inner{max-width:1340px;margin:auto;padding:14px 32px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-size:17px;letter-spacing:.08em;font-weight:800;color:var(--ink);text-decoration:none}.brand small{font-size:10px;color:var(--muted);letter-spacing:.14em;display:block;line-height:1.4}.header-actions{display:flex;gap:18px;align-items:center;font-size:13px}.header-actions a{text-decoration:none}.plain-button{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:6px;padding:5px 12px;font-size:13px}.plain-button:hover{background:#edf2f7}
.layout{max-width:1340px;margin:auto;padding:48px 32px 80px;display:grid;grid-template-columns:222px minmax(0,1fr);gap:48px;align-items:start}.sidebar{position:sticky;top:100px;max-height:calc(100vh - 124px);overflow:auto;padding-right:12px}.toc summary{list-style:none;cursor:pointer;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:18px}.toc summary::-webkit-details-marker{display:none}.toc summary::after{content:" −"}.toc:not([open]) summary::after{content:" +"}.toc nav a{display:block;font-size:13px;line-height:1.45;text-decoration:none;color:var(--muted);padding:8px 10px;border-left:2px solid transparent;margin:0 0 3px}.toc nav a:hover{color:var(--blue);background:#eaf0f8}.toc nav a[aria-current=true]{color:var(--blue);border-left-color:var(--blue);background:#eaf0f8;font-weight:600}.sidebar-note{font-size:12px;line-height:1.6;color:var(--muted);border-top:1px solid var(--line);padding-top:18px;margin-top:20px}
.reader{min-width:0;background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);padding:48px 52px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--blue);margin:0 0 16px}.hero h1{font-size:clamp(34px,4vw,54px);line-height:1.12;letter-spacing:-.04em;margin:0 0 22px;color:#112735;font-weight:750}.subtitle{font-size:20px;line-height:1.55;color:var(--muted);margin:0 0 20px}.meta{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;line-height:1.5;color:var(--muted);padding-bottom:30px;border-bottom:1px solid var(--line);margin-bottom:32px}.meta span+span::before{content:"·";margin-right:12px}
article p{margin:0 0 20px}article ul,article ol{padding-left:25px;margin:0 0 25px}article li{padding-left:3px;margin:5px 0}article h2{font-size:29px;line-height:1.3;letter-spacing:-.025em;margin:64px 0 24px;padding-top:26px;border-top:1px solid var(--line);scroll-margin-top:96px}article h3{font-size:21px;line-height:1.4;letter-spacing:-.015em;margin:34px 0 16px;scroll-margin-top:96px}article h4{font-size:18px;margin:26px 0 12px}article strong{font-weight:650}article blockquote{border-left:3px solid var(--blue);padding:16px 20px;background:#edf4fe;margin:24px 0}article blockquote p:last-child{margin-bottom:0}article :not(pre)>code{font: .85em/1.5 Consolas,"Cascadia Code",monospace;background:#edf1f5;color:#174a72;border-radius:4px;padding:2px 5px;overflow-wrap:anywhere}
.table-wrap{overflow-x:auto;max-width:100%;margin:26px 0 30px;border:1px solid var(--line);border-radius:8px}table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.6;min-width:540px}th{background:#edf2f7;text-align:left;color:#253b4c;font-weight:650}th,td{padding:13px 15px;border-bottom:1px solid var(--line);vertical-align:top}tr:last-child td{border-bottom:0}tbody tr:nth-child(even){background:#fafbfd}td[style*="text-align:right"],th[style*="text-align:right"]{font-variant-numeric:tabular-nums}
.tutorial-figure{margin:32px 0 36px;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#f7f9fb}.tutorial-figure>a{display:block}.tutorial-figure img{width:100%;height:auto;display:block;background:#fff}.tutorial-figure a:hover img{opacity:.98}.tutorial-figure figcaption{font-size:12px;line-height:1.7;padding:14px 18px;color:#526471;background:#f5f8fb;border-top:1px solid var(--line)}.tutorial-figure figcaption strong{color:#243d4e}.image-hint{display:block;font-size:11px;color:var(--blue);margin-top:5px}.config-details,.video-demo{border:1px solid var(--line);border-radius:8px;margin:28px 0;background:#fafcfe}.config-details>summary,.video-demo>summary{font-size:14px;font-weight:650;padding:17px 18px;cursor:pointer;color:#23455c}.config-details[open]>summary,.video-demo[open]>summary{border-bottom:1px solid var(--line)}.config-details .tutorial-figure{margin:0;border:0;border-radius:0 0 8px 8px}.video-demo video{display:block;width:100%;aspect-ratio:16/9;background:#101812}.video-demo .video-caption{padding:16px 18px;font-size:13px;line-height:1.7;margin:0}.video-caption a{display:inline-block;margin-top:8px}
.code-block{margin:25px 0 30px;border-radius:8px;overflow:hidden;border:1px solid #2e3d43;background:#1d262d;color:#f4f4ef}.code-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 15px;background:#26323a;border-bottom:1px solid #39464b}.code-label{font:11px/1.5 Consolas,monospace;text-transform:uppercase;letter-spacing:.1em;color:#c8d5dc}.copy-code{color:#edf4f8;background:#33434d;border:1px solid #596c77;border-radius:4px;font-size:11px;padding:3px 10px;min-width:52px}.copy-code:hover{background:#445864}.code-block pre{margin:0;padding:21px 20px;overflow-x:auto;tab-size:2;font:13px/1.8 Consolas,"Cascadia Code",monospace}.code-block code{font:inherit;background:none;color:inherit;padding:0;white-space:pre;word-break:normal;overflow-wrap:normal}
.cta{background:var(--dark);color:#eff4ef;border-radius:10px;padding:34px;margin:55px 0 18px}.cta h2{color:#fff;border:0;margin:0 0 18px;padding:0;font-size:29px;scroll-margin-top:96px}.cta p{color:#cfdbd1}.cta p:last-child{margin-bottom:0}.cta .cta-link{display:inline-block;background:var(--gold);color:#17231b;text-decoration:none;font-size:15px;font-weight:700;line-height:1.5;padding:13px 20px;border-radius:5px}.cta .cta-link:hover{background:#f5dc68}.page-footer{margin-top:34px;padding-top:24px;border-top:1px solid var(--line);color:var(--muted);font-size:12px;line-height:1.8}.page-footer a{text-decoration:none}.back-to-top{display:inline-block;margin-left:18px}
@media(min-width:1500px){.layout{gap:60px}}
@media(max-width:1100px){.layout{grid-template-columns:195px minmax(0,1fr);gap:28px;padding:32px 22px 60px}.reader{padding:34px 30px}.hero h1{font-size:43px}}
@media(max-width:900px){.layout{display:block;padding:24px 20px 48px}.sidebar{position:static;max-height:none;padding:0;margin-bottom:22px}.toc{border:1px solid var(--line);border-radius:8px;background:#fff}.toc summary{margin:0;padding:14px 18px}.toc nav{padding:0 12px 12px}.sidebar-note{display:none}.reader{padding:34px}.header-inner{padding:12px 20px}.hero h1{font-size:43px}}
@media(max-width:600px){body{font-size:16px;line-height:1.75}.header-inner{padding:10px 16px;gap:10px}.brand{font-size:14px}.brand small{font-size:9px}.header-actions{gap:12px;font-size:12px}.plain-button{padding:4px 8px;font-size:12px}.layout{padding:18px 12px 32px}.reader{padding:28px 20px}.hero h1{font-size:34px}.subtitle{font-size:18px}.meta{font-size:11px;gap:7px}.meta span+span::before{margin-right:7px}article h2{font-size:25px;margin-top:45px;padding-top:22px}article h3{font-size:20px}th,td{padding:11px 12px}.code-block pre{font-size:12px;padding:16px}.tutorial-figure figcaption{padding:12px 14px}.cta{padding:26px 22px}.cta h2{font-size:25px}.cta .cta-link{font-size:14px;padding:12px 15px}.back-to-top{margin-left:0;display:block;margin-top:8px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@media print{body{background:white;color:black;font-size:10pt;line-height:1.5}.site-header,.sidebar,.copy-code,.page-footer,.image-hint{display:none!important}.layout{display:block;padding:0;max-width:none}.reader{padding:0;border:0}.hero h1{font-size:30pt}article h2{font-size:19pt;margin-top:25pt;break-after:avoid}article h3{break-after:avoid}.table-wrap{overflow:visible}table{min-width:0;font-size:8pt}th,td{padding:6pt}.code-block{background:#f5f5f5;color:#111;border:1px solid #ccc;overflow:visible}.code-toolbar{background:#eee}.code-label{color:#111}.code-block pre{white-space:pre-wrap;overflow:visible;font-size:8pt}.code-block code{white-space:pre-wrap}.code-block .highlight span{color:#111!important}.tutorial-figure{break-inside:avoid}.cta{background:#f3f4ef;color:#111}.cta h2,.cta p{color:#111}.cta .cta-link{border:1px solid #999;color:#111}a{color:#174a72}.video-demo video{display:none}.video-demo .video-caption{display:block}}
"""

JS = r"""
(() => {
  const toc = document.querySelector('.toc');
  const narrow = matchMedia('(max-width: 900px)');
  if (narrow.matches) toc.open = false;
  narrow.addEventListener('change', event => { toc.open = !event.matches; });
  document.querySelectorAll('.toc a').forEach(link => link.addEventListener('click', () => {
    if (narrow.matches) toc.open = false;
  }));
  const sections = [...document.querySelectorAll('article h2[id]')];
  const links = [...document.querySelectorAll('.toc a')];
  let scrollPending = false;
  const updateCurrent = () => {
    scrollPending = false;
    let current = sections.filter(section => section.getBoundingClientRect().top <= 220).at(-1);
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) current = sections.at(-1);
    links.forEach(link => link.setAttribute('aria-current', String(Boolean(current) && link.hash === '#' + current.id)));
  };
  addEventListener('scroll', () => {
    if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateCurrent); }
  }, { passive: true });
  updateCurrent();
  document.querySelectorAll('[data-copy]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', async () => {
      const code = button.closest('.code-block').querySelector('code').textContent;
      try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(code);
        else {
          const field = document.createElement('textarea');
          field.value = code; field.style.position = 'fixed'; field.style.left = '-9999px';
          document.body.append(field); field.select();
          const copied = document.execCommand('copy'); field.remove();
          if (!copied) throw new Error('Copy unavailable');
        }
        button.textContent = 'Copied';
      } catch { button.textContent = 'Select code'; }
      setTimeout(() => { button.textContent = 'Copy'; }, 1800);
    });
  });
  const print = document.querySelector('[data-print]');
  print.hidden = false;
  const openForPrint = [];
  addEventListener('beforeprint', () => {
    document.querySelectorAll('.config-details:not([open]), .video-demo:not([open])').forEach(details => {
      openForPrint.push(details); details.open = true;
    });
  });
  addEventListener('afterprint', () => { openForPrint.splice(0).forEach(details => { details.open = false; }); });
  print.addEventListener('click', () => window.print());
})();
"""


def build() -> None:
    markdown = SOURCE.read_text(encoding="utf-8")
    parser = MarkdownIt("commonmark", {"html": True, "highlight": syntax}).enable("table")
    tokens = parser.parse(markdown)
    for index, token in enumerate(tokens):
        if token.type == "heading_open":
            token.attrSet("id", slug(tokens[index + 1].content))
    soup = BeautifulSoup(parser.renderer.render(tokens, parser.options, {}), "html.parser")
    title = soup.h1.get_text()
    soup.h1.decompose()
    subtitle = soup.find("p").get_text()
    soup.find("p").decompose()
    # Editorial status belongs in the Markdown/workflow records, not the reader's article.
    status = soup.find("blockquote")
    if status and (status.get_text().strip().startswith("Approved tutorial") or "Markdown" in status.get_text() or "editorial review" in status.get_text()):
        status.decompose()
    for comment in soup.find_all(string=lambda node: isinstance(node, __import__("bs4").Comment)):
        comment.extract()
    for tag in soup.find_all(["a", "img"]):
        attr = "href" if tag.name == "a" else "src"
        if tag.get(attr):
            tag[attr] = root_url(tag[attr])
    contents = soup.find("h2", id="contents")
    contents_list = contents.find_next_sibling("ol")
    toc = str(contents_list)
    contents_list.decompose()
    contents.decompose()
    toc_soup = BeautifulSoup(toc, "html.parser")
    nav_links = "".join(str(link) for link in toc_soup.find_all("a"))
    nav_links += '<a href="#build-your-own-choice-based-battle-pass">Build with AGS ↗</a>'
    for number, image in enumerate(list(soup.find_all("img")), 1):
        image_path = ROOT / image["src"]
        with Image.open(image_path) as media:
            image["width"], image["height"] = media.size
        image["loading"] = "eager" if number == 1 else "lazy"
        image["decoding"] = "async"
        paragraph = image.parent
        caption_p = paragraph.find_next_sibling("p")
        caption = caption_p.get_text() if caption_p else ""
        figure = soup.new_tag("figure", attrs={"class": "tutorial-figure", "id": f"figure-{number}"})
        full_link = soup.new_tag("a", href=image["src"], target="_blank", rel="noopener",
                                 attrs={"aria-label": f"Open Figure {number} at full resolution"})
        full_link.append(image.extract())
        figure.append(full_link)
        figcaption = soup.new_tag("figcaption")
        label = soup.new_tag("strong")
        label.string = f"Figure {number}."
        figcaption.append(label)
        figcaption.append(" " + re.sub(r"^Figure \d+\.\s*", "", caption))
        hint = soup.new_tag("span", attrs={"class": "image-hint"})
        hint.string = "Select the image to open it at full resolution."
        figcaption.append(hint)
        figure.append(figcaption)
        paragraph.replace_with(figure)
        if caption_p:
            caption_p.decompose()
        if image_path.name in {"item-full.png", "portal-item-full.png"}:
            disclosure = soup.new_tag("details", attrs={"class": "config-details"})
            summary = soup.new_tag("summary")
            summary.string = "View Sentinel’s complete catalog configuration"
            disclosure.append(summary)
            figure.replace_with(disclosure)
            disclosure.append(figure)
    for table in soup.find_all("table"):
        wrapper = soup.new_tag("div", attrs={"class": "table-wrap", "tabindex": "0", "role": "region",
                                             "aria-label": "Scrollable reference table"})
        table.wrap(wrapper)
    languages = {"ts": "TypeScript", "json": "JSON", "text": "REST endpoint", "sh": "Shell"}
    for number, pre in enumerate(list(soup.find_all("pre")), 1):
        code = pre.find("code")
        classes = code.get("class", [])
        lang = next((value[9:] for value in classes if value.startswith("language-")), "text")
        code["class"] = classes + ["highlight"]
        code["id"] = f"code-{number}"
        pre["tabindex"] = "0"
        pre["aria-label"] = f"{languages.get(lang, lang)} code example"
        wrapper = soup.new_tag("div", attrs={"class": "code-block"})
        pre.wrap(wrapper)
        bar = soup.new_tag("div", attrs={"class": "code-toolbar"})
        label = soup.new_tag("span", attrs={"class": "code-label"})
        label.string = languages.get(lang, lang)
        button = soup.new_tag("button", attrs={"class": "copy-code", "type": "button", "hidden": "",
                                               "data-copy": "", "aria-label": f"Copy code example {number}",
                                               "aria-live": "polite"})
        button.string = "Copy"
        bar.extend([label, button])
        wrapper.insert(0, bar)
    video_link = soup.find("a", href=root_url("signal-range-demo.mp4"))
    if video_link:
        paragraph = video_link.parent
        details = soup.new_tag("details", attrs={"class": "video-demo"})
        summary = soup.new_tag("summary")
        summary.string = "Watch the 60-second Signal Range demonstration"
        details.append(summary)
        video = soup.new_tag("video", controls="", preload="metadata", poster=root_url("tutorial-assets/01-initial-deck.png"),
                             attrs={"aria-label": "Signal Range reward demonstration"})
        video.append(soup.new_tag("source", src=video_link["href"], type="video/mp4"))
        fallback = soup.new_tag("p")
        fallback.string = "Use the video link below if your browser cannot play the demonstration."
        video.append(fallback)
        details.append(video)
        caption = soup.new_tag("p", attrs={"class": "video-caption"})
        caption.string = "Reward selection and spending progression through Tier 3 access. "
        link = soup.new_tag("a", href=video_link["href"])
        link.string = "Open the video ↗"
        caption.append(link)
        details.append(caption)
        paragraph.replace_with(details)
    cta_heading = soup.find("h2", id="build-your-own-choice-based-battle-pass")
    cta = soup.new_tag("section", attrs={"class": "cta", "aria-labelledby": cta_heading["id"]})
    cta_heading.replace_with(cta)
    cta.append(cta_heading)
    while cta.next_sibling:
        cta.append(cta.next_sibling.extract())
    cta_link = cta.find("a")
    cta_link["class"] = "cta-link"
    minutes = math.ceil(len(re.findall(r"\b\w+\b", markdown)) / 230)
    css = CSS + "\n" + FORMATTER.get_style_defs(".code-block .highlight")
    document = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Build a choice-based battle pass with AGS Wallet, Store, Orders, Entitlements, Statistics, and native purchasing requirements.">
  <meta name="theme-color" content="#14221b">
  <title>{html.escape(title)} | AGS Developer Tutorial</title>
  <style>{css}</style>
</head>
<body id="top">
  <a class="skip-link" href="#tutorial">Skip to tutorial</a>
  <header class="site-header"><div class="header-inner">
    <a class="brand" href="#top">ACCELBYTE<small>DEVELOPER TUTORIALS</small></a>
    <div class="header-actions"><a href="{root_url(SOURCE.name)}">Markdown source</a><button class="plain-button" type="button" data-print hidden>Print / PDF</button></div>
  </div></header>
  <div class="layout">
    <aside class="sidebar" aria-label="Tutorial navigation">
      <details class="toc" open><summary>On this page</summary><nav>{nav_links}</nav></details>
      <p class="sidebar-note">A complete implementation walkthrough.<br>Wallet · Orders · Statistics<br>Signal Range reward deck</p>
    </aside>
    <main class="reader" id="tutorial">
      <header class="hero"><p class="eyebrow">AGS implementation guide</p><h1>{html.escape(title)}</h1>
        <p class="subtitle">{html.escape(subtitle)}</p>
        <div class="meta"><span>{minutes} min read</span><span>REST + TypeScript examples</span></div>
      </header>
      <article>{soup}</article>
      <footer class="page-footer">AGS developer tutorial · Choice-based reward progression<br>
        <a href="{root_url(SOURCE.name)}">Read the Markdown source</a><a class="back-to-top" href="#top">Back to top ↑</a>
      </footer>
    </main>
  </div>
  <script>{JS}</script>
</body>
</html>
'''
    OUTPUT.write_text(document, encoding="utf-8", newline="\n")
    print(f"Built {OUTPUT.name}: {len(document):,} characters; {len(soup.find_all('figure'))} figures; {minutes} min read.")


if __name__ == "__main__":
    build()
