# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import importlib.util

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.BATCH_JA

def body_of(path):
    s = open(path, encoding='utf-8').read()
    return s[s.index('{')+1:s.rindex('}')].rstrip()

main = r'H:\me\acg-rss\content\ja_batch_1751_1875.py'
parts = [r'H:\me\acg-rss\content\ja_batch_1876_2000.py']

src = open(main, encoding='utf-8').read()
head = src[:src.rindex('}')].rstrip()
if head.endswith(','):
    head = head[:-1]
body_parts = [head]
for p in parts:
    b = body_of(p)
    if b.endswith(','):
        b = b[:-1]
    body_parts.append(b)
merged = ',\n'.join(body_parts) + ',\n}\n'
open(main, 'w', encoding='utf-8').write(merged)

ja = load('ja8', main)
expected = list(range(1751, 2001))
keys = sorted(int(k) for k in ja.keys())
missing = [i for i in expected if str(i) not in ja]
extra = [k for k in keys if k not in expected]
lens = [len(ja[str(i)]) for i in expected]
print('count', len(ja))
print('min', min(lens), 'max', max(lens), 'avg', sum(lens)//len(lens))
print('missing', missing)
print('extra', extra)
bad = []
for k in sorted(ja, key=int):
    t = ja[k]
    for pat in ['ではなく', 'でもなく', 'じゃなくて', 'I will', ' actually', 'Hmm', 'Let me', 'This is not']:
        if pat in t:
            bad.append((k, pat))
    if not (t.startswith('"') or t.startswith('これは')):
        bad.append((k, 'not-start-quote'))
print('bad', bad)
