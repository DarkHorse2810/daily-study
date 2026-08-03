-- ブラウザのWeb Push通知の購読情報（端末ごとに1行）。
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

-- 通知の登録・解除は本人のブラウザから直接行うため、RLSで本人の行のみ操作可能にする
-- （cronからの送信はservice-roleのadminクライアント経由で全件読み取る）。
create policy "own push_subscriptions select" on push_subscriptions for select using (auth.uid() = user_id);
create policy "own push_subscriptions insert" on push_subscriptions for insert with check (auth.uid() = user_id);
create policy "own push_subscriptions delete" on push_subscriptions for delete using (auth.uid() = user_id);
