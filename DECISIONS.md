# NovaCast — Quyết định thiết kế (cập nhật theo đúng code hiện tại)

Mục tiêu hiện tại: **giao diện và dữ liệu giống 18 ảnh mockup trong `F:\NovaCast\`**. Ảnh chụp app để so sánh nằm ở
`F:\NovaCast\screenshots\` (cùng tên với ảnh mockup).

## 1. Mâu thuẫn trong ảnh mockup và cách xử lý
| Ảnh mockup | Xử lý trong app |
|---|---|
| Logo "KHOvoCAST" | Luôn là **NovaCast** |
| Mỗi ảnh một sidebar khác nhau | Sidebar chuẩn cho từng loại hình (`src/components/layout/Sidebar.tsx`); đồ ăn giữ thứ tự ảnh Tổng quan, mục "Nguyên liệu" mở trang Danh mục như ảnh |
| 2 ảnh Tổng quan bán lẻ, 2 ảnh Tổng quan kho | Ảnh chính = trang Tổng quan; ảnh còn lại = tab thứ 2 ("Tồn kho" / "Hoạt động kho") |
| Trạng thái không khớp số (Balo tồn 6 "Hết hàng", Quần Jean kho 20 "Hết hàng", Tất 45/100 "Đủ hàng"…) | Trạng thái tồn **tự tính**: 0 → Hết hàng; ≤ định mức → Sắp hết; còn lại → Đủ hàng. Trạng thái bán sản phẩm có thể đặt tay "Hết hàng"/"Ngừng bán" (Balo được đặt "Hết hàng") |
| Giá bán khác nhau giữa ảnh "Sản phẩm & Biến thể" và ảnh "Voucher" | Giá vốn & giá bán theo ảnh "Sản phẩm & Biến thể" (vốn < bán); trang Voucher lấy giá bán đó làm giá gốc → 4 dòng giá gốc khác ảnh Voucher |
| Tồn vật tư ở trang Kiểm kê khác trang Danh mục | Trang Kiểm kê hiển thị **phiên kiểm kê đang thực hiện** đã chốt tồn lúc tạo phiên → hợp lệ; khi cân bằng, chênh lệch = số đếm − tồn đã chốt |
| Mã đơn trong danh sách khác mã trong modal (đồ ăn) | Modal hiển thị đúng đơn được bấm; đơn FV0334704784 có nội dung như modal |
| Số liệu KPI/biểu đồ không khớp với bảng trong cùng ảnh | KPI & biểu đồ **tính từ dữ liệu thật**; seed tạo dữ liệu sao cho các con số chính trùng ảnh (doanh thu hôm nay, số đơn, khách mới, tồn kho 12.450, giá trị tồn ≈125 triệu / ≈245,75 triệu, top 5 bán chạy…). Những số không thể khớp cùng lúc với bảng (VD "Tổng sản phẩm 1.250", "Phiếu nhập trong ngày 12") hiển thị theo dữ liệu thật |
| Ảnh sản phẩm là ảnh chụp | Dữ liệu demo dùng ảnh minh họa emoji (`imageUrl = "emoji:👕"`); thay bằng URL ảnh thật trong form sửa sản phẩm / vật tư |
| Ngày tháng cố định (12/11/2026) | Seed tính ngày **tương đối theo ngày chạy seed** (giờ Việt Nam) |

## 2. Tồn kho
- Mọi thay đổi tồn đi qua `InventoryService` → sổ cái `stock_movements` + `stock_levels` (theo vị trí) + cache trên biến thể/vật tư, trong cùng transaction.
- Vị trí có loại `SHELF` (Kệ) / `WAREHOUSE` (Kho/Bin) / `DAMAGED` (Hàng lỗi). POS bán từ Kệ; nhập NCC vào Kho; hàng lỗi không bán được.
- Chứng từ (`src/app/actions/docs.ts`): **Lưu tạm/Nháp** (không đổi tồn) → **Duyệt** (ghi sổ cái; cần quyền Quản lý) → **Hủy** (đảo ngược movement; chặn nếu làm âm tồn).
  Phiếu nhập cập nhật **giá vốn bình quân gia quyền**. Mã phiếu `PNH/PNK/PXK/PRH/PXH/PCK/PKK-YYYYMMDD-NN` theo giờ Việt Nam.
- Seed: khai báo tồn cuối + chứng từ → tự tính tồn đầu kỳ và mô phỏng theo thời gian để không lúc nào âm tồn.
- Đơn hàng lịch sử trong seed chỉ dùng cho thống kê (không sinh movement).

## 3. Phân quyền
OWNER / MANAGER / STAFF theo từng cửa hàng (`StoreMember`). Staff: tạo/lưu nháp, POS, trả hàng, chuyển kho. Quản lý trở lên: duyệt/hủy phiếu, xuất hủy, cân bằng kho, xóa.

## 4. In ấn
Trang in HTML (`/print/...`) tự mở hộp thoại in → chọn "Lưu dưới dạng PDF". Không dùng `@react-pdf/renderer` vì phải nhúng font tiếng Việt; trình duyệt in tiếng Việt chuẩn.
Tem mã vạch 50×30mm (`/print/labels?ids=`), mã vạch Code128 sinh bằng `bwip-js` ở server.

## 5. Màn quét điện thoại
`/m/audit` — dùng camera (`html5-qrcode`) hoặc nhập mã; ghi số đếm vào phiếu kiểm kê đang mở. Trang kiểm kê bán lẻ nhúng màn này trong khung điện thoại và tự làm mới mỗi 5 giây.

## 6. Kiểm chứng (12/11/2026)
- `npx tsc --noEmit`, `npx eslint src prisma`: sạch. `npm run build`: thành công, mọi route nghiệp vụ `ƒ (Dynamic)`.
- `npm run test` với `TEST_DATABASE_URL` (Postgres thật): **14/14 pass** — `inventory.integration.test.ts` (9) + `docs.integration.test.ts` (5) + unit.
- `prisma migrate deploy` + `prisma db seed` trên DB trống: thành công; đối soát sổ cái = tồn theo vị trí cho mọi mặt hàng.
- Thao tác UI thật (Edge headless): nhập hàng bằng quét mã, đổi voucher món, đổi trạng thái đơn, xuất hủy, cân bằng kho — đều thành công, không lỗi JS.

## 7. Chưa làm (ngoài phạm vi ảnh)
Gửi OTP thật qua Resend, upload ảnh lên Vercel Blob, mời nhân viên, công thức nguyên liệu đồ ăn, tạo đơn đồ ăn thủ công. Màn POS giữ bản trước (không có ảnh mockup).
