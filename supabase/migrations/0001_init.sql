-- daily-study: Phase 1 初期スキーマ
-- 単元コードは lib/curriculum.ts の CURRICULUM_UNITS と一致させること。

create extension if not exists "pgcrypto";

create table curriculum_units (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject in ('math','english')),
  code text not null unique,
  name_ja text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table subject_settings (
  subject text primary key check (subject in ('math','english')),
  daily_format text not null default 'multiple_small' check (daily_format in ('multiple_small','single_large')),
  problems_per_day int not null default 3,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 考査直前などに「次回生成の単元・難易度を指定したい」ための一時的な上書き。
-- cronジョブは生成前にこのテーブルを確認し、未消化(consumed=false)の行があれば優先し、生成後にconsumed=trueにする。
create table generation_overrides (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject in ('math','english')),
  unit_id uuid references curriculum_units(id),
  difficulty smallint check (difficulty between 1 and 5),
  note text,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);

create table daily_tasks (
  id uuid primary key default gen_random_uuid(),
  task_date date not null,
  subject text not null check (subject in ('math','english')),
  unit_id uuid not null references curriculum_units(id),
  difficulty smallint not null check (difficulty between 1 and 5),
  problem_type text not null check (problem_type in ('multiple_choice','short_answer','descriptive')),
  problem_statement text not null,
  choices jsonb,
  model_answer text not null,
  solution_steps text not null,
  estimated_minutes int,
  generation_model text not null,
  generation_metadata jsonb,
  created_at timestamptz not null default now()
);
create index idx_daily_tasks_date_subject on daily_tasks(task_date, subject);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references daily_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer_text text not null,
  submitted_at timestamptz not null default now()
);
create index idx_submissions_task on submissions(task_id);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references submissions(id) on delete cascade,
  is_correct boolean not null,
  score numeric(5,2) not null,
  feedback text not null,
  strengths jsonb,
  improvement_points jsonb,
  corrected_answer text,
  grading_model text not null,
  grading_metadata jsonb,
  graded_at timestamptz not null default now()
);

-- 単元ごとの習熟度。出題時の単元重み付け（弱点優先）と難易度調整の元データ。
create table user_topic_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  unit_id uuid not null references curriculum_units(id) on delete cascade,
  mastery_score numeric(6,2) not null default 50,
  current_difficulty smallint not null default 2 check (current_difficulty between 1 and 5),
  attempts_count int not null default 0,
  correct_count int not null default 0,
  last_practiced_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, unit_id)
);

create table generation_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  subject text not null check (subject in ('math','english')),
  status text not null check (status in ('pending','success','error')) default 'pending',
  problems_generated int not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Gemini API呼び出しの利用量記録。無料枠のレート制限がどのくらい残っているかを
-- アプリ側で概算するための自己集計テーブル（Google公式の正確な数値の代替）。
create table api_usage_log (
  id uuid primary key default gen_random_uuid(),
  called_at timestamptz not null default now(),
  provider text not null default 'gemini',
  model text not null,
  purpose text not null check (purpose in ('generate_problem','grade_submission')),
  status text not null check (status in ('success','rate_limited','error')),
  http_status int,
  error_message text,
  input_tokens int,
  output_tokens int
);
create index idx_api_usage_log_called_at on api_usage_log(called_at);

-- RLS: 一人用アプリだが、anonキー漏洩時の被害を抑えるため全テーブルでON
alter table curriculum_units enable row level security;
alter table subject_settings enable row level security;
alter table generation_overrides enable row level security;
alter table daily_tasks enable row level security;
alter table submissions enable row level security;
alter table reviews enable row level security;
alter table user_topic_mastery enable row level security;
alter table generation_runs enable row level security;
alter table api_usage_log enable row level security;

create policy "auth read curriculum_units" on curriculum_units for select using (auth.role() = 'authenticated');
create policy "auth read subject_settings" on subject_settings for select using (auth.role() = 'authenticated');
create policy "auth read daily_tasks" on daily_tasks for select using (auth.role() = 'authenticated');
create policy "auth read generation_runs" on generation_runs for select using (auth.role() = 'authenticated');
create policy "auth read api_usage_log" on api_usage_log for select using (auth.role() = 'authenticated');

create policy "own submissions select" on submissions for select using (auth.uid() = user_id);
create policy "own submissions insert" on submissions for insert with check (auth.uid() = user_id);

create policy "own reviews select" on reviews for select using (
  exists (select 1 from submissions s where s.id = reviews.submission_id and s.user_id = auth.uid())
);

create policy "own mastery select" on user_topic_mastery for select using (auth.uid() = user_id);
-- daily_tasks / reviews / user_topic_mastery / generation_runs / generation_overrides / api_usage_log の
-- 書き込みはサーバー側のservice-roleキー経由のみ（RLSをバイパス）。クライアント書き込みは submissions.insert のみ。

-- ============================================================
-- seed: curriculum_units（lib/curriculum.ts の CURRICULUM_UNITS と一致させること）
-- ============================================================

insert into curriculum_units (subject, code, name_ja, sort_order) values
  ('math', 'math1_expressions', '数と式', 1),
  ('math', 'math1_sets_logic', '集合と命題', 2),
  ('math', 'math1_quadratic', '二次関数', 3),
  ('math', 'math1_trig_ratio', '図形と計量（三角比）', 4),
  ('math', 'math1_data', 'データの分析', 5),
  ('math', 'mathA_combinatorics_prob', '場合の数と確率', 6),
  ('math', 'mathA_integers', '整数の性質', 7),
  ('math', 'mathA_plane_geometry', '図形の性質', 8),
  ('math', 'math2_equations_complex', '式と証明・複素数と方程式', 9),
  ('math', 'math2_coordinate_geometry', '図形と方程式', 10),
  ('math', 'math2_trig_functions', '三角関数', 11),
  ('math', 'math2_exp_log', '指数関数・対数関数', 12),
  ('math', 'math2_calculus', '微分法・積分法（数II）', 13),
  ('math', 'mathB_sequences', '数列', 14),
  ('math', 'mathB_stats_inference', '統計的な推測', 15),
  ('math', 'mathC_vectors', 'ベクトル', 16),
  ('math', 'mathC_curves_complex_plane', '平面上の曲線と複素数平面', 17),
  ('math', 'math3_limits', '極限', 18),
  ('math', 'math3_calculus_diff', '微分法（数III）', 19),
  ('math', 'math3_calculus_int', '積分法（数III）', 20),
  ('english', 'eng_reading', '長文読解', 1),
  ('english', 'eng_grammar_usage', '英文法・語法', 2),
  ('english', 'eng_writing', '英作文', 3),
  ('english', 'eng_vocabulary', '語彙・イディオム', 4),
  ('english', 'eng_interpretation', '英文解釈・構文把握', 5);

-- ============================================================
-- seed: subject_settings（初期値）
-- ============================================================

insert into subject_settings (subject, daily_format, problems_per_day, enabled) values
  ('math', 'multiple_small', 5, true),
  ('english', 'multiple_small', 1, true);
