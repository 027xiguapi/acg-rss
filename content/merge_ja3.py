# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import importlib.util

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.BATCH_JA

main_path = r'H:\me\acg-rss\content\ja_batch_501_625.py'
part2_path = r'H:\me\acg-rss\content\ja_batch_626_750.py'

with open(main_path, 'r', encoding='utf-8') as f:
    src = f.read()
head = src[:src.rindex('}')].rstrip()
if head.endswith(','):
    head = head[:-1]
with open(part2_path, 'r', encoding='utf-8') as f:
    p2 = f.read()
p2_body = p2[p2.index('{')+1:p2.rindex('}')].rstrip()
if p2_body.endswith(','):
    p2_body = p2_body[:-1]
merged = head + ',\n' + p2_body + ',\n}\n'
with open(main_path, 'w', encoding='utf-8') as f:
    f.write(merged)

# verify
ja = load('ja3', main_path)
expected = list(range(501, 751))
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
