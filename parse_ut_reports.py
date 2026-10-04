#!/usr/bin/env python3
"""Parse Resultant Consulting Engineers tank UT reports (PDF) into JSON for build_ut_register.py.

Usage:  python scripts/parse_ut_reports.py "folder/with/pdfs" parsed_reports.json
Needs poppler (pdftotext). Reads the cover date, classification bands (green/red), the UT grid
('Top of the tank' ... 'Base of the tank'), DFT and observation text. Grids embedded as images are
reported with 0 rows: transcribe them into the JSON by hand before building the register.
"""
import re, subprocess, glob, os, sys, json, datetime as dt
def txt(p): return subprocess.run(['pdftotext','-layout',p,'-'],capture_output=True,text=True).stdout
def num(s): return float(s.replace(',','.'))
out=[]
for p in sorted(glob.glob(os.path.join(sys.argv[1], '*.pdf'))):
    t=txt(p); fn=os.path.basename(p)
    m=re.search(r'(\d{3})[- ]?([A-Z]{2})[- ]?(\d{3,4}[A-Z]?)', fn.replace('LOT010-KUM-NDT2-Report-',''))
    tag=f'{m.group(1)}-{m.group(2)}-{m.group(3)}'
    MN={m:i+1 for i,m in enumerate(['january','february','march','april','may','june','july','august','september','october','november','december'])}
    d=re.search(r'(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})',t)
    date=dt.date(int(d.group(3)),MN[d.group(2).lower()],int(d.group(1))).isoformat() if d else None
    title=re.search(r'NDT INSPECTION ON\s+(.+?)\n\s*(?:TANK\s*\n)?',t); 
    intro=re.search(r'inspections on (.+?)\.\s',t.replace('\n',' ')); name=re.sub(r'\s+',' ',intro.group(1)).strip() if intro else ''
    g=re.search(r'≥\s*([\d.,]+)\s*mm\s*[–-]\s*Green',t); r=re.search(r'≤\s*([\d.,]+)\s*mm\s*[–-]\s*Red',t)
    green=num(g.group(1)) if g else None; red=num(r.group(1)) if r else None
    # UT grid: section between 'Top of' and 'Base of the tank'
    i0=t.find('Top of'); i1=t.find('Base of', i0)
    seg=t[i0:i1] if i0>=0 and i1>0 else ''
    grid={}
    for line in seg.splitlines():
        parts=line.split()
        if len(parts)>=4 and parts[0].isdigit() and all(re.match(r'^\d+([.,]\d+)?$',x) for x in parts[1:]):
            grid[int(parts[0])]=[num(x) for x in parts[1:]]
    # DFT
    dft=[]
    ds=t[t.find('Recorded DFT'):]
    for line in ds.splitlines()[:20]:
        vals=re.findall(r'(?<![\d,.])(\d{2,4})(?![\d,.])',line.split(':')[-1])
        if len(vals)==8 and 'Page' not in line: dft.append([int(v) for v in vals])
    obs=t[t.find('Observations'):t.find('4.  CONCLUSION')] if 'Observations' in t else ''
    pre=t[t.find('Degrees marked'):t.find('Observations')] if 'Observations' in t else ''
    obs=re.sub(r'\s+',' ',(pre.replace('Degrees marked','').replace('on tank','')+' '+obs)).strip()
    acfm=re.sub(r'\s+',' ',t[t.find('3.2.'):t.find('Visual references')]) if '3.2.' in t else ''
    out.append(dict(file=fn,tag=tag,name=name,date=date,green=green,red=red,grid=grid,dft=dft,obs=obs,acfm=acfm,author=(re.search(r'Author:\s*(.+)',t).group(1).strip() if 'Author:' in t else '')))
for o in out:
    n = len(next(iter(o['grid'].values()))) if o['grid'] else 0
    o['cols'] = (['A', 'B', 'C'] if n == 3 else [f'{a}°{s}' for a in ['0','45','90','135','180','225','270','315'] for s in 'AB'] if n == 16
                 else [f'{a}°{s}' for a in ['0','90','180','270'] for s in 'AB'] if n == 8 else [f'P{i+1}' for i in range(n)])
    o['grid'] = {str(k): v for k, v in o['grid'].items()}
json.dump(out, open(sys.argv[2], 'w'), indent=1)
for o in out:
    vals=[v for row in o['grid'].values() for v in row]; lens=sorted({len(r) for r in o['grid'].values()})
    mn=min(vals) if vals else None
    nred=sum(v<=o['red'] for v in vals) if o['red'] and vals else None
    print(f"{o['tag']:12} {o['date']} rows={len(o['grid']):2} cols={lens} n={len(vals):3} min={mn} green>={o['green']} red<={o['red']} nred={nred} dft_rows={len(o['dft'])} minDFT={min(min(r) for r in o['dft']) if o['dft'] else None} | {o['name'][:40]}")
