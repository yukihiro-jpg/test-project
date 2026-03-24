"""日本語フォント（IPAexゴシック）のダウンロードスクリプト"""

import os
import urllib.request
import zipfile

FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")
FONT_FILE = os.path.join(FONT_DIR, "ipaexg.ttf")
DOWNLOAD_URL = "https://moji.or.jp/wp-content/ipafont/IPAexfont/ipaexg00401.zip"


def download_font():
    """IPAexゴシックフォントをダウンロード"""
    if os.path.exists(FONT_FILE):
        print(f"フォントは既に存在します: {FONT_FILE}")
        return

    os.makedirs(FONT_DIR, exist_ok=True)

    print(f"IPAexゴシックをダウンロード中...")
    zip_path = os.path.join(FONT_DIR, "ipaexg.zip")

    try:
        urllib.request.urlretrieve(DOWNLOAD_URL, zip_path)
        print("展開中...")
        with zipfile.ZipFile(zip_path, "r") as zf:
            for member in zf.namelist():
                if member.endswith(".ttf"):
                    with zf.open(member) as src:
                        with open(FONT_FILE, "wb") as dst:
                            dst.write(src.read())
                    break

        os.remove(zip_path)
        print(f"フォントのインストール完了: {FONT_FILE}")
    except Exception as e:
        print(f"ダウンロードに失敗しました: {e}")
        print("手動でIPAexゴシック(ipaexg.ttf)をfonts/フォルダに配置してください。")
        print("ダウンロード: https://moji.or.jp/ipafont/ipaex00401/")


if __name__ == "__main__":
    download_font()
