"""
掛け算問題作成アプリケーション

機能：
- 指定した問題数の掛け算問題をPDFで作成
- 重複のない問題生成（1×1〜9×9の81通りからシャッフル選択）
- 解答ページ付き
- 見やすいレイアウト（等幅フォント、問題番号、グリッド線）
- PyQt5を使用したGUIインターフェース
"""

import sys
import os
import random
import datetime
from typing import Optional

from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm
from reportlab.lib.pagesizes import A4


class Config:
    """アプリケーション設定クラス"""

    # フォント設定
    FONT_NAME = "GenShinGothic"
    FONT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts", "GenShinGothic-Monospace-Medium.ttf")
    TITLE_FONT_SIZE = 24
    CONTENT_FONT_SIZE = 28
    NUMBER_FONT_SIZE = 10
    TIME_FONT_SIZE = 12

    # レイアウト設定
    MARGIN_LEFT = 15 * mm
    MARGIN_RIGHT = 15 * mm
    MARGIN_TOP = 20 * mm
    MARGIN_BOTTOM = 15 * mm
    HEADER_HEIGHT = 55  # ヘッダー領域の高さ
    QUESTIONS_PER_ROW = 4
    CELL_PADDING = 5  # セル内余白

    # 行の高さ係数（フォントサイズに対する倍率）
    ROW_HEIGHT_RATIO = 1.4

    # 問題設定
    MIN_NUMBER = 1
    MAX_NUMBER = 9
    DEFAULT_QUESTIONS = 20


class PDFGenerator:
    """PDF生成を担当するクラス"""

    def __init__(self, config: Config):
        self.config = config
        self._font_registered = False

    def generate_worksheet(self, num_questions: int, output_filename: str) -> bool:
        """
        掛け算問題のワークシートPDFを生成する（問題ページ＋解答ページ）

        Args:
            num_questions: 問題数
            output_filename: 出力ファイル名

        Returns:
            生成成功の場合True、失敗の場合False
        """
        try:
            # 重複のない問題リストを生成
            questions = self._generate_unique_questions(num_questions)

            # PDF設定
            c = canvas.Canvas(output_filename, pagesize=A4)
            self._setup_fonts(c)

            # レイアウト計算
            layout = self._calculate_layout(num_questions)

            # 問題ページ作成
            self._create_header(c, num_questions, is_answer=False)
            self._create_questions_page(c, questions, layout, show_answers=False)

            # 解答ページ作成
            c.showPage()
            self._create_header(c, num_questions, is_answer=True)
            self._create_questions_page(c, questions, layout, show_answers=True)

            c.save()
            return True

        except Exception as e:
            print(f"PDF生成エラー: {e}")
            return False

    def _setup_fonts(self, canvas_obj: canvas.Canvas) -> None:
        """フォントを設定する"""
        if not self._font_registered:
            try:
                pdfmetrics.registerFont(TTFont(self.config.FONT_NAME, self.config.FONT_PATH))
                self._font_registered = True
            except Exception as e:
                print(f"警告: TTFフォント登録に失敗しました ({e})。デフォルトフォントを使用します。")
                self.config.FONT_NAME = "Helvetica"

    def _generate_unique_questions(self, num_questions: int) -> list:
        """
        重複のない掛け算問題リストを生成する

        Args:
            num_questions: 必要な問題数

        Returns:
            (num1, num2) のタプルのリスト
        """
        # 1×1〜9×9 の全81通り
        all_combinations = [
            (a, b)
            for a in range(self.config.MIN_NUMBER, self.config.MAX_NUMBER + 1)
            for b in range(self.config.MIN_NUMBER, self.config.MAX_NUMBER + 1)
        ]

        questions = []
        while len(questions) < num_questions:
            pool = list(all_combinations)
            random.shuffle(pool)
            remaining = num_questions - len(questions)
            questions.extend(pool[:remaining])

        return questions

    def _calculate_layout(self, num_questions: int) -> dict:
        """レイアウト情報を計算する（1ページに収まるよう動的にフォントサイズ調整）"""
        num_cols = min(num_questions, self.config.QUESTIONS_PER_ROW)
        num_rows = (num_questions + num_cols - 1) // num_cols

        page_width, page_height = A4
        usable_width = page_width - self.config.MARGIN_LEFT - self.config.MARGIN_RIGHT
        usable_height = page_height - self.config.MARGIN_TOP - self.config.MARGIN_BOTTOM - self.config.HEADER_HEIGHT

        cell_width = usable_width / num_cols

        # 1ページに収まる最大フォントサイズを算出
        max_font_from_height = usable_height / (num_rows * self.config.ROW_HEIGHT_RATIO)
        content_font_size = min(self.config.CONTENT_FONT_SIZE, max_font_from_height)
        content_font_size = max(8, content_font_size)  # 最低8pt

        row_height = content_font_size * self.config.ROW_HEIGHT_RATIO

        return {
            'num_rows': num_rows,
            'num_cols': num_cols,
            'cell_width': cell_width,
            'row_height': row_height,
            'page_width': page_width,
            'page_height': page_height,
            'content_font_size': content_font_size,
            'area_top': page_height - self.config.MARGIN_TOP - self.config.HEADER_HEIGHT,
            'area_left': self.config.MARGIN_LEFT,
        }

    def _create_header(self, c: canvas.Canvas, num_questions: int, is_answer: bool = False) -> None:
        """PDFヘッダーを作成する"""
        page_width, page_height = A4

        # タイトル
        c.setFont(self.config.FONT_NAME, self.config.TITLE_FONT_SIZE)
        if is_answer:
            title = f"九九もんだい {num_questions}もん　こたえ"
        else:
            title = f"九九もんだい {num_questions}もん"
        c.drawString(self.config.MARGIN_LEFT, page_height - self.config.MARGIN_TOP - 5, title)

        if not is_answer:
            # 名前欄（右上）
            c.setFont(self.config.FONT_NAME, self.config.TIME_FONT_SIZE)
            name_x = page_width - self.config.MARGIN_RIGHT - 140
            name_y = page_height - self.config.MARGIN_TOP - 5
            c.drawString(name_x, name_y, "なまえ：___________")

            # 日付・タイム欄（タイトル下）
            c.setFont(self.config.FONT_NAME, self.config.TIME_FONT_SIZE)
            info_y = page_height - self.config.MARGIN_TOP - 28
            c.drawString(self.config.MARGIN_LEFT, info_y,
                         "　　月　　日　　タイム（　　分　　秒）")

    def _create_questions_page(self, c: canvas.Canvas, questions: list, layout: dict,
                               show_answers: bool = False) -> None:
        """問題（または解答）を配置する（問題番号はインライン表示）"""
        font_size = layout['content_font_size']

        for i, (num1, num2) in enumerate(questions):
            row = i // layout['num_cols']
            col = i % layout['num_cols']

            text_x = layout['area_left'] + col * layout['cell_width'] + self.config.CELL_PADDING
            text_y = layout['area_top'] - (row + 1) * layout['row_height'] + font_size * 0.3

            # 問題番号＋問題テキストを1行で描画
            c.setFont(self.config.FONT_NAME, font_size)
            c.setFillColorRGB(0, 0, 0)

            if show_answers:
                answer = num1 * num2
                line = f"({i + 1}) {num1} × {num2} = {answer}"
            else:
                line = f"({i + 1}) {num1} × {num2} ="

            c.drawString(text_x, text_y, line)

    def _generate_question(self) -> str:
        """掛け算問題を生成する（後方互換性のため残す）"""
        num1 = random.randint(self.config.MIN_NUMBER, self.config.MAX_NUMBER)
        num2 = random.randint(self.config.MIN_NUMBER, self.config.MAX_NUMBER)
        return f"{num1} × {num2} ="


