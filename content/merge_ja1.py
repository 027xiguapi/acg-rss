# -*- coding: utf-8 -*-
import io, sys, importlib.util
sys.stdout.reconfigure(encoding='utf-8')

path = r'H:\me\acg-rss\content\ja_batch_001_125.py'
with io.open(path, encoding='utf-8') as f:
    src = f.read()

with io.open(r'H:\me\acg-rss\content\ja_batch_126_250.py', encoding='utf-8') as f:
    p2 = f.read()

start = p2.index('{')
end = p2.rindex('}')
body2 = p2[start+1:end].strip()
if body2.endswith(','):
    body2 = body2[:-1].rstrip()

idx_close = src.rindex('}')
head = src[:idx_close].rstrip()
if not head.endswith(','):
    head += ','
new = head + '\n' + body2 + ',\n}\n'

with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(new)
print('merged OK, new len', len(new))

spec = importlib.util.spec_from_file_location('ja1', path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
d = mod.BATCH_JA
ids = sorted(int(k) for k in d.keys())
print('count', len(d), 'min', ids[0], 'max', ids[-1])
missing = [i for i in range(1, 251) if str(i) not in d]
extra = [k for k in d if int(k) < 1 or int(k) > 250]
print('missing', missing)
print('extra', extra)

bad_pats = ['ではなく', 'でもなく', 'ではなく、', 'リバイバル', 'I will', ' actually',
            'Hmm', ' no. ', 'Let me', 'This is not', 'じゃなくて', 'ではなく」']
bad = []
for k, v in d.items():
    lv = v
    for p in bad_pats:
        if p in lv:
            bad.append((k, p))
            break
print('bad', len(bad), bad[:60])
