# -*- coding: utf-8 -*-
p = r'H:\me\acg-rss\content\ja_batch_501_625.py'
s = open(p, encoding='utf-8').read()
i = s.rindex('"600"')
nl = s.index('\n', i)
head = s[:nl].rstrip()
if head.endswith(','):
    head = head[:-1]
out = head + ',\n}\n'
open(p, 'w', encoding='utf-8').write(out)
print('rewritten, lines:', len(out.splitlines()))
