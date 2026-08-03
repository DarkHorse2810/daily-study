-- 数学の日次出題で、難易度（1〜5）ごとの出題数を手動指定できるようにする。
-- null なら従来通り習熟度に応じて自動調整する。
-- 値の例: {"1":0,"2":3,"3":2,"4":0,"5":0}（合計はproblems_per_dayと一致させること、設定画面側で検証する）
alter table subject_settings add column difficulty_distribution jsonb;
