# -*- coding: utf-8 -*-
import io, sys, csv
sys.stdout.reconfigure(encoding='utf-8')

with io.open('bangumi-names-content-en.csv', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))
print('rows', len(rows))

starts = [1, 251, 501, 751, 1001, 1251, 1501, 1751, 2001, 2251]
ends   = [250, 500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2508]
for s, e in zip(starts, ends):
    out = 'content/en_view_%04d_%04d.txt' % (s, e)
    with io.open(out, 'w', encoding='utf-8') as f:
        for r in rows:
            i = int(r['bangumiId'])
            if s <= i <= e:
                f.write('%s\t%s\t%s\n' % (r['bangumiId'], r['title'], r['content']))
    print('dumped', out)
