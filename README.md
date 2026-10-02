# 暮らしと精算 🏡

**暮らしと精算**（旧名 Kurasel）は、ふたりの暮らしとお金を整える、シンプルでモダンな精算アプリです。
レシートを撮るだけでAIが自動入力。面倒な計算はアプリに任せて、支払いや受け取りのステータスもひと目で管理。「お金のやり取り」を事務作業から「心地よいコミュニケーション」へ変えます。

<img src="/public/icon-512.png" alt="暮らしと精算のアイコン" width="120" style="border-radius: 24px;">

## ✨ 特徴 (Features)

* **🤖 AIレシートスキャン**
    * Google Gemini を活用。カメラでレシートを撮るだけで「店名・金額・日付・カテゴリ」をAIが即座に自動入力します。
* **🗂️ 家計簿の分類**
    * 「食費 > 外食」のような大分類・小分類の2段。グラフは大分類でまとめ、内訳で小分類を見られます。
* **💴 収入の記録**
    * 自分だけの収入（給料など）と、ふたりの収入（給付金・お祝いなど）を記録。分析画面で収支（貯金できた額）を見られます。精算には含めません。
    * 給与明細のスクショを AI が読み取り、総支給を収入に、天引きされた税金・社会保険料を個人の支出に記録します。
* **✅ 精算ステータス管理**
    * 月ごとに「支払い完了」「受け取り完了」のステータスを管理。誤操作防止の確認機能付きで、払い忘れや二重払いを防ぎます。
* **✨ スマート精算**
    * 通常の割り勘に加え、「スキャン手当（入力してくれた人への感謝代）」や「端数調整（100円単位）」を自動計算するスマートモードを搭載。
* **☁️ レシートクラウド保存**
    * スキャンしたレシート画像はクラウド（Supabase Storage）に自動保存。いつでも見返せます。
* **💬 豊かなコミュニケーション**
    * 履歴ごとにコメントやアニメーション付きリアクション（❤️, 👍, 🎉, 🙏）を送れ、会話が生まれます。
* **📱 PWA対応**
    * ホーム画面に追加することで、ネイティブアプリのような滑らかな操作感を実現。
* **🎨 洗練されたUI**
    * スレートグレーとホワイトを基調とした、清潔感のあるグラスモーフィズムデザイン。

## 🛠️ 技術スタック (Tech Stack)

* **Framework:** Next.js 16 (App Router)
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **Database & Storage:** Supabase (PostgreSQL)
* **AI:** Google Generative AI SDK (gemini-flash-latest)
* **Icons:** Lucide React
* **Deployment:** Vercel

## 🚀 ローカルでの実行方法 (Setup)

1.  **リポジトリのクローン**
    ```bash
    git clone [https://github.com/KouSei089/kurasel.git](https://github.com/KouSei089/kurasel.git)
    cd kurasel
    ```

2.  **依存関係のインストール**
    ```bash
    npm install
    ```

3.  **環境変数の設定**
    `.env.local` ファイルを作成し、以下のキーを設定してください。
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    GOOGLE_API_KEY=your_gemini_api_key
    ```
    Geminiのキーに `NEXT_PUBLIC_` は付けないでください。付けるとブラウザのJSに埋め込まれて誰でも読めます。AI処理は `app/api` 配下のルートでサーバー側だけが行います。

4.  **開発サーバーの起動**
    ```bash
    npm run dev
    ```
    http://localhost:3000 にアクセスして確認できます。

## 📂 データベース設定 (Supabase SQL)

`supabase/schema.sql` の中身をSupabaseのSQL Editorに貼り付けて実行してください。
テーブル・世帯（ふたりの家計）の仕組み・レシート画像用の `receipts` バケット・アクセスポリシーがまとめて作成されます。何度実行しても問題ありません。

アクセスはログインした人だけに絞っています。ふたりの記録は同じ世帯のメンバーだけ、個人の記録は本人だけが読み書きできます。

## 🔐 ログイン（Google）の設定

ログインは Supabase Auth の Google ログインです。

1. **Google Cloud Console** で OAuth クライアント（種類: ウェブ アプリケーション）を作る
    * 承認済みのリダイレクト URI: `https://<SupabaseのプロジェクトID>.supabase.co/auth/v1/callback`
2. **Supabase** の Authentication → Sign In / Providers → Google を有効にし、1のクライアントIDとシークレットを入れる
3. **Supabase** の Authentication → URL Configuration
    * Site URL: 本番のURL（例: `https://kurasel.vercel.app`）
    * Redirect URLs: `https://<本番のドメイン>/**` と `http://localhost:3000/**`

ふたりをペアにするのは「世帯」です。最初の人がログインして家計を作り、「ふたりの家計」画面の招待リンク（24時間有効・1回限り）を相手に送ります。相手はリンクから Google でログインすると同じ家計に入ります。

### 以前（合言葉ログイン）のデータを引き継ぐ

1. `supabase/schema.sql` を実行し、新しいアプリを公開する（この時点で古いアプリは使えなくなります）
2. ふたりとも新しいアプリで一度 Google ログインする
3. `supabase/migrate_legacy.sql` の先頭にある、ふたりのメールアドレスと以前の名前を書き換えて実行する

## ⏰ プロジェクトの一時停止対策

Supabaseの無料プランは、データベースへのアクセスが1週間ないとプロジェクトを一時停止し、
そのまま放置すると削除します。`.github/workflows/keepalive.yml` が1日1回だけ軽いクエリを投げて、
これを防ぎます。GitHubのリポジトリ設定で以下のSecretsを登録してください。

| Secret 名 | 値 |
|---|---|
| `SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` と同じ |
| `SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` と同じ |

## 🏗️ システム構成図 (Architecture)

```mermaid
graph TD
    User((User))
    subgraph "Frontend (PWA)"
        UI[Next.js App Router]
        Logic[Business Logic]
    end

    subgraph "Server (Next.js API Route)"
        API[/api/analyze-receipt]
    end
    
    subgraph "AI Service"
        Gemini[Google Gemini]
    end
    
    subgraph "Backend (Supabase)"
        DB[(PostgreSQL)]
        Storage[Storage Bucket]
    end

    User -->|📸 Take Photo| UI
    UI -->|🖼️ Image Data| API
    API -->|🔑 API Key はサーバー側のみ| Gemini
    Gemini -->|📝 JSON Extraction| API
    API -->|📝 Result| Logic
    Logic -->|💾 Insert Data| DB
    Logic -->|☁️ Upload Image| Storage
    DB -->|📊 Fetch History| UI
```

### 2. ER図 (Entity Relationship Diagram)

データベースの設計図です。`expenses`（支出）と `monthly_settlements`（精算ステータス）の関係などを定義します。

```mermaid
erDiagram
    USERS {
        int id PK
        string name "User Name"
    }
    
    EXPENSES {
        bigint id PK
        date purchase_date
        text store_name
        integer amount
        text category "food, daily, etc"
        text paid_by "User Name"
        text receipt_url
        jsonb reactions
        jsonb comments
        timestamp created_at
    }

    MONTHLY_SETTLEMENTS {
        text month PK "YYYY-MM"
        boolean is_paid
        boolean is_received
        timestamp updated_at
    }

    USERS ||--o{ EXPENSES : "creates"
    EXPENSES }|..|{ MONTHLY_SETTLEMENTS : "belongs to month"
```
