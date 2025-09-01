# 掛け算問題作成アプリケーション

九九の問題を自動生成してPDFファイルとして出力するPyQt5アプリケーションです。

## 機能

- 指定した問題数の掛け算問題をPDFで作成
- 1-9の数字を使った掛け算問題を自動生成
- 学習用のヘッダー（名前欄、日付欄、時間記録欄）付き
- 4列のレイアウトで読みやすい問題配置

## リファクタリング内容

### 改善点

1. **コードの構造化**
   - `PDFGenerator`クラス: PDF生成ロジックの分離
   - `Config`クラス: 設定値の集約
   - `MainWindow`クラス: UI処理の改善

2. **保守性の向上**
   - 型ヒント（Type Hints）の追加
   - 詳細なドキュメンテーション
   - 関数の単一責任化

3. **エラーハンドリング**
   - 入力値検証の強化
   - PDF生成エラーのハンドリング
   - ユーザーフレンドリーなエラーメッセージ

4. **テストの追加**
   - ユニットテストの実装
   - 統合テストの追加
   - エッジケースのテスト

5. **設定の外部化**
   - 設定ファイル（config.py）の分離
   - 設定値の管理向上

### ファイル構成

```
multiplication/
├── exec.py                      # 元のコード
├── exec_refactored.py          # リファクタリング済みメインファイル
├── config.py                   # 設定ファイル
├── test_multiplication.py      # テストファイル
├── README.md                   # このファイル
└── fonts/                      # フォントディレクトリ
    └── GenShinGothic-Monospace-Medium.ttf
```

## 必要な環境

### Python パッケージ

```bash
pip install PyQt5 reportlab
```

### システム要件

- Python 3.7以上
- PyQt5
- reportlab
- 日本語フォント（HeiseiKakuGo-W5）

## 使用方法

### 基本的な使い方

```bash
python exec_refactored.py
```

1. アプリケーションを起動
2. 問題数を入力（デフォルト: 20問）
3. 「問題作成」ボタンをクリック
4. PDFファイルが生成される

### 設定のカスタマイズ

`config.py`ファイルを編集することで、以下の設定を変更できます：

- フォント設定
- レイアウト設定（マージン、問題配置）
- 問題生成設定（数値範囲、デフォルト問題数）

## テストの実行

```bash
python -m unittest test_multiplication.py
```

または

```bash
python test_multiplication.py
```

## 主な変更点の詳細

### 1. クラス設計の改善

**Before:**
- 全ての処理が`MainWindow`クラスに集約
- UI処理とビジネスロジックが混在

**After:**
- `PDFGenerator`: PDF生成専用クラス
- `Config`: 設定管理クラス
- `MainWindow`: UI処理専用クラス

### 2. エラーハンドリングの強化

**Before:**
```python
num_questions = int(self.num_questions_edit.text())
```

**After:**
```python
def _validate_input(self) -> Optional[int]:
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
```

### 3. レイアウト計算の改善

**Before:**
```python
num_rows = num_questions // 4
if num_questions % 4 != 0:
    num_rows += 1
```

**After:**
```python
num_rows = (num_questions + num_cols - 1) // num_cols  # 切り上げ除算
```

## トラブルシューティング

### よくある問題

1. **フォントエラー**
   - 日本語フォントが見つからない場合、デフォルトフォントを使用
   - 警告メッセージが表示されますが、動作は継続

2. **PDF生成エラー**
   - ファイル権限の確認
   - ディスク容量の確認

3. **アプリケーションが起動しない**
   - PyQt5のインストール確認
   - Python環境の確認

## 今後の改善案

- [ ] 答え付きPDFの生成機能
- [ ] 問題の難易度設定機能
- [ ] 複数ページ対応
- [ ] 他の演算（足し算、引き算）への対応
- [ ] 設定画面の追加
- [ ] ダークモード対応

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。
