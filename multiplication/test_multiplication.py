"""
掛け算問題作成アプリのテスト
"""

import unittest
import tempfile
import os
from unittest.mock import patch, MagicMock

from exec_refactored import PDFGenerator, Config


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
    
    def test_generate_question(self):
        """問題生成のテスト"""
        question = self.pdf_generator._generate_question()
        
        # 形式チェック
        self.assertRegex(question, r'^\d × \d =$')
        
        # 複数回実行して範囲チェック
        for _ in range(100):
            question = self.pdf_generator._generate_question()
            parts = question.split(' × ')
            num1 = int(parts[0])
            num2 = int(parts[1].split(' =')[0])
            
            self.assertGreaterEqual(num1, self.config.MIN_NUMBER)
            self.assertLessEqual(num1, self.config.MAX_NUMBER)
            self.assertGreaterEqual(num2, self.config.MIN_NUMBER)
            self.assertLessEqual(num2, self.config.MAX_NUMBER)
    
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
    
    @patch('exec_refactored.canvas.Canvas')
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


if __name__ == '__main__':
    unittest.main()
