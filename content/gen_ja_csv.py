# -*- coding: utf-8 -*-
import sys, io, csv, importlib.util
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.BATCH_JA

main_files = [
    r'H:\me\acg-rss\content\ja_batch_001_125.py',
    r'H:\me\acg-rss\content\ja_batch_251_375.py',
    r'H:\me\acg-rss\content\ja_batch_501_625.py',
    r'H:\me\acg-rss\content\ja_batch_751_875.py',
    r'H:\me\acg-rss\content\ja_batch_1001_1125.py',
    r'H:\me\acg-rss\content\ja_batch_1251_1375.py',
    r'H:\me\acg-rss\content\ja_batch_1501_1625.py',
    r'H:\me\acg-rss\content\ja_batch_1751_1875.py',
    r'H:\me\acg-rss\content\ja_batch_2001_2125.py',
    r'H:\me\acg-rss\content\ja_batch_2251_2375.py',
]
ja = {}
for i, f in enumerate(main_files):
    d = load('ja%d' % i, f)
    ja.update(d)
print('ja loaded', len(ja))

# 中文版 CSV 提供 bangumiId, kind, lang, title（中文原标题）
src_rows = []
with open(r'H:\me\acg-rss\bangumi-names-content.csv', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        src_rows.append(r)
print('src rows', len(src_rows))
ids = [r['bangumiId'] for r in src_rows]
assert len(set(ids)) == 2508, 'id uniqueness broken'

missing = [i for i in ids if i not in ja]
print('missing in ja', missing)

def extract_title(content):
    if content.startswith('"'):
        end = content.find('"', 1)
        return content[1:end]
    return None

out_path = r'H:\me\acg-rss\bangumi-names-content-ja.csv'
with open(out_path, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['bangumiId', 'kind', 'lang', 'title', 'content'])
    for r in src_rows:
        c = ja[r['bangumiId']]
        t = extract_title(c)
        if t is None:
            # 冷门条目，保留原标题（多为中文，无公认日文名）
            t = r['title']
        w.writerow([r['bangumiId'], r['kind'], 'ja-JP', t, c])
print('written', out_path)

# 统计
keep_cn = 0
for r in src_rows:
    c = ja[r['bangumiId']]
    if not c.startswith('"'):
        keep_cn += 1
print('cold-start (kept original title)', keep_cn)
