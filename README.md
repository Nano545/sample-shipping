# Sample Request Manager (サンプル依頼管理システム)

Google Apps Script (GAS) + Vue.js 3 + Tailwind CSS で構築された、商品サンプル依頼および出荷管理システムです。
営業担当者によるサンプルのWeb依頼と、出荷担当者によるカンバン方式のステータス管理、出荷履歴の集計・分析を実現します。

## 機能概要

### 1. 依頼者向け機能 (Sales/Request)
- **商品検索 & カート**: JANコードや商品名でのリアルタイム検索と、複数商品のカート追加。
- **送付先入力支援**: 郵便番号API (Zipcloud) を利用した住所自動入力。
- **レスポンシブデザイン**: PC/タブレット/スマートフォンに対応したモダンなUI。

### 2. 出荷担当者向け機能 (Admin/Shipment)
- **カンバンボード**: 「未処理」「準備中」「発送済」のステータスをドラッグ＆ドロップで直感的に管理。
- **出荷詳細入力**: 発送完了時に「発送日」「出荷担当者」「送り状番号」を記録。
- **出荷通知メール**: ステータス更新時に、依頼者へ発送情報（追跡番号含む）付きのメールを自動送信。
- **帳票印刷**: 納品書/ピッキングリストとして使える注文詳細の印刷ビュー。
- **出荷履歴分析**: 期間、商品、有機区分などでフィルタリングし、商品ごとの出荷数を集計・可視化・印刷（PDF化）。

## システム構成

- **Backend**: Google Apps Script (GAS)
- **Database**: Google Sheets
- **Frontend**: HTML5, Vue.js 3 (CDN), Tailwind CSS (CDN)
- **API**: Zipcloud (住所検索)

## セットアップ手順

### 1. Google スプレッドシートの準備
新しいスプレッドシートを作成し、以下の構成にします。

#### シート1: `Orders` (注文データ用)
1行目に以下のヘッダーを設定してください。

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | timestamp | requester | zip | address | targetName | phone | targetDate | timeSlot | items | status | remarks | **shipmentDate** | **shipmentStaff** | **trackingNumber** |

#### シート2: `Products` (商品マスタ用)
1行目はヘッダー、2行目以降にデータを入力します。

| A | B | C | D |
|---|---|---|---|
| jan | name | raw_material | organic_type |
| 490... | 商品A | 原料... | 有機 |

### 2. Google Apps Script のデプロイ
1. `backend.js` の内容を GAS プロジェクトにコピーします。
2. `src` フォルダ内のHTMLファイル (`index.html`, `admin.html`, `_styles.html`, `_utils.html`) をビルド結合し、GAS側のHTMLファイルとして作成します。
   - ※本リポジトリの `build.ps1` を使用すると、ローカル環境で `index.html` (Requester用) と `admin.html` (Admin用) を生成できます。
3. `backend.js` 内の `NOTIFICATION_EMAIL` や `REQUESTER_EMAILS` を環境に合わせて設定します。
4. **デプロイ** > **新しいデプロイ** を選択。
   - **種類の選択**: ウェブアプリ
   - **次のユーザーとして実行**: 自分 (Me)
   - **アクセスできるユーザー**: 全員 (Anyone)
5. 発行された **ウェブアプリURL** を取得します。

### 3. 利用開始
- **依頼フォーム**: `[ウェブアプリURL]`
- **管理画面**: `[ウェブアプリURL]?page=admin`

## 開発・ビルド
本リポジトリはローカル開発環境を含んでいます。
- `build.ps1`: `src` ディレクトリのファイルを結合し、GASデプロイ用の単一HTMLファイルをルートに生成します。
- `npm run dev` (オプション): ローカルWebサーバーでUIを確認する場合（API連携機能はGAS上でのみ動作します）。

## ライセンス
MIT License
