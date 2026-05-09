# ⚽ eFootball Manager

Aplikasi manajemen liga eFootball lengkap — Liga, Cup, dan Champions League.

## Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend / DB**: Supabase (Auth + Postgres + RLS)
- **Deploy**: Vercel

---

## 🚀 Setup & Deploy

### 1. Clone & Install
```bash
git clone <repo-url>
cd efootball-manager
npm install
```

### 2. Setup Supabase
1. Buka project Supabase kamu di https://supabase.com
2. Pergi ke **SQL Editor**
3. Copy-paste isi file `supabase_schema.sql` dan jalankan
4. Setelah selesai, pergi ke **Authentication > Providers** → pastikan Email enabled

### 3. Config Environment
```bash
cp .env.example .env
```
Edit `.env`:
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```
> Ambil dari Supabase: **Settings > API**

### 4. Test Lokal
```bash
npm run dev
```

### 5. Deploy ke Vercel
```bash
npm install -g vercel
vercel
```
Saat ditanya, masukkan environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Atau set lewat Vercel Dashboard: **Settings > Environment Variables**

---

## 👤 Setup Admin

Setelah register akun pertama:
1. Buka Supabase Dashboard → **Table Editor → profiles**
2. Cari user kamu
3. Ubah kolom `role` dari `player` → `admin`
4. Refresh app → menu Admin Panel akan muncul

---

## 📋 Fitur

| Fitur | Deskripsi |
|-------|-----------|
| 🏆 Liga (Round-robin) | Jadwal otomatis home & away |
| ⚔️ Cup (Knockout) | Bracket eliminasi langsung |
| ⭐ Champions League | Fase grup (4 per grup) + Knockout |
| 👥 Manajemen Tim | Daftar tim, pemain, posisi, nomor jersey |
| 📅 Jadwal Otomatis | Generate jadwal 1 klik |
| ✅ Approval Flow | Hasil dilaporkan → Admin approve |
| 📊 Klasemen | Live standings dengan GD, GF, GA, Pts |
| 🎯 Statistik | Top skor, performa tim per kompetisi |
| 🔐 Auth | Register/login dengan Supabase Auth |

---

## 🗂️ Struktur Project

```
src/
├── components/
│   ├── admin/        CreateSeasonModal
│   └── layout/       Layout (sidebar nav)
├── hooks/            useAuth (AuthContext)
├── lib/              supabase.js
├── pages/
│   ├── DashboardPage
│   ├── SeasonsPage + SeasonDetail
│   ├── TeamsPage + TeamDetail
│   ├── MatchesPage
│   ├── StandingsPage
│   ├── StatisticsPage
│   ├── AdminPage
│   ├── LoginPage
│   └── RegisterPage
└── utils/            scheduler.js (round-robin, knockout, group stage)
```

---

## 🔒 Row Level Security

Semua tabel dilindungi RLS Supabase:
- **Player**: bisa buat tim, lapor hasil pertandingan tim sendiri
- **Admin**: approve tim, approve hasil, generate jadwal, manage kompetisi
