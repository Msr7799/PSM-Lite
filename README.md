# 🏨 PMS Lite — نظام إدارة العقارات الخفيف

نظام بسيط وقوي لإدارة الوحدات السكنية (شقق، شاليهات، استوديوهات) المؤجرة على منصات الحجز مثل Booking.com و Airbnb و Agoda.

---

## ✨ شنو يوفر لك البرنامج؟

| الميزة | الفائدة |
|--------|---------|
| **إدارة الوحدات** | تضيف كل وحداتك (شقة، شاليه، استوديو) مع أسمائها وأكوادها |
| **مزامنة التقويم (iCal)** | تربط رابط iCal من Booking/Airbnb/Agoda فيسحب الحجوزات تلقائياً |
| **التقويم** | شبكة توفر لـ 30 يوم تبين أي وحدة فاضية وأي مشغولة |
| **إدارة المحتوى** | تكتب المحتوى مرة وحدة (عنوان، وصف، قوانين) وتنسخه لكل منصة |
| **الأسعار والقواعد** | تحدد أسعار مختلفة (عادي / نهاية أسبوع / رمضان / صيف) مع أولويات |
| **تتبع الحجوزات** | تشوف كل الحجوزات مع المبالغ (إجمالي، عمولة، ضريبة، صافي) |
| **الدفعات** | تتابع المبالغ اللي وصلتك من كل منصة وتربطها بالحجوزات |
| **المصروفات** | تسجل التنظيف والصيانة والفواتير وكل مصروف |
| **التقارير** | ملخص شهري: صافي الحجوزات − المصروفات = **الربح** |
| **النشر** | تتبع التعديلات اللي ما نشرتها بعد على كل منصة |
| **ثنائي اللغة** | يدعم العربي والإنجليزي مع تبديل فوري |
| **استيراد من بوكنق** | رفع ملف Excel من Booking.com Extranet واستيراد العقارات تلقائياً |
| **لوحة العقارات (Dashboard)** | كاردات لكل عقار بالصورة والسعر والحالة وزر فتح على بوكنق |
| **مزامنة تلقائية (Cron)** | مجدول مجاني عبر Cloudflare Workers كل 30 دقيقة |

---

## 🛠 المتطلبات

- **Node.js** 20 أو أحدث
- **pnpm** (مدير الحزم)
- **PostgreSQL** (قاعدة بيانات — Neon recommended)

---

## 🚀 Setup (English)

### 1. Clone & Install

```bash
git clone <repo-url>
cd pms-lite
pnpm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
DATABASE_URL="postgresql://user:pass@your-neon-host/pms?schema=public&sslmode=require"
CRON_SECRET="a-strong-random-secret"
```

### 3. Database Migration

```bash
pnpm exec prisma migrate dev
```

Or to push directly:

```bash
pnpm exec prisma db push
```

### 4. Run Development Server

```bash
pnpm dev
```

Open: **<http://localhost:3000>**

---

## 🔄 iCal Sync

### Manual Sync

From the UI: Press **Sync Now** on the Units page or Dashboard.

API:

```bash
curl -X POST http://localhost:3000/api/sync
```

### Cron Sync (Protected)

```bash
curl -fsS http://localhost:3000/api/cron/sync \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

> ⚠️ The `x-cron-secret` is sent via **Header**, NOT query parameter (for security).

---

## ⏰ Scheduler Setup

### Option A: Local Development (Windows Task Scheduler)

1. Open Task Scheduler (`taskschd.msc`)
2. Create a new Task:
   - **Trigger**: Repeat every 30 minutes
   - **Action**: Start a program
   - **Program**: `powershell.exe`
   - **Arguments**:

     ```
     -Command "Invoke-WebRequest -Uri 'http://localhost:3000/api/cron/sync' -Method GET -Headers @{'x-cron-secret'='YOUR_CRON_SECRET'}"
     ```

Or use a simple PowerShell command:

```powershell
curl.exe -fsS http://localhost:3000/api/cron/sync -H "x-cron-secret: YOUR_CRON_SECRET"
```

### Option B: Production — Cloudflare Workers Cron Triggers (FREE)

A pre-built Cloudflare Worker is included in `ops/cron-worker/`.

#### Deploy Steps

```bash
cd ops/cron-worker

# Install dependencies
npm install

# Set secrets (you'll be prompted to enter values):
npx wrangler secret put CRON_SECRET
npx wrangler secret put SYNC_URL
# SYNC_URL = https://your-app.vercel.app/api/cron/sync

