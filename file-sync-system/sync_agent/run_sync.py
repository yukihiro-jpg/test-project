"""同期エージェントのエントリーポイント"""
import argparse
import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from .config import SyncConfig, APP_DATA_DIR
from .sync_engine import SyncEngine


def setup_logging(config):
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, config.log_level, logging.INFO))
    file_handler = RotatingFileHandler(
        str(config.log_path), maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8",
    )
    file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
    root_logger.addHandler(file_handler)
    if sys.stdout.isatty():
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
        root_logger.addHandler(console_handler)


def main():
    parser = argparse.ArgumentParser(description="日下部税理士事務所 ファイル同期エージェント")
    parser.add_argument("--config", "-c", help="設定ファイルパス")
    parser.add_argument("--once", action="store_true", help="1回だけ同期を実行")
    args = parser.parse_args()
    try:
        config = SyncConfig(config_path=args.config)
    except ValueError as e:
        print(f"設定エラー: {e}", file=sys.stderr)
        sys.exit(1)
    setup_logging(config)
    logger = logging.getLogger(__name__)
    engine = SyncEngine(config)
    result = engine.run()
    if result.get("error"):
        logger.error(f"同期失敗: {result['error']}")
        sys.exit(1)
    else:
        logger.info(f"同期完了: UP {result['uploaded']}件, DL {result['downloaded']}件")


if __name__ == "__main__":
    main()
