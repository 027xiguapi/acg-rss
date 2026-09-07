# -*- coding: utf-8 -*-
import io, sys, csv, re
sys.stdout.reconfigure(encoding='utf-8')

src = 'bangumi-names-content-en.csv'
with io.open(src, encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))

# regex: first quoted segment + optional trailing parenthetical (e.g. (Season 2))
pat = re.compile(r'^"([^"]*)"\s*(\([^)]*\))?')

changed = 0
kept = []
for r in rows:
    c = r['content']
    m = pat.match(c)
    if m and m.group(1).strip():
        en = m.group(1).strip()
        if m.group(2):
            en = en + ' ' + m.group(2).strip()
        r['title'] = en
        changed += 1
    else:
        kept.append((r['bangumiId'], r['title']))

print('titles changed to EN:', changed)
print('titles kept as CN:', len(kept))

with io.open(src, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['bangumiId', 'kind', 'lang', 'title', 'content'])
    w.writeheader()
    for r in rows:
        w.writerow(r)
print('rewritten:', src)
