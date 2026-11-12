# NovaCast — Quản Lý Cửa Hàng Thông Minh

Hệ thống quản lý bán hàng và kho vận đa loại hình:
1. **Cửa hàng đồ ăn (F&B)**: Combo, món lẻ, định lượng nguyên liệu, voucher, đơn giao hàng, đánh giá.
2. **Cửa hàng bán lẻ (Retail)**: Biến thể size/màu, mã vạch, POS tại quầy, nhập hàng từ NCC, trả hàng & chuyển kho, kiểm kê mobile.
3. **Kho doanh nghiệp (Warehouse)**: Nguyên vật liệu, bán thành phẩm, thành phẩm, vị trí kệ Bin, phiếu nhập/xuất, cân bằng kho.

---

## 1. Yêu Cầu Môi Trường
- Node.js >= 20.x
- npm >= 10.x
- Cơ sở dữ liệu: PostgreSQL (Neon Serverless hoặc PostgreSQL Local)

---

## 2. Hướng Dẫn Cài Đặt & Chạy Local

### Bước 1: Cài đặt dependencies
```bash
cd F:\web\novacast
npm install
```

### Bước 2: Thiết lập biến môi trường
Tạo file `.env` từ `.env.example`:
```env
DATABASE_URL="postgresql://user:password@host/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@host/neondb?sslmode=require"
AUTH_SECRET="your-32-character-secret-key-goes-here"
BLOB_READ_WRITE_TOKEN="your_vercel_blob_token"
RESEND_API_KEY="your_resend_api_key"
OTP_REQUIRED=false
TZ="Asia/Ho_Chi_Minh"
```

### Bước 3: Chạy migration & seed dữ liệu
```bash
npx prisma migrate deploy   # áp các migration có sẵn trong prisma/migrations
npx prisma db seed          # chạy prisma/seed.ts qua tsx (cấu hình trong prisma.config.ts)
```
Database phải dùng bảng mã **UTF-8** (Neon mặc định là UTF-8; nếu tự cài Postgres trên Windows hãy tạo DB với `ENCODING 'UTF8' TEMPLATE template0`).
*Tài khoản quản trị demo sau khi seed:*
- **SĐT / Email**: `0900000000` / `admin@novacast.local`
- **Mật khẩu**: `admin123`

### Bước 4: Chạy môi trường phát triển
```bash
npm run dev
```
Truy cập `http://localhost:3000`.

### Bước 5: Chạy kiểm thử tự động
```bash
npm run test
```
Không có `TEST_DATABASE_URL` thì chỉ chạy unit test; test tích hợp (`src/lib/inventory.integration.test.ts`) được bỏ qua.
Để chạy test tích hợp trên PostgreSQL thật (nên dùng **database riêng**, ví dụ một Neon branch), PowerShell:
```powershell
$env:DATABASE_URL="postgresql://.../novacast_test"; $env:DIRECT_URL=$env:DATABASE_URL
npx prisma migrate deploy
$env:TEST_DATABASE_URL=$env:DATABASE_URL; npm run test
```
Test tích hợp gọi trực tiếp các Server Action và kiểm tra: nhập → chuyển kệ → bán POS → trả hàng → kiểm kê/cân bằng,
chặn hủy phiếu gây âm tồn, 2 đơn POS đồng thời, giá POS lấy từ DB, hàng lỗi không bán được, phân quyền và cách ly cửa hàng.
Sau mỗi bước sổ cái `stock_movements` = tổng `stock_levels` = cache tồn.

---

## 3. Hướng Dẫn Deploy Lên Vercel

1. **Đẩy mã nguồn lên Git Repository** (GitHub / GitLab / Bitbucket).
2. **Tạo Project trên Vercel**:
   - Chọn Import repository `novacast`.
   - Trong tab **Storage**, kết nối **Neon Postgres** (biến `DATABASE_URL` và `POSTGRES_URL_NON_POOLING` sẽ được tự động thiết lập).
   - Thêm storage **Blob** (biến `BLOB_READ_WRITE_TOKEN` được tự động cấp).
3. **Cấu hình Environment Variables trên Vercel Dashboard**:
   - `DIRECT_URL`: Connection string không pooling tới Neon.
   - `AUTH_SECRET`: Khóa bí mật JWT tối thiểu 32 ký tự.
   - `RESEND_API_KEY`: API key gửi OTP từ Resend (tùy chọn).
   - `OTP_REQUIRED`: `true` (nếu muốn bắt buộc OTP khi đăng nhập) hoặc `false`.
   - Không cần đặt `TZ`: ngày giờ hiển thị và mã phiếu luôn tính theo giờ Việt Nam trong code (`src/lib/date.ts`).
4. **Cấu hình Build & Output Settings**:
   - Build Command: `npx prisma migrate deploy && next build`
   - Install Command: `npm install`
5. **Deploy**:
   - Nhấn **Deploy**. Sau khi deploy thành công, chạy seed một lần vào database production từ máy dev:
     ```powershell
     $env:DATABASE_URL="<production_db_url>"; $env:DIRECT_URL=$env:DATABASE_URL; npx prisma db seed
     ```
     Sau khi seed, **đổi mật khẩu tài khoản admin** (`admin123` là mật khẩu demo công khai trong mã nguồn).