# Deploy
npx wrangler deploy
```

The worker uses Cron Triggers to call your Vercel endpoint every 30 minutes automatically.

> ⚠️ Cloudflare Cron Triggers use **UTC timezone**. `*/30 * * * *` means every 30 minutes UTC.

#### Verify

After deployment, check your Cloudflare dashboard → Workers → pms-cron-worker → Triggers to confirm the cron is active.

---

## 📥 Booking.com Excel Import

1. Go to **Import** in the navigation
2. Upload your Booking.com operations Excel file (exported from Extranet → Properties list)
3. The wizard will auto-detect columns and let you map them
4. Import creates/updates Units and ChannelListings automatically

### Supported Columns

| Column | Description | Required |
|--------|-------------|----------|
| ID | Booking Property ID | ✅ |
| Property | Property name | ✅ |
| Status | Status on Booking.com | Optional |
| Location | Property location | Optional |
| Arrivals | Check-ins in 48h | Optional |
| Departures | Check-outs in 48h | Optional |
| Guest messages | Guest message count | Optional |
| Booking messages | Booking message count | Optional |

---

## 🖼 Public Preview (OG Tags)

After importing, you can set a `bookingPublicUrl` for each property:

- Fetches `og:image`, `og:title`, `og:description` from the public booking.com page
- Cached for 24 hours (configurable TTL)
- SSRF protection: only `booking.com` domains allowed
- Used in the Dashboard cards for property preview

---

## 📋 كيف تربط كل شي؟

### الخطوة 1: أضف الوحدات 🏠

1. اروح **الوحدات** (Units)
2. اكتب اسم الوحدة (مثلاً: "شقة الجفير 1")
3. اضغط **إضافة وحدة**

### الخطوة 2: اربط روابط iCal 🔗

1. من **الوحدات**، اضغط **إدارة** على الوحدة
2. انسخ رابط iCal من Booking.com أو Airbnb:
   - **Booking.com**: الإعدادات → المزامنة → رابط تصدير iCal
   - **Airbnb**: التقويم → تصدير التقويم → انسخ الرابط
   - **Agoda**: إعدادات القناة → رابط iCal
3. ألصق الرابط واضغط **إضافة**
4. اضغط **مزامنة الآن** لسحب الحجوزات

> 💡 تقدر أيضاً ترفع ملف `.ics` مباشرة بدل الرابط

### الخطوة 3: شوف التقويم 📅

- اروح **التقويم** — تشوف شبكة 30 يوم لكل الوحدات
- الأخضر = فاضي، الأحمر = محجوز

### الخطوة 4: عبّئ بيانات الحجوزات 💰

1. اروح **الحجوزات**
2. اختار الوحدة والفترة واضغط **تحميل**
3. عبّئ المبالغ لكل حجز

### الخطوة 5: سجّل المصروفات 🧾

1. اروح **المصروفات**
2. اختار الوحدة والفئة
3. حط المبلغ والتاريخ واضغط **إضافة**

### الخطوة 6: تابع الدفعات 🏦

1. اروح **الدفعات**
2. أضف الدفعة واربطها بالحجوزات

---

## 📁 هيكل المشروع

```
pms-lite/
├── prisma/
│   └── schema.prisma          # Database schema
├── messages/
│   ├── ar.json                # Arabic translations
│   └── en.json                # English translations
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── page.tsx           # Home
│   │   │   ├── dashboard/         # Dashboard cards
│   │   │   ├── imports/booking/   # Excel Import Wizard
│   │   │   ├── units/             # Unit management
│   │   │   ├── calendar/          # Availability calendar
│   │   │   ├── content/           # Content studio
│   │   │   ├── publishing/        # Publishing board
│   │   │   ├── rates/             # Rate rules
│   │   │   ├── bookings/          # Booking financials
│   │   │   ├── payouts/           # Payout reconciliation
│   │   │   ├── expenses/          # Expense tracking
│   │   │   └── reports/           # Monthly P&L
│   │   └── api/
│   │       ├── cron/sync/         # Protected cron endpoint
│   │       ├── sync/              # Manual sync
│   │       ├── dashboard/         # Dashboard data
│   │       ├── booking/public-preview/  # OG tag fetcher
│   │       ├── imports/booking/   # Excel upload & import
│   │       └── channel-listing/   # Update listing URLs
│   ├── components/
│   ├── i18n/
│   └── lib/
│       ├── prisma.ts       # Prisma client singleton
│       ├── sync.ts         # iCal sync engine
│       ├── ical.ts         # ICS parser
│       └── rates.ts        # Rate computation engine
├── ops/
│   └── cron-worker/        # Cloudflare Worker for cron
│       ├── src/index.ts    # Scheduled handler
│       ├── wrangler.jsonc  # Wrangler config with cron
│       └── package.json
├── .env.example
├── next.config.ts
└── package.json
```

---

## 🔧 التقنيات المستخدمة

| التقنية | الاستخدام |
|---------|-----------|
| **Next.js 16** | إطار العمل الرئيسي |
| **React 19** | واجهة المستخدم |
| **Prisma** | ORM لقاعدة البيانات |
| **PostgreSQL (Neon)** | قاعدة البيانات |
| **next-intl** | الترجمة (عربي/إنجليزي) |
| **Tailwind CSS 4** | التنسيقات |
| **SheetJS (xlsx)** | قراءة ملفات Excel |
| **cheerio** | جلب OG tags من صفحات عامة |
| **node-ical** | قراءة ملفات iCal |
| **Cloudflare Workers** | مجدول مجاني (Cron Triggers) |

---

## 🔑 أوامر مفيدة

```bash
# Development
pnpm dev

# Build
pnpm build

# Start production
pnpm start

# Database
pnpm exec prisma migrate dev    # Create migration
pnpm exec prisma db push        # Push schema
pnpm exec prisma studio         # Database browser
pnpm exec prisma validate       # Validate schema

# Sync (manual)
curl -X POST http://localhost:3000/api/sync

# Sync (cron, with secret)
curl -fsS http://localhost:3000/api/cron/sync -H "x-cron-secret: YOUR_SECRET"
```

---

## ⚠️ ملاحظات مهمة

1. **البرنامج محلي**: يعمل على جهازك فقط بدون نظام تسجيل دخول. إذا تبي تنشره أونلاين، لازم تضيف نظام مصادقة (Auth).
2. **المزامنة**: تقدر تشغلها يدوي أو تلقائي عبر Cloudflare Worker (مجاني).
3. **النشر يدوي**: النظام ما ينشر المحتوى على المنصات تلقائياً.
4. **النسخ الاحتياطي**: احرص تاخذ نسخة من قاعدة البيانات بشكل دوري.
5. **OG Preview**: يجلب بيانات من صفحات booking.com العامة فقط (بدون تسجيل دخول).

---

## 📞 الدعم

هذا المشروع مطوّر لإدارة العقارات بشكل شخصي وبسيط.
