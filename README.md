# Thainest Admin Server

ระบบแอดมินสำหรับแก้ไขไฟล์คอนเทนต์ใน repo Thainest ผ่านเว็บ + GitHub Sync

## 🚀 Features

- แก้ไขข้อความ, อัปโหลด/เปลี่ยนรูปภาพ, เพิ่ม/ลบ slide/service card/blog post
- ทุกการเปลี่ยนแปลงจะ commit/push เข้า GitHub อัตโนมัติ
- รองรับ Slider.jsx, NestWelcome.jsx, Aboutus.jsx, BlogSection.jsx, Contact.jsx, Services.jsx
- Health check endpoint สำหรับ monitoring

## 📋 Requirements

- Node.js 18+
- GitHub Personal Access Token (PAT)
- GitHub repository access

## 🔧 Environment Variables

สร้างไฟล์ `.env` ในโฟลเดอร์ `BN_Admin`:

```env
# GitHub Configuration
GITHUB_TOKEN=your_github_personal_access_token_here
OWNER=PtrwTg
REPO=Thainest

# Server Configuration
PORT=3000
NODE_ENV=production
```

### GitHub Token Setup

1. ไปที่ GitHub Settings > Developer settings > Personal access tokens
2. สร้าง token ใหม่ด้วยสิทธิ์:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)

## 🛠️ Installation

```bash
# Install dependencies
npm install

# Development
npm run dev

# Production
npm start
```

## 📡 API Endpoints

### Health Check
- `GET /health` - ตรวจสอบสถานะเซิร์ฟเวอร์

### Slider Management
- `GET /slides` - อ่าน slideTexts ทั้งหมด
- `POST /slides/add` - เพิ่ม slide ใหม่
- `POST /slides/update-image` - อัปเดตรูปภาพ slide
- `POST /slides/update-headline` - แก้ไข headline
- `POST /slides/delete` - ลบ slide

### NestWelcome Management
- `GET /nestwelcome-content` - อ่าน config
- `POST /nestwelcome-content` - แก้ไข config

### Aboutus Management
- `GET /aboutus-content` - อ่าน config
- `POST /aboutus-content` - แก้ไข config
- `POST /aboutus/service-card/add` - เพิ่ม service card
- `POST /aboutus/service-card/delete` - ลบ service card

### BlogSection Management
- `GET /blogsection-config` - อ่าน config
- `POST /blogsection-config` - แก้ไข config
- `POST /blogsection/blogpost/add` - เพิ่ม blog post
- `POST /blogsection/blogpost/delete` - ลบ blog post

### Contact Management
- `GET /contact-config` - อ่าน config
- `POST /contact-config` - แก้ไข config

### Services Management
- `GET /services-config` - อ่าน config
- `POST /services-config` - แก้ไข config
- `POST /services/upload-svg` - อัปโหลด SVG

## 🚀 Deployment

### Railway
1. สร้าง project ใหม่ใน Railway
2. Connect GitHub repository
3. ตั้งค่า environment variables:
   - `GITHUB_TOKEN`
   - `OWNER`
   - `REPO`
   - `PORT` (Railway จะกำหนดให้อัตโนมัติ)
4. Deploy

### Heroku
1. สร้าง app ใหม่ใน Heroku
2. Connect GitHub repository
3. ตั้งค่า Config Vars:
   - `GITHUB_TOKEN`
   - `OWNER`
   - `REPO`
4. Deploy

### Vercel
1. สร้าง project ใหม่ใน Vercel
2. Connect GitHub repository
3. ตั้งค่า Environment Variables
4. Deploy

## 🔍 Monitoring

- Health check: `GET /health`
- Logs: ตรวจสอบ console output
- GitHub commits: ตรวจสอบใน repository

## 🛡️ Security

- ใช้ environment variables สำหรับ sensitive data
- ตรวจสอบ GitHub token permissions
- ใช้ HTTPS ใน production
- ตั้งค่า CORS ตามความเหมาะสม

## 📝 Notes

- ระบบจะ validate environment variables ตอน startup
- ทุกการเปลี่ยนแปลงจะ commit/push อัตโนมัติ
- รูปภาพ SVG จะถูกจัดการอัตโนมัติ (import/imageMap sync)
- ใช้ regex + Function constructor สำหรับ robust JSX parsing 