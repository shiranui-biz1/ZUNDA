ずんだもん Live2D モデル配置手順
================================

■ 1. Cubism Core SDK のダウンロード
  - https://www.live2d.com/sdk/download/web/ から Cubism SDK for Web をダウンロード
  - 展開して Core/live2dcubismcore.min.js を取得
  - このファイルを public/live2d/live2dcubismcore.min.js に配置

■ 2. ずんだもんモデルのダウンロード
  - BOOTH から無料の公式ずんだもんモデルをダウンロード
    https://booth.pm/ja/items/5363599 （VTubeStudio版）
    ※ BOOTHアカウント登録が必要（無料）

■ 3. モデルファイルの配置
  - ダウンロードした ZIP を展開
  - 展開したフォルダの中身をこの public/live2d/ ディレクトリに配置
  - 特に以下のファイルが必要:
    - *.model3.json  （モデル定義ファイル）
    - *.moc3          （モデルデータ）
    - *.physics3.json （物理演算）
    - textures/       （テクスチャ画像）
    - motions/        （モーションデータ、あれば）

■ 4. パスの確認
  - ZundamonLive2D.tsx 内の MODEL_PATH を .model3.json のパスに合わせて修正
    例: /live2d/zundamon.model3.json

■ 5. 動作確認
  - pnpm dev で起動 → http://localhost:3003
  - ずんだもんが画面に表示されることを確認
