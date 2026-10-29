#!/usr/bin/env python3
"""Extract the listening graphics referenced by the supplied test sources.

The source JSON uses Android drawable names, not web URLs.  The matching files
are in the locally supplied base.apk.  Only the Part 3/4 assets are copied;
Part 1 remains outside the generated web bank.  Running this script again is
safe and produces byte-identical assets.
"""
import json
import re
import zipfile
from pathlib import Path

SOURCE_DIR = Path('ALL_TOEIC_TESTS')
APK_PATH = Path('base.apk')
DEST_DIR = Path('public/full-toeic-graphics')
DRAWABLE_DIR = 'res/drawable-xxxhdpi-v4/'
IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png')


def main():
    names = set()
    for path in SOURCE_DIR.glob('*.json'):
        data = json.loads(path.read_text(encoding='utf-8'))
        for part_no in (3, 4):
            for item in data.get(f'part{part_no}', []):
                name = (item.get('image') or '').strip()
                if not name:
                    continue
                if not re.fullmatch(r'[A-Za-z0-9_-]+', name):
                    raise ValueError(f'Unexpected drawable name: {name!r}')
                names.add(name)

    with zipfile.ZipFile(APK_PATH) as apk:
        contents = set(apk.namelist())
        files = []
        for name in sorted(names):
            candidates = [f'{DRAWABLE_DIR}{name}{ext}' for ext in IMAGE_EXTENSIONS]
            matches = [candidate for candidate in candidates if candidate in contents]
            if len(matches) != 1:
                raise ValueError(f'Expected exactly one drawable for {name}, found {matches}')
            files.append(matches[0])
        DEST_DIR.mkdir(parents=True, exist_ok=True)
        for filename in files:
            (DEST_DIR / Path(filename).name).write_bytes(apk.read(filename))
    print(f'Extracted {len(files)} listening graphics to {DEST_DIR}')


if __name__ == '__main__':
    main()
