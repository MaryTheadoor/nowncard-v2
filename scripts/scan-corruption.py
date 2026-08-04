#!/usr/bin/env python
"""Scan source files for character corruption (mojibake / replacement chars)."""
import os, sys, io, re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOTS = sys.argv[1:] or ['src', 'functions/src']
EXTS = ('.ts', '.tsx', '.css', '.html', '.json', '.js', '.jsx', '.md')

# Known-good unicode we intentionally use in UI copy (ellipses, arrows, symbols)
ALLOWLIST = set('…→←★♥♡·—–×±≥≤°™®©✓✕✦⚡€£¥©«»„‚äöüßéèêçñáóúí'
                '\u2b50\ufe0f\u2764\ufe0f')  # star/heart emoji

count = 0
for root in ROOTS:
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in ('node_modules', 'dist', 'lib')]
        for f in files:
            if not f.endswith(EXTS):
                continue
            p = os.path.join(dirpath, f)
            try:
                raw = open(p, 'rb').read()
            except OSError:
                continue
            # 1. File-level decode check
            try:
                text = raw.decode('utf-8')
            except UnicodeDecodeError as e:
                print(f'{p}: *** FILE DECODE ERROR: {e}')
                count += 1
                continue
            # 2. Per-line checks
            for i, line in enumerate(text.splitlines(), 1):
                hit = None
                if '\ufffd' in line:
                    hit = 'REPLACEMENT CHAR U+FFFD'
                else:
                    bad = []
                    for ch in line:
                        o = ord(ch)
                        if o >= 0x80 and ch not in ALLOWLIST:
                            bad.append(f'U+{o:04X}({ch!r})')
                    if bad:
                        hit = 'non-ascii: ' + ','.join(sorted(set(bad)))
                if hit:
                    snip = line.rstrip()
                    if len(snip) > 200:
                        snip = snip[:200] + '...'
                    print(f'{p}:{i}: {hit}\n    {snip}')
                    count += 1

print(f'--- {count} suspect lines')
