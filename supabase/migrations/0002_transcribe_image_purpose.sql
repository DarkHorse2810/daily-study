-- 写真からの解答読み取り機能のため、api_usage_log.purposeに 'transcribe_image' を追加する。
alter table api_usage_log drop constraint if exists api_usage_log_purpose_check;
alter table api_usage_log add constraint api_usage_log_purpose_check
  check (purpose in ('generate_problem', 'grade_submission', 'transcribe_image'));
