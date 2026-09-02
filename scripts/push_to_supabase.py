"""Push the locally-built company universe (public/companies/*) into Supabase Postgres.

Creates a `companies` table (slug + the search index row + one JSONB column per detail tab) with public-read
RLS so the browser can read it with the publishable key. Reads DATABASE_URL from backend/.env.

    backend/.venv/Scripts/python.exe scripts/push_to_supabase.py
"""
import asyncio
import json
import re
from datetime import datetime
from pathlib import Path

import asyncpg

ROOT = Path(__file__).resolve().parent.parent
COMPANIES = ROOT / "public" / "companies"
DETAIL = ["profile", "financials", "footprint", "ip", "group"]

DDL = """
create table if not exists public.companies (
  slug text primary key,
  index jsonb not null,
  profile jsonb, financials jsonb, footprint jsonb, ip jsonb, group_data jsonb,
  searched_at timestamptz, updated_at timestamptz default now()
);
alter table public.companies enable row level security;
drop policy if exists "public read companies" on public.companies;
create policy "public read companies" on public.companies for select using (true);
grant select on public.companies to anon, authenticated;
"""

INSERT = """
insert into public.companies (slug, index, profile, financials, footprint, ip, group_data, searched_at)
values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8)
on conflict (slug) do update set
  index=excluded.index, profile=excluded.profile, financials=excluded.financials,
  footprint=excluded.footprint, ip=excluded.ip, group_data=excluded.group_data,
  searched_at=excluded.searched_at, updated_at=now();
"""


def to_dt(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None


def db_url() -> str:
    env = dict(l.split("=", 1) for l in (ROOT / "backend" / ".env").read_text().splitlines()
               if "=" in l and not l.strip().startswith("#"))
    return re.sub(r"\+asyncpg", "", env["DATABASE_URL"].strip().strip('"'))


def load(slug: str, name: str):
    p = COMPANIES / slug / f"{name}.json"
    return p.read_text(encoding="utf-8") if p.exists() else None


async def main():
    index = json.loads((COMPANIES / "index.json").read_text(encoding="utf-8"))
    con = await asyncpg.connect(db_url(), statement_cache_size=0, timeout=30)
    try:
        await con.execute(DDL)
        print(f"table ready. pushing {len(index)} companies…")
        n = 0
        for row in index:
            slug = row["slug"]
            await con.execute(
                INSERT, slug, json.dumps(row),
                load(slug, "profile"), load(slug, "financials"), load(slug, "footprint"),
                load(slug, "ip"), load(slug, "group"), to_dt(row.get("searched_at")),
            )
            n += 1
            if n % 50 == 0 or n == len(index):
                print(f"  {n}/{len(index)}")
        total = await con.fetchval("select count(*) from public.companies")
        print(f"done. companies in Supabase: {total}")
    finally:
        await con.close()


asyncio.run(main())
