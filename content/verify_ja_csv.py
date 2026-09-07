# -*- coding: utf-8 -*-
import sys, io, csv
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

path = r'H:\me\acg-rss\bangumi-names-content-ja.csv'
rows = []
with open(path, encoding='utf-8-sig') as f:
    rd = csv.DictReader(f)
    cols = rd.fieldnames
    for r in rd:
        rows.append(r)
print('cols', cols)
print('rows', len(rows))
ids = [r['bangumiId'] for r in rows]
print('unique ids', len(set(ids)))
langs = {}
for r in rows:
    langs[r['lang']] = langs.get(r['lang'], 0) + 1
print('langs', langs)
kinds = {}
for r in rows:
    kinds[r['kind']] = kinds.get(r['kind'], 0) + 1
print('kinds', kinds)

empty_title = [r['bangumiId'] for r in rows if not r['title'].strip()]
empty_content = [r['bangumiId'] for r in rows if not r['content'].strip()]
print('empty title', empty_title)
print('empty content', empty_content)

# 抽样首尾与中间
for bid in ['1', '250', '500', '1000', '1500', '2000', '2250', '2508']:
    m = next((r for r in rows if r['bangumiId'] == bid), None)
    if m:
        print('---', bid, '|', m['title'], '|', m['content'][:60], '...')

# 中文残留检测（content 里不应有大段中文；日文含汉字，仅粗查引号标题是否含明显中文长串）
import re
bad_han = []
for r in rows:
    c = r['content']
    han = re.findall(r'[\u4e00-\u9fff]{6,}', c)
    if han:
        bad_han.append((r['bangumiId'], han[:2]))
print('han-runs(>=6) sample', bad_han[:15], 'total', len(bad_han))
