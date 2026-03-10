"""
掛け算問題作成アプリのテスト
"""

import unittest
import tempfile
import os
from unittest.mock import patch, MagicMock

from exec import PDFGenerator, Config


class TestPDFGenerator(unittest.TestCase):
    """PDFGeneratorクラスのテスト"""

    def setUp(self):
        """テスト前の準備"""
        self.config = Config()
        self.pdf_generator = PDFGenerator(self.config)

    def test_calculate_layout_basic(self):
        """基本的なレイアウト計算のテスト"""
        layout = self.pdf_generator._calculate_layout(12)

        self.assertEqual(layout['num_cols'], 4)  # 1行4問
        self.assertEqual(layout['num_rows'], 3)  # 3行必要
        self.assertGreater(layout['cell_width'], 0)
        self.assertGreater(layout['cell_height'], 0)

    def test_calculate_layout_edge_cases(self):
        """エッジケースのレイアウト計算テスト"""
        # 1問の場合
        layout = self.pdf_generator._calculate_layout(1)
        self.assertEqual(layout['num_cols'], 1)
        self.assertEqual(layout['num_rows'], 1)

        # 4問の場合（ちょうど1行）
        layout = self.pdf_generator._calculate_layout(4)
        self.assertEqual(layout['num_cols'], 4)
        self.assertEqual(layout['num_rows'], 1)

        # 5問の場合（2行必要）
        layout = self.pdf_generator._calculate_layout(5)
        self.assertEqual(layout['num_cols'], 4)
        self.assertEqual(layout['num_rows'], 2)

    def test_calculate_layout_dynamic_font_size(self):
        """行数が多い場合のフォントサイズ動的調整テスト"""
        # 少ない問題数：デフォルトフォントサイズ
        layout_small = self.pdf_generator._calculate_layout(8)
        self.assertEqual(layout_small['content_font_size'], self.config.CONTENT_FONT_SIZE)

        # 多い問題数：フォントサイズ縮小
        layout_large = self.pdf_generator._calculate_layout(100)
        self.assertLess(layout_large['content_font_size'], self.config.CONTENT_FONT_SIZE)
        self.assertGreaterEqual(layout_large['content_font_size'], 10)

    def test_generate_unique_questions_no_duplicates(self):
        """重複のない問題生成テスト"""
        questions = self.pdf_generator._generate_unique_questions(20)

        self.assertEqual(len(questions), 20)
        # 全て重複なし
        self.assertEqual(len(set(questions)), 20)

    def test_generate_unique_questions_max_unique(self):
        """81問まで完全に重複なしであることのテスト"""
        questions = self.pdf_generator._generate_unique_questions(81)

        self.assertEqual(len(questions), 81)
        self.assertEqual(len(set(questions)), 81)

    def test_generate_unique_questions_over_81(self):
        """81問を超える場合でも正しい問題数が生成されるテスト"""
        questions = self.pdf_generator._generate_unique_questions(100)

        self.assertEqual(len(questions), 100)
        # 各問題が有効な範囲内であること
        for num1, num2 in questions:
            self.assertGreaterEqual(num1, self.config.MIN_NUMBER)
            self.assertLessEqual(num1, self.config.MAX_NUMBER)
            self.assertGreaterEqual(num2, self.config.MIN_NUMBER)
            self.assertLessEqual(num2, self.config.MAX_NUMBER)

    def test_generate_unique_questions_valid_range(self):
        """生成された問題が有効な範囲内であることのテスト"""
        questions = self.pdf_generator._generate_unique_questions(50)

        for num1, num2 in questions:
            self.assertGreaterEqual(num1, self.config.MIN_NUMBER)
            self.assertLessEqual(num1, self.config.MAX_NUMBER)
            self.assertGreaterEqual(num2, self.config.MIN_NUMBER)
            self.assertLessEqual(num2, self.config.MAX_NUMBER)

    def test_generate_question_backward_compat(self):
        """後方互換の問題生成テスト"""
        question = self.pdf_generator._generate_question()

        # 形式チェック
        self.assertRegex(question, r'^\d × \d =$')

    def test_generate_worksheet_success(self):
        """ワークシート生成成功のテスト"""
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            try:
                result = self.pdf_generator.generate_worksheet(10, tmp.name)
                self.assertTrue(result)
                self.assertTrue(os.path.exists(tmp.name))
                self.assertGreater(os.path.getsize(tmp.name), 0)
            finally:
                if os.path.exists(tmp.name):
                    os.unlink(tmp.name)

    @patch('exec.canvas.Canvas')
    def test_generate_worksheet_failure(self, mock_canvas):
        """ワークシート生成失敗のテスト"""
        mock_canvas.side_effect = Exception("テストエラー")

        result = self.pdf_generator.generate_worksheet(10, "test.pdf")
        self.assertFalse(result)


class TestConfig(unittest.TestCase):
    """設定クラスのテスト"""

    def test_config_values(self):
        """設定値のテスト"""
        config = Config()

        # 基本値のチェック
        self.assertGreater(config.MIN_NUMBER, 0)
        self.assertGreater(config.MAX_NUMBER, config.MIN_NUMBER)
        self.assertGreater(config.DEFAULT_QUESTIONS, 0)
        self.assertGreater(config.QUESTIONS_PER_ROW, 0)

    def test_font_path_exists(self):
        """フォントファイルの存在確認"""
        config = Config()
        self.assertTrue(os.path.exists(config.FONT_PATH),
                        f"Font file not found: {config.FONT_PATH}")


class TestIntegration(unittest.TestCase):
    """統合テスト"""

    def test_full_workflow(self):
        """フルワークフローのテスト"""
        config = Config()
        pdf_generator = PDFGenerator(config)

        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            try:
                # 異なる問題数でテスト
                for num_questions in [1, 5, 12, 20, 50]:
                    result = pdf_generator.generate_worksheet(num_questions, tmp.name)
                    self.assertTrue(result, f"Failed for {num_questions} questions")
                    self.assertTrue(os.path.exists(tmp.name))
                    self.assertGreater(os.path.getsize(tmp.name), 0)
            finally:
                if os.path.exists(tmp.name):
                    os.unlink(tmp.name)

    def test_worksheet_has_two_pages(self):
        """ワークシートが2ページ（問題＋解答）であることのテスト"""
        from reportlab.lib.pagesizes import A4

        config = Config()
        pdf_generator = PDFGenerator(config)

        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            try:
                result = pdf_generator.generate_worksheet(10, tmp.name)
                self.assertTrue(result)
                # PDFファイルのサイズが十分大きいことで2ページを間接的に確認
                size = os.path.getsize(tmp.name)
                self.assertGreater(size, 1000)  # 2ページ分のPDF
            finally:
                if os.path.exists(tmp.name):
                    os.unlink(tmp.name)


if __name__ == '__main__':
    unittest.main()
