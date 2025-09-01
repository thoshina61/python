"""
掛け算問題作成アプリケーション（リファクタリング版）

機能：
- 指定した問題数の掛け算問題をPDFで作成
- PyQt5を使用したGUIインターフェース
- 問題は1-9の数字の掛け算
"""

import sys
import random
import datetime
from typing import Optional

from PyQt5.QtWidgets import QApplication, QWidget, QPushButton, QLabel, QLineEdit, QMessageBox, QVBoxLayout
from PyQt5.QtCore import Qt

from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.lib.units import mm
from reportlab.lib.pagesizes import A4


class Config:
    """アプリケーション設定クラス"""
    
    # PDF設定
    FONT_NAME = "HeiseiKakuGo-W5"
    TITLE_FONT_SIZE = 28
    CONTENT_FONT_SIZE = 18
    TIME_FONT_SIZE = 12
    
    # レイアウト設定
    MARGIN = 18 * mm
    TOP_MARGIN = 25 * mm
    QUESTIONS_PER_ROW = 4
    
    # 問題設定
    MIN_NUMBER = 1
    MAX_NUMBER = 9
    DEFAULT_QUESTIONS = 20


class PDFGenerator:
    """PDF生成を担当するクラス"""
    
    def __init__(self, config: Config):
        self.config = config
        
    def generate_worksheet(self, num_questions: int, output_filename: str) -> bool:
        """
        掛け算問題のワークシートPDFを生成する
        
        Args:
            num_questions: 問題数
            output_filename: 出力ファイル名
            
        Returns:
            生成成功の場合True、失敗の場合False
        """
        try:
            # PDF設定
            c = canvas.Canvas(output_filename, pagesize=A4)
            self._setup_fonts(c)
            
            # レイアウト計算
            layout = self._calculate_layout(num_questions)
            
            # PDFコンテンツ作成
            self._create_header(c, num_questions)
            self._create_questions(c, num_questions, layout)
            
            c.save()
            return True
            
        except Exception as e:
            print(f"PDF生成エラー: {e}")
            return False
    
    def _setup_fonts(self, canvas_obj: canvas.Canvas) -> None:
        """フォントを設定する"""
        try:
            pdfmetrics.registerFont(UnicodeCIDFont(self.config.FONT_NAME))
        except Exception:
            # フォント登録に失敗した場合はデフォルトフォントを使用
            print("警告: フォント登録に失敗しました。デフォルトフォントを使用します。")
    
    def _calculate_layout(self, num_questions: int) -> dict:
        """レイアウト情報を計算する"""
        num_cols = min(num_questions, self.config.QUESTIONS_PER_ROW)
        num_rows = (num_questions + num_cols - 1) // num_cols  # 切り上げ除算
        
        page_width, page_height = A4
        usable_width = page_width - 2 * self.config.MARGIN
        usable_height = page_height - 2 * self.config.TOP_MARGIN - 60  # ヘッダー用スペース
        
        return {
            'num_rows': num_rows,
            'num_cols': num_cols,
            'cell_width': usable_width / num_cols,
            'cell_height': usable_height / num_rows,
            'page_width': page_width,
            'page_height': page_height
        }
    
    def _create_header(self, c: canvas.Canvas, num_questions: int) -> None:
        """PDFヘッダーを作成する"""
        page_width = A4[0]
        page_height = A4[1]
        
        # タイトル
        c.setFont(self.config.FONT_NAME, self.config.TITLE_FONT_SIZE)
        c.drawString(20 * mm, 285 * mm, f"九九もんだい{num_questions}")
        
        # 時間欄
        c.setFont(self.config.FONT_NAME, self.config.TIME_FONT_SIZE)
        c.drawString(page_width / 2, page_height - 70, "　　月　　日　（　　　分　　　秒）")
        
        # 名前欄
        c.setFont(self.config.FONT_NAME, self.config.CONTENT_FONT_SIZE)
        c.drawString(page_width / 2, page_height - 40, "名前： ___________")
    
    def _create_questions(self, c: canvas.Canvas, num_questions: int, layout: dict) -> None:
        """問題を配置する"""
        c.setFont(self.config.FONT_NAME, self.config.CONTENT_FONT_SIZE)
        
        for i in range(num_questions):
            row = i // layout['num_cols']
            col = i % layout['num_cols']
            
            x = self.config.MARGIN + col * layout['cell_width'] + 15
            y = (layout['page_height'] - self.config.TOP_MARGIN - 
                 (row + 1) * layout['cell_height'])
            
            question = self._generate_question()
            c.drawString(x, y, question)
    
    def _generate_question(self) -> str:
        """掛け算問題を生成する"""
        num1 = random.randint(self.config.MIN_NUMBER, self.config.MAX_NUMBER)
        num2 = random.randint(self.config.MIN_NUMBER, self.config.MAX_NUMBER)
        return f"{num1} × {num2} ="


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
        
        # レイアウト作成
        layout = QVBoxLayout()
        
        # 問題数入力
        self.label = QLabel('問題数を指定してください:')
        layout.addWidget(self.label)
        
        self.num_questions_edit = QLineEdit()
        self.num_questions_edit.setText(str(self.config.DEFAULT_QUESTIONS))
        self.num_questions_edit.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.num_questions_edit)
        
        # 生成ボタン
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
            
            # PDF生成
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
        msg.setText(f'問題を作成しました: {filename}')
        msg.exec_()
    
    def _show_error_message(self, message: str) -> None:
        """エラーメッセージを表示する"""
        msg = QMessageBox()
        msg.setIcon(QMessageBox.Warning)
        msg.setWindowTitle('エラー')
        msg.setText(message)
        msg.exec_()


def main():
    """メイン関数"""
    app = QApplication(sys.argv)
    
    # アプリケーションの基本設定
    app.setApplicationName('掛け算問題作成')
    app.setApplicationVersion('2.0')
    
    window = MainWindow()
    window.show()
    
    sys.exit(app.exec_())


if __name__ == '__main__':
    main()
