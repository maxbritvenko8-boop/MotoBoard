
import pg from "pg";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized:false } : false
});

export async function initDb(){
  await pool.query(`
    create table if not exists listings(
      id text primary key,
      source text default 'MotoBoard Admin',
      title text not null,
      price bigint not null default 0,
      city text default '',
      year int default 0,
      cc int default 0,
      hours int default 0,
      type text default 'Эндуро',
      url text default '',
      image text default '',
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
    create table if not exists users(
      id text primary key,
      username text unique not null,
      salt text not null,
      hash text not null,
      created_at timestamptz default now()
    );
    create table if not exists saves(
      user_id text primary key,
      state jsonb not null,
      updated_at timestamptz default now()
    );
  `);
}
