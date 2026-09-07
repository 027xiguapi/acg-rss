# -*- coding: utf-8 -*-
import io, sys, csv, re, random
sys.stdout.reconfigure(encoding='utf-8')

with io.open('bangumi-names-content-en.csv', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))
print('total rows:', len(rows))

pat = re.compile(r'^"([^"]*)"\s*(\([^)]*\))?')
mismatch = 0
en_cnt = 0
cn_cnt = 0
for r in rows:
    m = pat.match(r['content'])
    if m and m.group(1).strip():
        en_cnt += 1
        expect = m.group(1).strip()
        if m.group(2):
            expect = expect + ' ' + m.group(2).strip()
        if r['title'] != expect:
            mismatch += 1
    else:
        cn_cnt += 1
print('EN titles:', en_cnt, '| CN titles:', cn_cnt, '| mismatch:', mismatch)

# samples of EN titles
print('\nEN title samples:')
random.seed(7)
shown = 0
for r in rows:
    if r['title'] == r['title'] and not r['content'].startswith('This'):
        # it's an EN title if content starts with quote
        if r['content'].startswith('"'):
            print(r['bangumiId'], '|', r['title'], '||', r['content'][:70])
            shown += 1
            if shown >= 12:
                break

# verify no empty titles
empty = [r['bangumiId'] for r in rows if not r['title'].strip()]
print('\nempty titles:', len(empty), empty[:10])
