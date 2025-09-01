"""
設定ファイル
アプリケーションの各種設定値を管理
"""

from reportlab.lib.units import mm


class AppConfig:
    """アプリケーション設定"""
    
    # アプリケーション情報
    APP_NAME = "掛け算問題作成"
    APP_VERSION = "2.0"
    
    # ウィンドウ設定
    WINDOW_WIDTH = 300
    WINDOW_HEIGHT = 200
    WINDOW_X = 100
    WINDOW_Y = 100


class PDFConfig:
    """PDF生成設定"""
    
    # フォント設定
    FONT_NAME = "HeiseiKakuGo-W5"
    TITLE_FONT_SIZE = 28
    CONTENT_FONT_SIZE = 18
    TIME_FONT_SIZE = 12
    
    # レイアウト設定
    MARGIN = 18 * mm
    TOP_MARGIN = 25 * mm
    HEADER_SPACE = 60  # ヘッダー用スペース
    QUESTIONS_PER_ROW = 4
    QUESTION_OFFSET_X = 15  # 問題の左側オフセット
    
    # タイトル位置
    TITLE_X = 20 * mm
    TITLE_Y = 285 * mm


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
