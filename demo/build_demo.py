#!/usr/bin/env python3
"""Builds the standalone demo page (one HTML file, no server needed).

    python3 demo/build_demo.py

Output: demo/battle-of-interns-demo.html  (open it by double-clicking)
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
css = (ROOT / "public/assets/app.css").read_text(encoding="utf-8")
app_js = (ROOT / "public/assets/app.js").read_text(encoding="utf-8")
local_js = (ROOT / "demo/api-local.js").read_text(encoding="utf-8")
questions = json.loads((ROOT / "seed/questions.json").read_text(encoding="utf-8"))
seed_js = "window.BOI_SEED_QUESTIONS = " + json.dumps(questions, ensure_ascii=False).replace("</", "<\\/") + ";"

FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Figtree:wght@400;500;600&display=swap">'

body = f"""<title>Battle of Interns</title>
{FONTS}
<style>
{css}
</style>
<div id="app"><main class="wrap"><div class="card"><p class="muted">Loading the quiz...</p></div></main></div>
<script>{seed_js}</script>
<script>
{local_js}
</script>
<script>
{app_js}
</script>
"""

full = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Battle of Interns (demo)</title>
{FONTS}
<style>
{css}
</style>
</head>
<body>
<div id="app"><main class="wrap"><div class="card"><p class="muted">Loading the quiz...</p></div></main></div>
<script>{seed_js}</script>
<script>
{local_js}
</script>
<script>
{app_js}
</script>
</body>
</html>
"""

out = ROOT / "demo/battle-of-interns-demo.html"
out.write_text(full, encoding="utf-8")
print("wrote", out, len(full), "bytes")
# Copy at the repo root so GitHub Pages serves the demo at the project URL.
(ROOT / "index.html").write_text(full, encoding="utf-8")
print("wrote", ROOT / "index.html")

# Optional second output: a body-only fragment (used when publishing as a hosted artifact page).
if len(sys.argv) > 1:
    pathlib.Path(sys.argv[1]).write_text(body, encoding="utf-8")
    print("wrote fragment", sys.argv[1])
