-- URIGG 대시보드 D-day
-- 코워크 캘린더와 같은 Supabase 프로젝트에서 실행: 대시보드 > SQL Editor 에 붙여넣고 Run
-- 로그인한 본인 것만 보고 고칠 수 있다 (events 표와 같은 규칙).

create table public.ddays (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 60),
  target      date not null,
  is_main     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index ddays_user_target_idx on public.ddays (user_id, target);

-- 메인 D-day는 사람마다 하나만
create unique index ddays_one_main_idx on public.ddays (user_id) where is_main;

alter table public.ddays enable row level security;

create policy "ddays: owner only" on public.ddays
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.ddays to authenticated;
grant all on public.ddays to service_role;