def _create_gui_classes():
    """PyQt5が利用可能な場合にGUIクラスを定義する"""
    from PyQt5.QtWidgets import QApplication, QWidget, QPushButton, QLabel, QLineEdit, QMessageBox, QVBoxLayout
    from PyQt5.QtCore import Qt

    class MainWindow(QWidget):
        """メインウィンドウクラス"""

        def __init__(self):
            super().__init__()
            self.config = Config()
            self.pdf_generator = PDFGenerator(self.config)
            self.init_ui()

        def init_ui(self) -> None:
            """UIを初期化する"""
            self.setWindowTitle('掛け算問題作成')
            self.setGeometry(100, 100, 300, 200)

            layout = QVBoxLayout()

            self.label = QLabel('問題数を指定してください:')
            layout.addWidget(self.label)

            self.num_questions_edit = QLineEdit()
            self.num_questions_edit.setText(str(self.config.DEFAULT_QUESTIONS))
            self.num_questions_edit.setAlignment(Qt.AlignCenter)
            layout.addWidget(self.num_questions_edit)

            self.generate_button = QPushButton('問題作成')
            self.generate_button.clicked.connect(self.on_generate_clicked)
            layout.addWidget(self.generate_button)

            self.setLayout(layout)

        def on_generate_clicked(self) -> None:
            """問題作成ボタンのクリック処理"""
            try:
                num_questions = self._validate_input()
                if num_questions is None:
                    return

                filename = self._generate_filename()

                if self.pdf_generator.generate_worksheet(num_questions, filename):
                    self._show_success_message(filename)
                else:
                    self._show_error_message("PDF生成中にエラーが発生しました。")

            except Exception as e:
                self._show_error_message(f"予期しないエラーが発生しました: {e}")

        def _validate_input(self) -> Optional[int]:
            """入力値を検証する"""
            try:
                num_questions = int(self.num_questions_edit.text())
                if num_questions <= 0:
                    self._show_error_message("問題数は1以上の数値を入力してください。")
                    return None
                if num_questions > 100:
                    self._show_error_message("問題数は100以下にしてください。")
                    return None
                return num_questions
            except ValueError:
                self._show_error_message("問題数には数値を入力してください。")
                return None

        def _generate_filename(self) -> str:
            """ファイル名を生成する"""
            timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
            return f"multiplication_{timestamp}.pdf"

        def _show_success_message(self, filename: str) -> None:
            """成功メッセージを表示する"""
            msg = QMessageBox()
            msg.setIcon(QMessageBox.Information)
            msg.setWindowTitle('完了')
            msg.setText(f'問題を作成しました: {filename}\n（解答ページ付き）')
            msg.exec_()

        def _show_error_message(self, message: str) -> None:
            """エラーメッセージを表示する"""
            msg = QMessageBox()
            msg.setIcon(QMessageBox.Warning)
            msg.setWindowTitle('エラー')
            msg.setText(message)
            msg.exec_()

    return MainWindow, QApplication


def main():
    """メイン関数"""
    MainWindow, QApplication = _create_gui_classes()
    app = QApplication(sys.argv)

    app.setApplicationName('掛け算問題作成')
    app.setApplicationVersion('3.0')

    window = MainWindow()
    window.show()

    sys.exit(app.exec_())


if __name__ == '__main__':
    main()
