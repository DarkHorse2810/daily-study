-- 単元ごとに自動出題の対象から一時的に外せるようにする（設定画面のチェックボックスで管理）。
-- overrideによる単元指定はこのフラグに関係なく機能する（意図的な単元指定を優先するため）。
alter table curriculum_units add column enabled boolean not null default true;
