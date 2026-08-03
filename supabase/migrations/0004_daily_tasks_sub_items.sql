-- 1課題に複数の選択式小問をまとめる場合（英語の単語・文法ドリル等）の構造化データ。
-- [{number, question_text, choices}] の配列。単一問題の課題ではnullのまま。
alter table daily_tasks add column sub_items jsonb;
