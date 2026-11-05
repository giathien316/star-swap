"""Build a one-file copy of Star Swap into releases/StarSwap_<version>.html.

    python build.py              -> releases/StarSwap_<version>.html
    python build.py --artifact   -> also writes a body-only copy for Claude artifacts
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent
html = (ROOT / "index.html").read_text(encoding="utf-8")
version = re.search(r'"([\d.]+)"', (ROOT / "js/version.js").read_text()).group(1)

def inline_css(m):
    return "<style>\n" + (ROOT / m.group(1)).read_text(encoding="utf-8") + "</style>"

def inline_js(m):
    return "<script>\n" + (ROOT / m.group(1)).read_text(encoding="utf-8") + "</script>"

out = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', inline_css, html)
out = re.sub(r'<script src="(js/[^"]+)"></script>', inline_js, out)

rel = ROOT / "releases"
rel.mkdir(exist_ok=True)
target = rel / f"StarSwap_{version}.html"
target.write_text(out, encoding="utf-8")
print("wrote", target)

if "--artifact" in sys.argv:
    body = re.sub(r"(?is)<!doctype html>|</?html[^>]*>|</?head>|</?body>|<meta charset[^>]*>|<meta name=\"viewport\"[^>]*>", "", out)
    (rel / f"StarSwap_{version}_artifact.html").write_text(body.strip() + "\n", encoding="utf-8")
    print("wrote artifact copy")
