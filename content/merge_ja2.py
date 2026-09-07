# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import importlib.util

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.BATCH_JA

main = load('ja2a', r'H:\me\acg-rss\content\ja_batch_251_375.py')
part2 = load('ja2b', r'H:\me\acg-rss\content\ja_batch_376_500.py')

# merge part2 into main file body
with open(r'H:\me\acg-rss\content\ja_batch_251_375.py', 'r', encoding='utf-8') as f:
    src = f.read()
head = src[:src.rindex('}')].rstrip()
if head.endswith(','):
    head = head[:-1]
with open(r'H:\me\acg-rss\content\ja_batch_376_500.py', 'r', encoding='utf-8') as f:
    p2 = f.read()
p2_body = p2[p2.index('{')+1:p2.rindex('}')].rstrip()
if p2_body.endswith(','):
    p2_body = p2_body[:-1]
merged = head + ',\n' + p2_body + ',\n}\n'
with open(r'H:\me\acg-rss\content\ja_batch_251_375.py', 'w', encoding='utf-8') as f:
    f.write(merged)

# verify
ja = load('ja2', r'H:\me\acg-rss\content\ja_batch_251_375.py')
expected = list(range(251, 501))
keys = sorted(int(k) for k in ja.keys())
missing = [i for i in expected if i not in ja]
extra = [k for k in keys if k not in expected]
lens = [len(ja[str(i)]) for i in expected]
print('count', len(ja))
print('min', min(lens), 'max', max(lens), 'avg', sum(lens)//len(lens))
print('missing', missing)
print('extra', extra)
bad = []
for k in sorted(ja, key=int):
    t = ja[k]
    for pat in ['ではなく', 'でもなく', 'じゃなくて', 'リバイバル', 'I will', ' actually', 'Hmm', 'Let me', 'This is not', '^"', '「これは']:
        if pat == '^"':
            if not t.startswith('"'):
                bad.append((k, 'not-start-quote'))
        elif pat == '「これは':
            pass
        else:
            if pat in t:
                bad.append((k, pat))
print('bad', bad)
