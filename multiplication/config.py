"""
設定ファイル
アプリケーションの各種設定値を管理
"""

import os
from reportlab.lib.units import mm


class AppConfig:
    """アプリケーション設定"""

    # アプリケーション情報
    APP_NAME = "掛け算問題作成"
    APP_VERSION = "3.0"

    # ウィンドウ設定
    WINDOW_WIDTH = 300
    WINDOW_HEIGHT = 200
    WINDOW_X = 100
    WINDOW_Y = 100


class PDFConfig:
    """PDF生成設定"""

    # フォント設定（等幅TTFフォント）
    FONT_NAME = "GenShinGothic"
    FONT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts", "GenShinGothic-Monospace-Medium.ttf")
    TITLE_FONT_SIZE = 24
    CONTENT_FONT_SIZE = 16
    NUMBER_FONT_SIZE = 10
    TIME_FONT_SIZE = 12

    # レイアウト設定
    MARGIN_LEFT = 15 * mm
    MARGIN_RIGHT = 15 * mm
    MARGIN_TOP = 20 * mm
    MARGIN_BOTTOM = 15 * mm
    HEADER_HEIGHT = 55
    QUESTIONS_PER_ROW = 4
    CELL_PADDING = 5
    ROW_HEIGHT_RATIO = 1.8


class ProblemConfig:
    """問題生成設定"""

    # 数値範囲
    MIN_NUMBER = 1
    MAX_NUMBER = 9

    # デフォルト値
    DEFAULT_QUESTIONS = 20
    MAX_QUESTIONS = 100

    # ファイル名設定
    FILENAME_PREFIX = "multiplication_"
    FILENAME_SUFFIX = ".pdf"
    DATE_FORMAT = "%Y%m%d%H%M%S"


# 使いやすさのため、統合設定クラスも提供
class Config(AppConfig, PDFConfig, ProblemConfig):
    """全設定を統合したクラス"""
    pass
