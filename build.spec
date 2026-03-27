# -*- mode: python ; coding: utf-8 -*-
# PyInstaller ビルド設定
# 使い方: pyinstaller build.spec

a = Analysis(
    ['src/mjs_pdf_splitter/__main__.py'],
    pathex=['src'],
    binaries=[],
    datas=[],
    hiddenimports=['mjs_pdf_splitter'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='mjs-pdf-split',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
