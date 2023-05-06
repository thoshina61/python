import sys
from PyQt5.QtWidgets import QApplication, QWidget, QPushButton, QLabel, QLineEdit
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm
from reportlab.lib.pagesizes import A4
import random
import datetime
import tkinter as tk
from tkinter import messagebox

# メッセージボックスを表示する関数
def show_popup(filename):
    messagebox.showinfo('完了', '問題作成しました：' + filename)

# import PySimpleGUI as sg

fontname = "HeiseiKakuGo-W5"

class MainWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.initUI()
        
    def initUI(self):
        self.setWindowTitle('掛け算問題作成')
        self.setGeometry(100, 100, 400, 300)
        
        self.label = QLabel('問題数を指定して下さい', self)
        self.label.move(50, 50)
        self.num_questions_edit = QLineEdit(self)
        self.num_questions_edit.move(50, 70)
        
        self.button = QPushButton('問題作成', self)
        self.button.move(50, 100)
        self.button.clicked.connect(self.generate_worksheet)
        
        self.show()
        
    def generate_worksheet(self):
        num_questions = int(self.num_questions_edit.text())
        
        # Calculate number of rows and columns based on number of questions
        num_rows = num_questions // 4
        if num_questions % 4 != 0:
            num_rows += 1
        num_cols = min(num_questions, 4)
        
        # Calculate cell width and height based on page size
        page_width, page_height = A4
        margin = 18 * mm
        usable_width = page_width - 2 * margin
        usable_height = page_height - 2 * margin
        cell_width = usable_width / num_cols
        cell_height = usable_height / num_rows
        
        # 源真ゴシック（ http://jikasei.me/font/genshin/）
        GEN_SHIN_GOTHIC_MEDIUM_TTF = "./fonts/GenShinGothic-Monospace-Medium.ttf"

        # Create a PDF file
        now = datetime.datetime.now()
        timestamp = now.strftime("%Y%m%d%H%M%S")
        filename = 'multiplication_' + timestamp + '.pdf'
        c = canvas.Canvas(filename, pagesize=A4)
        
        # フォント登録
        # pdfmetrics.registerFont(TTFont('GenShinGothic', GEN_SHIN_GOTHIC_MEDIUM_TTF))
        # c.setFont('GenShinGothic', 20)
        
        # フォントファイルを登録
        pdfmetrics.registerFont(UnicodeCIDFont(fontname))
        # フォントを設定
        c.setFont(fontname, 30)

        # 題名を追加する
        c.drawString(20 * mm, 285 * mm, "九九もんだい")

        # フォントを設定
        c.setFont(fontname, 20)
        # 名前欄を追加する
        c.drawString(A4[0] / 2, A4[1] - 40, "名前： ___________")

        # Draw questions in cells
        for i in range(num_questions):
            row = i // num_cols
            col = i % num_cols
            x = margin + col * cell_width
            y = page_height - margin - (row + 1) * cell_height
            # question = f'{i+1}. {random.randint(2, 9)} x {random.randint(2, 9)} ='
            question = f'{random.randint(1, 9)} x {random.randint(1, 9)} ='
            c.drawString(x, y, question)
        
        # Save the PDF file
        c.save()
        # Show message box
        show_popup(filename)
        
if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = MainWindow()

    sys.exit(app.exec_())
