# CÁC QUYẾT ĐỊNH THIẾT KẾ & KIẾN TRÚC HỆ THỐNG NOVACAST (DECISIONS.MD)

Dự án tuân thủ nghiêm ngặt các nguyên tắc trong `PROMPT_ANTIGRAVITY.md` và các ảnh mockup đính kèm. Dưới đây là các quyết định kỹ thuật đã lựa chọn:

## 1. Thiết kế Giao diện & Mockup Fixes
- **Thương hiệu & Logo**: Mockup có ảnh hiển thị "KHOvoCAST" (do AI sinh ảnh), hệ thống chuẩn hóa thống nhất toàn bộ là **NovaCast** ("Nova" trắng + "Cast" vàng cam `#F59E0B`).
- **Sidebar**: Đồng bộ theo mục 4 của tài liệu. Nền navy đậm `#16213E`, mục active bo tròn xanh `#1565F5`, chân sidebar tích hợp mục "Về trang chủ (Đổi loại hình)" và avatar/đăng xuất.
- **Tiền tệ & Số**: Mọi trường giá trị tài chính trong DB lưu kiểu `BIGINT` (VND), không dùng float. Hiển thị dạng định dạng Việt Nam `288.000đ` hoặc `25.680.000 ₫`.

## 2. Quản lý Tồn kho & Sổ cái Stock Movements
- Tuyệt đối không cập nhật trực tiếp trường tồn kho tự do. Mọi biến động nhập/xuất/bán/trả/điều chỉnh đều phải sinh bản ghi `stock_movements`.
- Cache tồn kho tại `stock_levels` và các bảng sản phẩm/vật tư được đồng bộ trong cùng transaction.
- Khi xuất/bán hàng, hệ thống bắt buộc kiểm tra tồn và chặn ngay lập tức nếu xuất vượt tồn.

## 3. Xác thực & Đa mô hình kinh doanh
- Hỗ trợ chuyển đổi nhanh giữa 3 mô hình: **Cửa hàng đồ ăn (Food)**, **Cửa hàng bán lẻ (Retail)**, và **Kho doanh nghiệp (Warehouse)**.
- Tài khoản quản trị `admin` / SĐT `0900000000` / pass `admin123`.
- Chế độ `OTP_REQUIRED=false` cho phép phát triển và demo nhanh, tự sinh mã OTP giả lập trên giao diện và log console.

## 4. Deploy Serverless (Vercel + Neon)
- Không lưu file vào đĩa local server, hỗ trợ tích hợp Vercel Blob cho ảnh sản phẩm.
- PDF sinh trực tiếp bằng `@react-pdf/renderer` tương thích 100% môi trường serverless (không dùng Puppeteer).
- Đăng ký font và xử lý tiếng Việt UTF-8 chuẩn xác.

