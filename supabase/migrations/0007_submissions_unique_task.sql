-- 1問1回のみの提出という設計をDBレベルでも保証する。
-- アプリ側のチェックだけでは、ブラウザの戻る操作や複数タブでの多重送信により
-- 同じ課題に複数の提出が作られてしまうケースが実際に発生したため、
-- 二重の安全策としてunique制約を追加する。
alter table submissions add constraint submissions_task_id_unique unique (task_id);
