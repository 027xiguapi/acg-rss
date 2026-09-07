# -*- coding: utf-8 -*-
import io, sys, csv, re
sys.stdout.reconfigure(encoding='utf-8')

with io.open('bangumi-names-content-en.csv', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))
print('total rows:', len(rows))

# rows whose content starts with a quote -> extract the first quoted segment as title
extractable = 0
not_extractable = 0
sample_no_title = []
for r in rows:
    c = r['content']
    if c.startswith('"'):
        m = re.match(r'^"([^"]*)"', c)
        if m and m.group(1).strip():
            extractable += 1
        else:
            not_extractable += 1
            sample_no_title.append(r['bangumiId'])
    else:
        not_extractable += 1
        sample_no_title.append(r['bangumiId'])

print('extractable (starts with quoted title):', extractable)
print('not extractable:', not_extractable)

# show some not-extractable rows: their chinese title + content head
with io.open('bangumi-names-content-en.csv', encoding='utf-8-sig') as f:
    rows2 = list(csv.DictReader(f))
shown = 0
for r in rows2:
    if not r['content'].startswith('"'):
        if shown < 25:
            print('---', r['bangumiId'], '| CN:', r['title'][:30])
            print('   ', r['content'][:100])
            shown += 1
