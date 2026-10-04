#!/usr/bin/env python3
"""Build a single self-contained HTML file with the workbook embedded.

Usage:  python scripts/build_standalone.py [data/AHIM_Data.xlsx] [dist/AHIM_Dashboard.html]
The result opens offline in any browser and can be emailed to management as a monthly snapshot.
"""
import sys, re, base64, os, datetime as dt
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = HERE if os.path.exists(os.path.join(HERE, 'index.html')) else os.path.join(HERE, '..')   # flat or folder layout
_d = os.path.join(ROOT, 'data', 'AHIM_Data.xlsx')
data = sys.argv[1] if len(sys.argv) > 1 else (_d if os.path.exists(_d) else os.path.join(ROOT, 'AHIM_Data.xlsx'))
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'dist', 'AHIM_Dashboard.html')
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
def _css(m):
    return '<style>\n' + open(os.path.join(ROOT, m.group(1)), encoding='utf-8').read() + '\n</style>'
html = re.sub(r'<link rel="stylesheet" href="([^"]+\.css)">', _css, html)
b64 = base64.b64encode(open(data, 'rb').read()).decode()
stamp = dt.datetime.now().strftime('%d %b %Y %H:%M')
embed = f'<script>window.AHIM_EMBEDDED_DATA="{b64}";window.AHIM_EMBEDDED_DATE="{stamp}";</script>\n'
def inline(m):
    return '<script>\n' + open(os.path.join(ROOT, m.group(1)), encoding='utf-8').read() + '\n</script>'
html = re.sub(r'<script src="(?!https?:)([^"]+\.js)"></script>', inline, html)
html = html.replace('<script src="https://cdnjs', embed + '<script src="https://cdnjs', 1)
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(html)
print(f'Wrote {out} ({os.path.getsize(out)/1e6:.1f} MB), data snapshot {stamp}')
