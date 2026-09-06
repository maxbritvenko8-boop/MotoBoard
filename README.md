# MotoBoard Render Phone

Версия специально для загрузки с телефона: только 5 файлов, без папок.

Загрузите в корень GitHub:
- package.json
- index.js
- db.js
- render.yaml
- README.md

Render:
- Root Directory: пусто
- Build Command: npm install
- Start Command: npm start

Environment:
- NODE_ENV=production
- DATABASE_URL=строка PostgreSQL/Supabase
- MOTOBOARD_ADMIN_KEY=ваш секрет
- MOTOBOARD_TOKEN_SECRET=другой секрет

После запуска:
- /health
- /admin/
- /api/listings
