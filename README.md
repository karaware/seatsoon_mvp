# SeatSoon

混雑したフードコートで、席を探している人ともうすぐ席を空ける人をゆるくつなぐスマホWebアプリMVPです。

## セットアップ

```bash
npm install
cp .env.example .env.local
```

`.env.local` にSupabaseの値を設定します。

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Supabase SQL Editorで `supabase/schema.sql` を実行してください。

既にテーブルを作成済みの場合も、Policyを更新するため同じSQLを再実行できます。

## 開発

```bash
npm run dev
```

## MVP仕様

- ログイン不要。ブラウザの `localStorage` に匿名ユーザーIDを保存します。
- スマホ利用を優先し、施設別URL `/f/[slug]` で有効な投稿を先に表示します。
- 投稿画面は `/f/[slug]/new` に分けています。
- 一覧は「席探してます」「席譲ります」の件数サマリーとタブで切り替えます。
- 予定時間はUIから外しています。
- 投稿は10分で期限切れ扱いになり、一覧から消えます。
- 投稿者本人だけが「まだ有効」「マッチしました」「取り下げ」を操作できます。
- 一覧は15秒ごとに自動更新されます。
