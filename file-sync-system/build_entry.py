"""Nuitka ビルド用エントリーポイント"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sync_agent.run_sync import main

if __name__ == "__main__":
    main()
