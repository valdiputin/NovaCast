/**
 * Seed dữ liệu demo NovaCast — dữ liệu khớp các ảnh mockup trong F:\NovaCast.
 *
 * - Ngày tháng tính TƯƠNG ĐỐI theo ngày chạy seed ("hôm nay" = ngày chạy, giờ Việt Nam).
 * - Mọi tồn kho được tạo qua InventoryService (sổ cái stock_movements luôn khớp stock_levels).
 *   Cách làm: khai báo tồn CUỐI mong muốn cho từng (mặt hàng, vị trí) + các chứng từ đã duyệt;
 *   seed tự tính "tồn đầu kỳ" và mô phỏng theo thời gian để bảo đảm không lúc nào âm tồn.
 * - Chạy lại nhiều lần được: xoá 3 cửa hàng demo (STORE_FOOD / STORE_RETAIL / STORE_WAREHOUSE) rồi tạo lại.
 */
import {
  PrismaClient,
  LocationKind,
  MaterialType,
  MovementType,
  OrderStatus,
  PaymentMethod,
  PartnerType,
  Prisma,
  ProductStatus,
  Role,
  StoreType,
  IssueType,
  SlipKind,
  ReturnCondition,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { InventoryService } from "../src/lib/inventoryService";
import { startOfVnDay, vnDateKey } from "../src/lib/date";

const prisma = new PrismaClient();
const DAY = 86_400_000;
const TODAY = startOfVnDay(new Date());

/** Thời điểm `daysAgo` ngày trước, lúc hh:mm giờ Việt Nam */
function at(daysAgo: number, hhmm = "09:00"): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(TODAY.getTime() - daysAgo * DAY + (h * 60 + m) * 60_000);
}
const dkey = (daysAgo: number) => vnDateKey(at(daysAgo, "12:00"));
const big = (n: number) => BigInt(Math.round(n));

// Bộ sinh số ngẫu nhiên cố định → seed chạy lại cho ra cùng dữ liệu
let rngState = 20261112;
function rand() {
  rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
  return rngState / 0x7fffffff;
}
const randInt = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

// ---------------------------------------------------------------------------
// Bộ máy tồn kho: tồn cuối mong muốn + chứng từ → tồn đầu kỳ → ghi qua InventoryService
// ---------------------------------------------------------------------------
type Item = { variantId?: string; materialId?: string };
type Line = Item & { locationId: string; delta: number };
interface StockEvent {
  at: Date;
  lines: Line[]; // dùng để mô phỏng
  apply: (tx: Prisma.TransactionClient) => Promise<void>; // ghi DB qua InventoryService
  refId: string; // để chỉnh createdAt của movement theo ngày chứng từ
}

const lineKey = (l: Item & { locationId: string }) => `${l.variantId ?? ""}|${l.materialId ?? ""}|${l.locationId}`;

async function runStockPlan(
  storeId: string,
  targets: (Item & { locationId: string; qty: number; unitCost: bigint })[],
  events: StockEvent[]
) {
  // 1. Tính tồn đầu kỳ = tồn cuối − tổng biến động của chứng từ
  const net = new Map<string, number>();
  for (const ev of events) for (const l of ev.lines) net.set(lineKey(l), (net.get(lineKey(l)) ?? 0) + l.delta);
  const opening = new Map<string, number>();
  const keys = new Set([...targets.map(lineKey), ...net.keys()]);
  for (const k of keys) {
    const target = targets.find((t) => lineKey(t) === k)?.qty ?? 0;
    const o = target - (net.get(k) ?? 0);
    if (o < 0) throw new Error(`Seed: tồn đầu kỳ âm cho ${k} (${o}) — kiểm tra lại dữ liệu`);
    opening.set(k, o);
  }
  // 2. Mô phỏng theo thời gian: không lúc nào âm tồn
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const bal = new Map(opening);
  for (const ev of sorted) {
    for (const l of ev.lines) {
      const v = (bal.get(lineKey(l)) ?? 0) + l.delta;
      if (v < 0) throw new Error(`Seed: âm tồn khi mô phỏng ${lineKey(l)} lúc ${ev.at.toISOString()}`);
      bal.set(lineKey(l), v);
    }
  }
  // 3. Ghi tồn đầu kỳ (30 ngày trước) rồi các chứng từ theo thứ tự thời gian
  await prisma.$transaction(
    async (tx) => {
      for (const t of targets) {
        const o = opening.get(lineKey(t)) ?? 0;
        if (o <= 0) continue;
        await InventoryService.recordReceipt(tx, {
          storeId,
          variantId: t.variantId,
          materialId: t.materialId,
          locationId: t.locationId,
          quantity: o,
          unitCost: t.unitCost,
          refType: "OPENING",
          refId: "OPENING",
          note: "Tồn đầu kỳ",
        });
      }
      for (const ev of sorted) await ev.apply(tx);
    },
    { timeout: 120_000, maxWait: 20_000 }
  );
  await prisma.stockMovement.updateMany({ where: { storeId, refId: "OPENING" }, data: { createdAt: at(30, "08:00") } });
  for (const ev of sorted) {
    await prisma.stockMovement.updateMany({ where: { storeId, refId: ev.refId }, data: { createdAt: ev.at } });
  }
  // 4. Kiểm tra lại tồn cuối
  for (const t of targets) {
    const lvl = await prisma.stockLevel.findFirst({
      where: { locationId: t.locationId, variantId: t.variantId ?? null, materialId: t.materialId ?? null },
    });
    if ((lvl?.quantity ?? 0) !== t.qty) throw new Error(`Seed: tồn cuối sai ${lineKey(t)}: ${lvl?.quantity} ≠ ${t.qty}`);
  }
}

// ---------------------------------------------------------------------------
async function resetDemo() {
  await prisma.store.deleteMany({ where: { code: { in: ["STORE_FOOD", "STORE_RETAIL", "STORE_WAREHOUSE"] } } });
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash("admin123", 10);
  const mk = (id: string, fullName: string, phone: string, email: string) =>
    prisma.user.upsert({
      where: { phone },
      update: { fullName, email, passwordHash, isActive: true },
      create: { id, fullName, phone, email, passwordHash },
    });
  const admin = await mk("usr_admin", "admin", "0900000000", "admin@novacast.local");
  const a = await mk("usr_nva", "Nguyễn Văn A", "0900000001", "nguyenvana@novacast.local");
  const b = await mk("usr_ttb", "Trần Thị B", "0900000002", "tranthib@novacast.local");
  const c = await mk("usr_lvc", "Lê Văn C", "0900000003", "levanc@novacast.local");
  return { admin, staff: [a, b, c] };
}

async function addMembers(storeId: string, users: Awaited<ReturnType<typeof seedUsers>>) {
  await prisma.storeMember.create({ data: { storeId, userId: users.admin.id, role: Role.OWNER } });
  const [a, b, c] = users.staff;
  await prisma.storeMember.create({ data: { storeId, userId: a.id, role: Role.MANAGER } });
  await prisma.storeMember.create({ data: { storeId, userId: b.id, role: Role.STAFF } });
  await prisma.storeMember.create({ data: { storeId, userId: c.id, role: Role.STAFF } });
}

// ===========================================================================
// 1. CỬA HÀNG ĐỒ ĂN
// ===========================================================================
async function seedFood(users: Awaited<ReturnType<typeof seedUsers>>) {
  const store = await prisma.store.create({
    data: {
      code: "STORE_FOOD",
      name: "NovaCast FastFood & Drinks",
      type: StoreType.FOOD,
      address: "123 Lê Lợi, Quận 1, TP.HCM",
      phone: "0901234567",
    },
  });
  await addMembers(store.id, users);
  await prisma.stockLocation.create({
    data: { storeId: store.id, name: "Bếp Trung Tâm", kind: LocationKind.WAREHOUSE, isDefault: true },
  });

  // Danh mục (ảnh "Category Management")
  const cats: [string, number, number][] = [
    ["Gà Rán", 120, 20],
    ["Burger", 5, 10],
    ["Pizza", 0, 20],
    ["Cơm & Món Chính", 200, 20],
    ["Ăn Vặt", 150, 20],
    ["Nước Uống", 100, 100],
    ["Tráng Miệng", 70, 20],
    ["Combo Tiết Kiệm", 90, 20],
  ];
  const catId: Record<string, string> = {};
  for (let i = 0; i < cats.length; i++) {
    const [name, stockQty, minStock] = cats[i];
    const c = await prisma.category.create({ data: { storeId: store.id, name, order: i + 1, stockQty, minStock } });
    catId[name] = c.id;
  }

  // Món (ảnh "Product Management" + "Món bán chạy nhất")
  const dishes: { name: string; cat: string; price: number; discount: number; sold: number; combo?: boolean; featured?: boolean; img: string }[] = [
    { name: "Combo Gà Rán (4 người)", cat: "Combo Tiết Kiệm", price: 320000, discount: 10, sold: 210, combo: true, img: "emoji:🍗" },
    { name: "Combo Đôi Burger Bò + 2 Khoai + 2 Nước", cat: "Combo Tiết Kiệm", price: 119000, discount: 0, sold: 1568, combo: true, img: "emoji:🍔" },
    { name: "Combo Gà Rán + Khoai Tây + Coca", cat: "Combo Tiết Kiệm", price: 69000, discount: 0, sold: 2458, combo: true, img: "emoji:🍟" },
    { name: "Kem Sundae Socola", cat: "Tráng Miệng", price: 35000, discount: 0, sold: 150, img: "emoji:🍨" },
    { name: "Trà Sữa Trân Châu", cat: "Nước Uống", price: 39000, discount: 0, sold: 1789, img: "emoji:🧋" },
    { name: "Cà Phê Sữa Đá", cat: "Nước Uống", price: 29000, discount: 0, sold: 190, img: "emoji:☕" },
    { name: "Milkshake Dâu Tây", cat: "Nước Uống", price: 45000, discount: 0, sold: 120, featured: true, img: "emoji:🍓" },
    { name: "Coca Cola Ly Lớn", cat: "Nước Uống", price: 25000, discount: 0, sold: 230, img: "emoji:🥤" },
    { name: "Gà Rán Giòn Cay", cat: "Gà Rán", price: 45000, discount: 0, sold: 1523, img: "emoji:🌶️" },
  ];
  const dishId: Record<string, string> = {};
  for (let i = 0; i < dishes.length; i++) {
    const d = dishes[i];
    const p = await prisma.product.create({
      data: {
        storeId: store.id,
        categoryId: catId[d.cat],
        name: d.name,
        imageUrl: d.img,
        basePrice: big(d.price),
        discountPercent: d.discount,
        isCombo: !!d.combo,
        isFeatured: !!d.featured,
        soldCount: d.sold,
        createdAt: at(60 - i),
      },
    });
    dishId[d.name] = p.id;
  }

  await prisma.voucher.create({
    data: {
      storeId: store.id,
      code: "WELCOME10",
      type: "PERCENT",
      discountValue: BigInt(10),
      maxDiscount: big(50000),
      minOrderValue: BigInt(0),
      usageLimit: 1000,
      usedCount: 2,
      startDate: at(30),
      endDate: at(-60),
    },
  });

  // Đơn hôm nay (ảnh "Order Details Modal") — tổng doanh thu hôm nay = 283.200đ
  const todayOrders = [
    {
      code: "FV0334704784", customerName: "Nguyễn Văn Nam", customerPhone: "0912345678",
      customerAddress: "Số 123 Nguyễn Văn Cừ, Quận Long Biên, Hà Nội", note: null, paymentMethod: PaymentMethod.CASH,
      status: OrderStatus.COMPLETED, items: [["Combo Gà Rán (4 người)", 1, 119000]] as [string, number, number][],
      discount: 11900, ship: 15000, voucher: "WELCOME10", time: "08:35",
    },
    {
      code: "FV0719293822", customerName: "Thịnh Nguyễn", customerPhone: "0987654321",
      customerAddress: "45 Trần Duy Hưng, Cầu Giấy, Hà Nội", note: "Ít đá", paymentMethod: PaymentMethod.BANK_TRANSFER,
      status: OrderStatus.PENDING, items: [["Combo Đôi Burger Bò + 2 Khoai + 2 Nước", 1, 119000]] as [string, number, number][],
      discount: 11900, ship: 15000, voucher: "WELCOME10", time: "18:20",
    },
    {
      code: "FV0686099772", customerName: "Đức Trần", customerPhone: "0905123456",
      customerAddress: "Nhận tại quầy", note: null, paymentMethod: PaymentMethod.CASH,
      status: OrderStatus.CONFIRMED, items: [["Trà Sữa Trân Châu", 1, 39000]] as [string, number, number][],
      discount: 0, ship: 0, voucher: null, time: "18:25",
    },
  ];
  for (const o of todayOrders) {
    const subtotal = o.items.reduce((s, [, q, p]) => s + q * p, 0);
    await prisma.order.create({
      data: {
        storeId: store.id, code: o.code, customerName: o.customerName, customerPhone: o.customerPhone,
        customerAddress: o.customerAddress, note: o.note, paymentMethod: o.paymentMethod, status: o.status,
        subtotal: big(subtotal), discountAmount: big(o.discount), shippingFee: big(o.ship),
        totalAmount: big(subtotal - o.discount + o.ship), voucherCode: o.voucher, createdAt: at(0, o.time),
        items: { create: o.items.map(([name, q, p]) => ({ productName: name, quantity: q, unitPrice: big(p), totalPrice: big(q * p) })) },
      },
    });
  }

  // Đơn các ngày trước — doanh thu 6 ngày trước hôm nay (biểu đồ "Doanh thu 7 ngày gần nhất")
  const pastRevenue = [100000, 150000, 245000, 145000, 180000, 262200]; // ngày −6 … −1
  const names = ["Lê Quang Huy", "Phạm Thu Trang", "Hoàng Minh Tuấn", "Vũ Ngọc Anh", "Đỗ Thanh Bình", "Bùi Khánh Linh", "Ngô Gia Bảo"];
  let seq = 1;
  for (let i = 0; i < pastRevenue.length; i++) {
    const daysAgo = 6 - i;
    let remaining = pastRevenue[i];
    const n = randInt(2, 4);
    for (let k = 0; k < n; k++) {
      const last = k === n - 1;
      const lines: [string, number, number][] = [];
      let sub = 0;
      const want = last ? remaining : Math.round(remaining / (n - k) / 1000) * 1000;
      while (sub < want) {
        const d = pick(dishes);
        lines.push([d.name, 1, d.price]);
        sub += d.price;
      }
      const discount = sub - want; // phần chênh coi như giảm giá → tổng đơn đúng bằng doanh thu ngày
      remaining -= want;
      await prisma.order.create({
        data: {
          storeId: store.id, code: `FV${dkey(daysAgo)}${String(seq++).padStart(2, "0")}`,
          customerName: pick(names), customerPhone: `09${randInt(10000000, 99999999)}`,
          customerAddress: "Hà Nội", status: OrderStatus.COMPLETED, paymentMethod: PaymentMethod.CASH,
          subtotal: big(sub), discountAmount: big(discount), totalAmount: big(want),
          createdAt: at(daysAgo, `${randInt(10, 20)}:${randInt(10, 59)}`),
          items: { create: lines.map(([name, q, p]) => ({ productName: name, quantity: q, unitPrice: big(p), totalPrice: big(q * p) })) },
        },
      });
    }
  }

  // Đánh giá
  const reviews: [string, string, number, string][] = [
    ["Combo Gà Rán + Khoai Tây + Coca", "Lê Quang Huy", 5, "Gà giòn, khoai nóng, giao nhanh!"],
    ["Trà Sữa Trân Châu", "Phạm Thu Trang", 4, "Trân châu dẻo, hơi ngọt một chút."],
    ["Combo Đôi Burger Bò + 2 Khoai + 2 Nước", "Hoàng Minh Tuấn", 5, "Burger bò ngon, đáng tiền."],
    ["Gà Rán Giòn Cay", "Vũ Ngọc Anh", 3, "Cay vừa, nhưng hơi nguội khi nhận."],
  ];
  for (let i = 0; i < reviews.length; i++) {
    const [dish, author, rating, content] = reviews[i];
    await prisma.review.create({ data: { productId: dishId[dish], authorName: author, rating, content, createdAt: at(i + 1, "20:00") } });
  }
  for (const [title, message] of [
    ["Đơn hàng mới", "Đơn FV0719293822 đang chờ xử lý"],
    ["Danh mục sắp hết", "Burger chỉ còn 5"],
    ["Danh mục đã hết", "Pizza đã hết hàng"],
  ]) {
    await prisma.notification.create({ data: { storeId: store.id, title, message, type: "GENERAL" } });
  }
}

// ===========================================================================
// 2. CỬA HÀNG BÁN LẺ
// ===========================================================================
async function seedRetail(users: Awaited<ReturnType<typeof seedUsers>>) {
  const store = await prisma.store.create({
    data: {
      code: "STORE_RETAIL",
      name: "NovaCast Fashion",
      type: StoreType.RETAIL,
      address: "456 Nguyễn Huệ, Quận 1, TP.HCM",
      phone: "0902345678",
    },
  });
  await addMembers(store.id, users);
  const shelf = await prisma.stockLocation.create({ data: { storeId: store.id, name: "Kệ Trưng Bày", kind: LocationKind.SHELF, isDefault: true } });
  const wh = await prisma.stockLocation.create({ data: { storeId: store.id, name: "Kho Sau Cửa Hàng", kind: LocationKind.WAREHOUSE, isDefault: true } });
  await prisma.stockLocation.create({ data: { storeId: store.id, name: "Hàng lỗi", kind: LocationKind.DAMAGED } });

  const catNames = ["Áo thun", "Giày dép", "Áo khoác", "Phụ kiện", "Quần", "Váy"];
  const catId: Record<string, string> = {};
  for (let i = 0; i < catNames.length; i++) {
    catId[catNames[i]] = (await prisma.category.create({ data: { storeId: store.id, name: catNames[i], order: i + 1 } })).id;
  }

  // Sản phẩm: 7 sản phẩm đầu theo ảnh "Sản phẩm & Biến thể" + "Voucher"; phần còn lại là hàng trong
  // ảnh Tổng quan / Nhập hàng / Trả hàng / Kiểm kê.
  type V = { name: string; sku: string; color?: string; size?: string; shelf: number; wh: number; min: number };
  type P = {
    code: string; name: string; desc: string; cat: string; cost: number; price: number; discount: number;
    status?: ProductStatus; sold: number; img: string; variants: V[];
  };
  const products: P[] = [
    { code: "SP-AT01", name: "Áo thun local brand Basic", desc: "Cotton 100%, form rộng", cat: "Áo thun", cost: 120000, price: 299000, discount: 10, sold: 324, img: "emoji:👕",
      variants: [
        { name: "Trắng - M", sku: "SP-AT01-TM", color: "Trắng", size: "M", shelf: 5, wh: 10, min: 5 },
        { name: "Đen - L", sku: "SP-AT01-DL", color: "Đen", size: "L", shelf: 5, wh: 10, min: 5 },
        { name: "Xám - XL", sku: "SP-AT01-XXL", color: "Xám", size: "XL", shelf: 5, wh: 10, min: 5 },
      ] },
    { code: "SP-GD02", name: "Giày thể thao Air Sport", desc: "Êm ái, thoáng khí", cat: "Giày dép", cost: 699000, price: 1199000, discount: 15, sold: 187, img: "emoji:👟",
      variants: [
        { name: "Đen - 40", sku: "SP-GD02-D40", color: "Đen", size: "40", shelf: 2, wh: 3, min: 5 },
        { name: "Trắng - 42", sku: "SP-GD02-T42", color: "Trắng", size: "42", shelf: 1, wh: 2, min: 5 },
      ] },
    { code: "SP-HD03", name: "Áo hoodie Oversize", desc: "Phong cách trẻ trung", cat: "Áo khoác", cost: 499000, price: 799000, discount: 10, sold: 256, img: "emoji:🧥",
      variants: [
        { name: "Đen - L", sku: "SP-HD03-DL", color: "Đen", size: "L", shelf: 1, wh: 5, min: 8 },
        { name: "Xám - XL", sku: "SP-HD03-XXL", color: "Xám", size: "XL", shelf: 1, wh: 5, min: 8 },
      ] },
    { code: "SP-DP04", name: "Dép quai ngang", desc: "Nhẹ, bền, dễ đi", cat: "Giày dép", cost: 199000, price: 349000, discount: 0, sold: 178, img: "emoji:🩴",
      variants: [
        { name: "Đen - 40", sku: "SP-DP04-D40", color: "Đen", size: "40", shelf: 4, wh: 6, min: 3 },
        { name: "Trắng - 41", sku: "SP-DP04-T41", color: "Trắng", size: "41", shelf: 4, wh: 6, min: 3 },
      ] },
    { code: "SP-BL05", name: "Balo thời trang", desc: "Nhiều ngăn, tiện lợi", cat: "Phụ kiện", cost: 749000, price: 1099000, discount: 20, status: ProductStatus.OUT_OF_STOCK, sold: 93, img: "emoji:🎒",
      variants: [
        { name: "Đen - Trung", sku: "SP-BL05-DT", color: "Đen", size: "Trung", shelf: 1, wh: 3, min: 2 },
        { name: "Xanh - Lớn", sku: "SP-BL05-XL", color: "Xanh", size: "Lớn", shelf: 0, wh: 2, min: 2 },
      ] },
    { code: "SP-NL06", name: "Nón lưỡi trai", desc: "Thời trang, năng động", cat: "Phụ kiện", cost: 60000, price: 149000, discount: 5, sold: 120, img: "emoji:🧢",
      variants: [{ name: "Đen", sku: "SP-NL06-D", color: "Đen", shelf: 6, wh: 14, min: 5 }] },
    { code: "SP-TC07", name: "Tất cổ cao", desc: "Co giãn, thoáng khí", cat: "Phụ kiện", cost: 20000, price: 59000, discount: 0, sold: 87, img: "emoji:🧦",
      variants: [{ name: "Trắng", sku: "SP-TC07-T", color: "Trắng", shelf: 10, wh: 30, min: 10 }] },
    { code: "ATN", name: "Áo Thun Trơn", desc: "Cotton co giãn 4 chiều", cat: "Áo thun", cost: 60000, price: 300000, discount: 0, sold: 2150, img: "emoji:👕",
      variants: [
        { name: "S", sku: "ATN-001", size: "S", shelf: 0, wh: 120, min: 20 },
        { name: "L - Đen", sku: "ATN-002", color: "Đen", size: "L", shelf: 5, wh: 0, min: 20 },
      ] },
    { code: "QJN", name: "Quần Jean Nam", desc: "Denim co giãn", cat: "Quần", cost: 150000, price: 450000, discount: 0, sold: 1890, img: "emoji:👖",
      variants: [
        { name: "M", sku: "QJN-002", size: "M", shelf: 0, wh: 80, min: 20 },
        { name: "M - Xanh", sku: "QJN-003", color: "Xanh", size: "M", shelf: 8, wh: 0, min: 20 },
      ] },
    { code: "HHD", name: "Áo Hoodie Nữ", desc: "Nỉ bông mềm", cat: "Áo khoác", cost: 200000, price: 520000, discount: 0, sold: 1640, img: "emoji:🧥",
      variants: [{ name: "Hồng - M", sku: "HHD-003", color: "Hồng", size: "M", shelf: 0, wh: 60, min: 30 }] },
    { code: "QKK", name: "Quần Kaki Nam", desc: "Kaki cotton", cat: "Quần", cost: 150000, price: 420000, discount: 0, sold: 1390, img: "emoji:👖",
      variants: [{ name: "Be - 31", sku: "QKK-001", color: "Be", size: "31", shelf: 0, wh: 90, min: 20 }] },
    { code: "ATB", name: "Áo Thun Basic", desc: "Áo thun cơ bản", cat: "Áo thun", cost: 75000, price: 199000, discount: 0, sold: 1120, img: "emoji:👕",
      variants: [{ name: "Đen - M", sku: "ATB-001", color: "Đen", size: "M", shelf: 0, wh: 0 /* tính bên dưới */, min: 10 }] },
    { code: "TCT", name: "Tất Cotton", desc: "Cotton thoáng khí", cat: "Phụ kiện", cost: 15000, price: 45000, discount: 0, sold: 310, img: "emoji:🧦",
      variants: [{ name: "Free Size", sku: "TCT-001", size: "Free Size", shelf: 0, wh: 200, min: 100 }] },
    { code: "VNL", name: "Váy Nữ Thanh Lịch", desc: "Voan 2 lớp", cat: "Váy", cost: 180000, price: 390000, discount: 0, sold: 80, img: "emoji:👗",
      variants: [{ name: "Size M - Hồng", sku: "VNL-001", color: "Hồng", size: "M", shelf: 0, wh: 0, min: 10 }] },
    { code: "AKH", name: "Áo Khoác Hoodie", desc: "Nỉ dày dặn", cat: "Áo khoác", cost: 300000, price: 600000, discount: 0, sold: 140, img: "emoji:🧥",
      variants: [{ name: "Size L - Xám", sku: "AKH-001", color: "Xám", size: "L", shelf: 12, wh: 0, min: 30 }] },
    { code: "TX", name: "Túi Xách Thời Trang", desc: "Da PU", cat: "Phụ kiện", cost: 250000, price: 650000, discount: 0, sold: 60, img: "emoji:👜",
      variants: [{ name: "Nâu", sku: "TX-004", color: "Nâu", shelf: 5, wh: 10, min: 10 }] },
    { code: "NB", name: "Nón Bucket", desc: "Vải kaki", cat: "Phụ kiện", cost: 70000, price: 180000, discount: 0, sold: 75, img: "emoji:👒",
      variants: [{ name: "Đen", sku: "NB-005", color: "Đen", shelf: 6, wh: 12, min: 10 }] },
  ];

  // Áo Thun Basic là hàng tồn số lượng lớn trong kho → tổng tồn cửa hàng = 12.450 sản phẩm (ảnh Tổng quan)
  const others = products.flatMap((p) => p.variants).reduce((s, v) => s + v.shelf + v.wh, 0);
  products.find((p) => p.code === "ATB")!.variants[0].wh = 12450 - others;
  // Giá vốn Áo Thun Basic để tổng giá trị hàng tồn ≈ 125.000.000đ (ảnh Tổng quan — tab Tồn kho)
  const otherValue = products.filter((p) => p.code !== "ATB").reduce((s, p) => s + p.variants.reduce((x, v) => x + (v.shelf + v.wh) * p.cost, 0), 0);
  const atb = products.find((p) => p.code === "ATB")!;
  atb.cost = Math.round((125_000_000 - otherValue) / atb.variants[0].wh);

  const variantId: Record<string, string> = {};
  const productBySku: Record<string, P> = {};
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const created = await prisma.product.create({
      data: {
        storeId: store.id, categoryId: catId[p.cat], code: p.code, name: p.name, description: p.desc, imageUrl: p.img,
        basePrice: big(p.price), costPrice: big(p.cost), discountPercent: p.discount, status: p.status ?? ProductStatus.ACTIVE,
        soldCount: p.sold, createdAt: at(90 - i),
        variants: {
          create: p.variants.map((v) => ({
            sku: v.sku, barcode: `893${String(randInt(100000000, 999999999))}`, name: v.name, color: v.color, size: v.size,
            costPrice: big(p.cost), price: big(p.price), minStock: v.min,
            soldCount: Math.round(p.sold / p.variants.length),
          })),
        },
      },
      include: { variants: true },
    });
    for (const v of created.variants) {
      variantId[v.sku] = v.id;
      productBySku[v.sku] = p;
    }
  }

  // Đối tác
  const suppliers: Record<string, string> = {};
  for (const name of ["Công ty Dệt Kim Thành", "Công ty Vải Việt", "Công ty Phụ Liệu An Phát"]) {
    suppliers[name] = (await prisma.partner.create({ data: { storeId: store.id, type: PartnerType.SUPPLIER, name, phone: "028" + randInt(1000000, 9999999), createdAt: at(120) } })).id;
  }
  const customers: Record<string, string> = {};
  for (const [name, phone] of [["Nguyễn Thị Mai", "0911222333"], ["Trần Văn Hùng", "0922333444"], ["Lê Thị Lan", "0933444555"]]) {
    customers[name] = (await prisma.partner.create({ data: { storeId: store.id, type: PartnerType.CUSTOMER, name, phone, createdAt: at(40) } })).id;
  }
  // Khách hàng mới: 12 hôm nay, 10 hôm qua (+20%)
  const firstNames = ["An", "Bình", "Chi", "Dũng", "Giang", "Hà", "Khoa", "Lan", "Minh", "Nga", "Phúc", "Quân"];
  for (let i = 0; i < 22; i++) {
    await prisma.partner.create({
      data: {
        storeId: store.id, type: PartnerType.CUSTOMER, name: `Khách ${firstNames[i % 12]} ${i + 1}`,
        phone: `09${randInt(10000000, 99999999)}`, createdAt: i < 12 ? at(0, `${8 + (i % 10)}:15`) : at(1, `${8 + (i % 10)}:15`),
      },
    });
  }

  // ---- Chứng từ kho bán lẻ ----
  const events: StockEvent[] = [];
  const staffName = { A: "Nguyễn Văn A", B: "Trần Thị B", C: "Lê Văn C" };

  // Phiếu nhập (ảnh "Inventory Receiving")
  const receipts = [
    { code: `PNH-${dkey(0)}-01`, date: at(0, "14:30"), supplier: "Công ty Dệt Kim Thành", by: staffName.B, status: "APPROVED" as const,
      items: [["ATB-001", 500, 90000]] as [string, number, number][] },
    { code: `PNH-${dkey(2)}-02`, date: at(2, "16:20"), supplier: "Công ty Vải Việt", by: staffName.C, status: "DRAFT" as const,
      items: [["HHD-003", 150, 95000], ["QKK-001", 150, 95000]] as [string, number, number][] },
    { code: `PNH-${dkey(4)}-01`, date: at(4, "09:15"), supplier: "Công ty Phụ Liệu An Phát", by: staffName.A, status: "CANCELLED" as const,
      items: [["TCT-001", 200, 91000]] as [string, number, number][] },
  ];
  for (const r of receipts) {
    const total = r.items.reduce((s, [, q, c]) => s + q * c, 0);
    const doc = await prisma.stockReceipt.create({
      data: {
        storeId: store.id, code: r.code, supplierId: suppliers[r.supplier], receiptType: "SUPPLIER", receiptDate: r.date,
        status: r.status, totalAmount: big(total), createdByName: r.by, createdAt: r.date,
        items: { create: r.items.map(([sku, q, c]) => ({ variantId: variantId[sku], locationId: wh.id, quantity: q, unitCost: big(c), totalAmount: big(q * c) })) },
      },
    });
    if (r.status === "APPROVED") {
      events.push({
        at: r.date, refId: doc.id,
        lines: r.items.map(([sku, q]) => ({ variantId: variantId[sku], locationId: wh.id, delta: q })),
        apply: async (tx) => {
          for (const [sku, q, c] of r.items) {
            await InventoryService.recordReceipt(tx, { storeId: store.id, variantId: variantId[sku], locationId: wh.id, quantity: q, unitCost: big(c), refType: "RECEIPT", refId: doc.id, note: `Nhập hàng ${r.code}` });
          }
        },
      });
    }
  }

  // Phiếu khách trả hàng (ảnh "Returns Management")
  const damaged = await prisma.stockLocation.findFirstOrThrow({ where: { storeId: store.id, kind: LocationKind.DAMAGED } });
  const returns = [
    { code: `PRH-${dkey(0)}-01`, date: at(0, "15:30"), customer: "Nguyễn Thị Mai", condition: ReturnCondition.GOOD, status: "APPROVED" as const, items: [["AKH-001", 2, 600000]] as [string, number, number][] },
    { code: `PRH-${dkey(1)}-02`, date: at(1, "17:20"), customer: "Trần Văn Hùng", condition: ReturnCondition.DAMAGED, status: "DRAFT" as const, items: [["QJN-002", 1, 450000]] as [string, number, number][] },
    { code: `PRH-${dkey(2)}-01`, date: at(2, "14:10"), customer: "Lê Thị Lan", condition: ReturnCondition.GOOD, status: "APPROVED" as const, items: [["AKH-001", 3, 600000]] as [string, number, number][] },
  ];
  for (const r of returns) {
    const total = r.items.reduce((s, [, q, p]) => s + q * p, 0);
    const doc = await prisma.returnSlip.create({
      data: {
        storeId: store.id, code: r.code, kind: SlipKind.CUSTOMER_RETURN, customerName: r.customer, partnerId: customers[r.customer],
        condition: r.condition, slipDate: r.date, status: r.status, totalAmount: big(total), createdByName: staffName.B, createdAt: r.date,
        items: { create: r.items.map(([sku, q, p]) => ({ variantId: variantId[sku], quantity: q, unitPrice: big(p), totalAmount: big(q * p) })) },
      },
    });
    if (r.status === "APPROVED") {
      const loc = r.condition === ReturnCondition.GOOD ? shelf : damaged;
      events.push({
        at: r.date, refId: doc.id,
        lines: r.items.map(([sku, q]) => ({ variantId: variantId[sku], locationId: loc.id, delta: q })),
        apply: async (tx) => {
          for (const [sku, q] of r.items) {
            await InventoryService.recordReturn(tx, { storeId: store.id, variantId: variantId[sku], locationId: loc.id, quantity: q, isDamaged: (r.condition as ReturnCondition) === ReturnCondition.DAMAGED, refType: "RETURN", refId: doc.id, note: `Khách ${r.customer} trả hàng (${r.code})` });
          }
        },
      });
    }
  }

  // Phiếu xuất hủy & chuyển kho (không có ảnh riêng — cùng giao diện tab)
  const slips = [
    { kind: SlipKind.DISPOSE, code: `PXH-${dkey(1)}-01`, date: at(1, "10:00"), from: shelf, to: null, status: "APPROVED" as const, note: "Rách khi trưng bày", items: [["SP-TC07-T", 2, 20000]] as [string, number, number][] },
    { kind: SlipKind.DISPOSE, code: `PXH-${dkey(0)}-01`, date: at(0, "11:00"), from: shelf, to: null, status: "DRAFT" as const, note: "Ố vàng", items: [["SP-AT01-TM", 1, 120000]] as [string, number, number][] },
    { kind: SlipKind.TRANSFER, code: `PCK-${dkey(2)}-01`, date: at(2, "08:30"), from: wh, to: shelf, status: "APPROVED" as const, note: "Bổ sung kệ", items: [["SP-DP04-D40", 2, 0]] as [string, number, number][] },
    { kind: SlipKind.TRANSFER, code: `PCK-${dkey(0)}-01`, date: at(0, "08:30"), from: wh, to: shelf, status: "DRAFT" as const, note: "Bổ sung kệ", items: [["SP-NL06-D", 4, 0]] as [string, number, number][] },
  ];
  for (const s of slips) {
    const total = s.items.reduce((x, [, q, p]) => x + q * p, 0);
    const doc = await prisma.returnSlip.create({
      data: {
        storeId: store.id, code: s.code, kind: s.kind, fromLocationId: s.from.id, toLocationId: s.to?.id, slipDate: s.date,
        status: s.status, note: s.note, totalAmount: big(total), createdByName: staffName.A, createdAt: s.date,
        items: { create: s.items.map(([sku, q, p]) => ({ variantId: variantId[sku], quantity: q, unitPrice: big(p), totalAmount: big(q * p) })) },
      },
    });
    if (s.status !== "APPROVED") continue;
    if (s.kind === SlipKind.DISPOSE) {
      events.push({
        at: s.date, refId: doc.id,
        lines: s.items.map(([sku, q]) => ({ variantId: variantId[sku], locationId: s.from.id, delta: -q })),
        apply: async (tx) => {
          for (const [sku, q] of s.items) await InventoryService.recordIssue(tx, { storeId: store.id, variantId: variantId[sku], locationId: s.from.id, quantity: q, type: MovementType.DISPOSE, refType: "DISPOSE", refId: doc.id, note: `Xuất hủy: ${s.note}` });
        },
      });
    } else {
      events.push({
        at: s.date, refId: doc.id,
        lines: s.items.flatMap(([sku, q]) => [
          { variantId: variantId[sku], locationId: s.from.id, delta: -q },
          { variantId: variantId[sku], locationId: s.to!.id, delta: q },
        ]),
        apply: async (tx) => {
          for (const [sku, q] of s.items) await InventoryService.recordTransfer(tx, { storeId: store.id, variantId: variantId[sku], locationId: s.from.id, targetLocationId: s.to!.id, quantity: q, type: MovementType.TRANSFER_OUT, refId: doc.id, note: s.note });
        },
      });
    }
  }

  const targets = products.flatMap((p) =>
    p.variants.flatMap((v) => [
      { variantId: variantId[v.sku], locationId: shelf.id, qty: v.shelf, unitCost: big(p.cost) },
      { variantId: variantId[v.sku], locationId: wh.id, qty: v.wh, unitCost: big(p.cost) },
    ])
  );
  await runStockPlan(store.id, targets, events);

  // Phiếu kiểm kê đang làm (ảnh "Inventory Dashboard with Mobile Scanner")
  const auditLines: [string, number, number][] = [
    ["ATN-001", 120, 120],
    ["QJN-002", 80, 75],
    ["HHD-003", 60, 62],
    ["TCT-001", 200, 200],
    ["QKK-001", 90, 85],
  ];
  let variance = 0;
  const auditItems = auditLines.map(([sku, sys, act]) => {
    const cost = productBySku[sku].cost;
    variance += (act - sys) * cost;
    return {
      variantId: variantId[sku], locationId: wh.id, systemQty: sys, actualQty: act, variance: act - sys,
      varianceValue: big((act - sys) * cost), reason: act === sys ? null : act > sys ? "Đếm thừa so với hệ thống" : "Thiếu khi kiểm đếm",
    };
  });
  await prisma.stockAudit.create({
    data: {
      storeId: store.id, code: `PKK-${dkey(0)}-01`, auditDate: at(0, "15:30"), status: "DRAFT", note: "Kiểm kê nhóm Áo thun & Quần",
      totalVarianceValue: big(variance), createdByName: staffName.A, createdAt: at(0, "15:30"), items: { create: auditItems },
    },
  });

  // ---- Đơn hàng (lịch sử bán — chỉ để thống kê, không sinh biến động tồn) ----
  // Doanh thu & số đơn 7 ngày (ảnh Tổng quan): ngày −6 … −2 theo biểu đồ, hôm qua & hôm nay theo KPI (+12.5% / +8.7%)
  const days = [
    { daysAgo: 6, revenue: 12_500_000, orders: 155 },
    { daysAgo: 5, revenue: 14_200_000, orders: 205 },
    { daysAgo: 4, revenue: 13_800_000, orders: 190 },
    { daysAgo: 3, revenue: 16_100_000, orders: 240 },
    { daysAgo: 2, revenue: 15_600_000, orders: 205 },
    { daysAgo: 1, revenue: 22_826_700, orders: 302 },
    { daysAgo: 0, revenue: 25_680_000, orders: 328, subtotal: 28_750_000, pending: 8 },
  ];
  // Top 5 bán chạy trong tuần (ảnh Tổng quan — tab Tồn kho)
  const weekly: [string, number][] = [["ATN-001", 1850], ["QJN-002", 1620], ["HHD-003", 1420], ["QKK-001", 1200], ["ATB-001", 980]];
  const pool: [string, number][] = [];
  for (const [sku, total] of weekly) {
    let left = total;
    while (left > 0) {
      const q = Math.min(left, randInt(1, 3));
      pool.push([sku, q]);
      left -= q;
    }
  }
  // xáo trộn
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const fillers = ["SP-AT01-TM", "SP-DP04-D40", "SP-NL06-D", "SP-TC07-T"];
  const totalOrders = days.reduce((s, d) => s + d.orders, 0);
  const perOrder = Math.ceil(pool.length / totalOrders);
  let poolIdx = 0;
  const orderRows: Prisma.OrderCreateManyInput[] = [];
  const itemRows: Prisma.OrderItemCreateManyInput[] = [];
  for (const d of days) {
    const subtotalTotal = d.subtotal ?? d.revenue;
    let revLeft = d.revenue;
    let subLeft = subtotalTotal;
    for (let k = 0; k < d.orders; k++) {
      const last = k === d.orders - 1;
      const total = last ? revLeft : Math.round(d.revenue / d.orders / 100) * 100;
      const sub = last ? subLeft : Math.round(subtotalTotal / d.orders / 100) * 100;
      revLeft -= total;
      subLeft -= sub;
      const id = randomUUID();
      const minute = Math.floor((k / d.orders) * 12 * 60);
      const createdAt = new Date(at(d.daysAgo, "08:00").getTime() + minute * 60_000);
      orderRows.push({
        id, storeId: store.id, code: `DH-${dkey(d.daysAgo)}-${String(k + 1).padStart(4, "0")}`,
        customerName: "Khách lẻ", isPosOrder: rand() < 0.7, paymentMethod: pick([PaymentMethod.CASH, PaymentMethod.BANK_TRANSFER, PaymentMethod.E_WALLET]),
        status: d.pending && k >= d.orders - d.pending ? OrderStatus.PENDING : OrderStatus.COMPLETED,
        subtotal: big(sub), discountAmount: big(sub - total), totalAmount: big(total), createdAt,
      });
      const lines: [string, number][] = [];
      for (let x = 0; x < perOrder && poolIdx < pool.length; x++) lines.push(pool[poolIdx++]);
      if (lines.length === 0) lines.push([pick(fillers), 1]);
      for (const [sku, q] of lines) {
        const p = productBySku[sku];
        itemRows.push({ id: randomUUID(), orderId: id, variantId: variantId[sku], productName: p.name, variantName: sku, quantity: q, unitPrice: big(p.price), totalPrice: big(q * p.price) });
      }
    }
  }
  await prisma.order.createMany({ data: orderRows });
  for (let i = 0; i < itemRows.length; i += 2000) await prisma.orderItem.createMany({ data: itemRows.slice(i, i + 2000) });

  for (const [title, message] of [
    ["Phiếu chờ duyệt", "PNH chờ duyệt từ Công ty Vải Việt"],
    ["Hàng sắp hết", "Áo Thun Trơn (L - Đen) còn 5"],
    ["Khách trả hàng", "Trần Văn Hùng trả 1 Quần Jean Nam (M)"],
  ]) {
    await prisma.notification.create({ data: { storeId: store.id, title, message, type: "GENERAL" } });
  }
}

// ===========================================================================
// 3. KHO DOANH NGHIỆP
// ===========================================================================
async function seedWarehouse(users: Awaited<ReturnType<typeof seedUsers>>) {
  const store = await prisma.store.create({
    data: {
      code: "STORE_WAREHOUSE",
      name: "NovaCast Tổng Kho",
      type: StoreType.WAREHOUSE,
      address: "KCN Tân Bình, TP.HCM",
      phone: "0903456789",
    },
  });
  await addMembers(store.id, users);

  type M = { sku: string; name: string; type: MaterialType; unit: string; bin: string; qty: number; min: number; cost: number; img: string };
  const R = MaterialType.RAW_MATERIAL, S = MaterialType.SEMI_FINISHED, F = MaterialType.FINISHED_PRODUCT;
  const mats: M[] = [
    // 5 dòng đầu = ảnh "Danh mục Vật tư & Thành phẩm"
    { sku: "NVL-001", name: "Vải Cotton 100% (Cuộn)", type: R, unit: "Cuộn", bin: "Kệ A1 - Tầng 2", qty: 150, min: 50, cost: 300000, img: "emoji:🧵" },
    { sku: "NVL-002", name: "Sợi Polyester", type: R, unit: "Kg", bin: "Kệ B1 - Tầng 1", qty: 30, min: 30, cost: 70000, img: "emoji:🧶" },
    { sku: "SP-001", name: "Áo Thun Trơn", type: F, unit: "Cái", bin: "Kệ C1 - Tầng 1", qty: 200, min: 50, cost: 60000, img: "emoji:👕" },
    { sku: "TP-002", name: "Quần Jean", type: F, unit: "Cái", bin: "Kệ C2 - Tầng 1", qty: 20, min: 50, cost: 150000, img: "emoji:👖" },
    { sku: "BT-001", name: "Bao Bì Đóng Gói", type: S, unit: "Thùng", bin: "Kệ D1 - Tầng 2", qty: 80, min: 20, cost: 50000, img: "emoji:📦" },
    // Cảnh báo tồn kho (ảnh Tổng quan kho)
    { sku: "VT-006", name: "Thép ống D60", type: R, unit: "kg", bin: "Kệ E1 - Tầng 1", qty: 50, min: 200, cost: 25000, img: "emoji:🔩" },
    { sku: "VT-007", name: "Bao PP 50kg", type: R, unit: "bao", bin: "Kệ E1 - Tầng 2", qty: 80, min: 150, cost: 8000, img: "emoji:🛍️" },
    { sku: "VT-008", name: "Tôn lạnh 0.5mm", type: R, unit: "tấm", bin: "Kệ E2 - Tầng 1", qty: 120, min: 300, cost: 80000, img: "emoji:🪨" },
    { sku: "VT-009", name: "Ống nhựa PVC", type: R, unit: "cây", bin: "Kệ E2 - Tầng 2", qty: 200, min: 500, cost: 45000, img: "emoji:🧪" },
    { sku: "VT-010", name: "Xi măng PC40", type: R, unit: "bao", bin: "Kệ E3 - Tầng 1", qty: 300, min: 600, cost: 50000, img: "emoji:🧱" },
    // Thông báo kho (ảnh KHOvoCAST)
    { sku: "VT-011", name: "Thép Tấm A36", type: R, unit: "tấm", bin: "Kệ F1 - Tầng 1", qty: 5, min: 5, cost: 1200000, img: "emoji:⬛" },
    { sku: "VT-012", name: "Bao Bột Mì 50kg", type: R, unit: "bao", bin: "Kệ F1 - Tầng 2", qty: 10, min: 10, cost: 650000, img: "emoji:🌾" },
    { sku: "VT-013", name: "Ống Thép Phi 32", type: R, unit: "cây", bin: "Kệ F2 - Tầng 1", qty: 20, min: 20, cost: 120000, img: "emoji:🔧" },
    { sku: "VT-014", name: "Nhựa PP", type: R, unit: "kg", bin: "Kệ F2 - Tầng 2", qty: 50, min: 60, cost: 35000, img: "emoji:🧴" },
    { sku: "VT-015", name: "Gỗ MDF 18mm", type: R, unit: "tấm", bin: "Kệ F3 - Tầng 1", qty: 15, min: 10, cost: 420000, img: "emoji:🪵" },
    // Vật tư khác (đủ 25 mục)
    { sku: "VT-016", name: "Sợi Cotton chải kỹ", type: R, unit: "kg", bin: "Kệ B1 - Tầng 2", qty: 820, min: 200, cost: 25000, img: "emoji:🧶" },
    { sku: "VT-017", name: "Vải Kaki (Cuộn)", type: R, unit: "Cuộn", bin: "Kệ A2 - Tầng 1", qty: 900, min: 150, cost: 28000, img: "emoji:🧵" },
    { sku: "VT-018", name: "Khóa kéo YKK", type: R, unit: "Hộp", bin: "Kệ A3 - Tầng 1", qty: 90, min: 20, cost: 85000, img: "emoji:🤐" },
    { sku: "VT-019", name: "Nhãn mác dệt", type: R, unit: "Cuộn", bin: "Kệ A3 - Tầng 2", qty: 60, min: 15, cost: 120000, img: "emoji:🏷️" },
    { sku: "VT-020", name: "Cúc áo nhựa", type: R, unit: "Hộp", bin: "Kệ A3 - Tầng 2", qty: 120, min: 30, cost: 40000, img: "emoji:🔘" },
    { sku: "BT-021", name: "Thùng carton 5 lớp", type: S, unit: "Cái", bin: "Kệ D2 - Tầng 1", qty: 800, min: 200, cost: 12000, img: "emoji:📦" },
    { sku: "BT-022", name: "Băng keo đóng gói", type: S, unit: "Cuộn", bin: "Kệ D2 - Tầng 2", qty: 300, min: 100, cost: 18000, img: "emoji:🎞️" },
    { sku: "TP-023", name: "Quần Kaki", type: F, unit: "Cái", bin: "Kệ C3 - Tầng 1", qty: 180, min: 40, cost: 100000, img: "emoji:👖" },
    { sku: "TP-024", name: "Áo Polo", type: F, unit: "Cái", bin: "Kệ C3 - Tầng 2", qty: 160, min: 40, cost: 110000, img: "emoji:👕" },
    { sku: "TP-025", name: "Áo Hoodie", type: F, unit: "Cái", bin: "Kệ C4 - Tầng 1", qty: 140, min: 30, cost: 0 /* tính bên dưới */, img: "emoji:🧥" },
  ];
  // Giá vốn Áo Hoodie để tổng giá trị tồn ≈ 245.750.000đ (ảnh Tổng quan kho)
  const restValue = mats.filter((m) => m.sku !== "TP-025").reduce((s, m) => s + m.qty * m.cost, 0);
  const hoodie = mats.find((m) => m.sku === "TP-025")!;
  hoodie.cost = Math.round((245_750_000 - restValue) / hoodie.qty);
  if (hoodie.cost <= 0) throw new Error("Seed: tổng giá trị các vật tư khác đã vượt 245.750.000đ");

  const locId: Record<string, string> = {};
  for (const bin of [...new Set(mats.map((m) => m.bin))].sort()) {
    locId[bin] = (await prisma.stockLocation.create({ data: { storeId: store.id, name: bin, kind: LocationKind.WAREHOUSE, isDefault: bin === "Kệ A1 - Tầng 2" } })).id;
  }
  const matId: Record<string, string> = {};
  const matBySku: Record<string, M> = {};
  for (let i = 0; i < mats.length; i++) {
    const m = mats[i];
    matId[m.sku] = (
      await prisma.material.create({
        data: {
          storeId: store.id, sku: m.sku, barcode: `893${String(randInt(100000000, 999999999))}`, name: m.name, imageUrl: m.img, type: m.type, unit: m.unit,
          costPrice: big(m.cost), minStock: m.min, locationBin: m.bin, createdAt: at(120 - i),
        },
      })
    ).id;
    matBySku[m.sku] = m;
  }

  const partner: Record<string, string> = {};
  for (const name of ["Dệt Kim Thành", "Công ty Hòa Phát", "Vải Minh Khôi", "Công ty Dệt May", "Phúc Thịnh"]) {
    partner[name] = (await prisma.partner.create({ data: { storeId: store.id, type: PartnerType.SUPPLIER, name, createdAt: at(200) } })).id;
  }

  const events: StockEvent[] = [];
  type Doc = { code: string; date: Date; type: string; party: string; by: string; status: "APPROVED" | "DRAFT" | "CANCELLED"; items: [string, number, number][] };

  // Phiếu nhập kho: 5 phiếu mới nhất theo ảnh + 45 phiếu cũ hơn (tổng 50)
  const receipts: Doc[] = [
    { code: `PNK-${dkey(0)}-01`, date: at(0, "14:30"), type: "SUPPLIER", party: "Dệt Kim Thành", by: "Nguyễn Văn A", status: "APPROVED", items: [["VT-016", 500, 90000]] },
    { code: `PNK-${dkey(1)}-05`, date: at(1, "16:20"), type: "PURCHASE", party: "Công ty Hòa Phát", by: "Trần Thị B", status: "DRAFT", items: [["VT-017", 1000, 75000]] },
    { code: `PNK-${dkey(2)}-03`, date: at(2, "09:15"), type: "SUPPLIER", party: "Vải Minh Khôi", by: "Lê Văn C", status: "CANCELLED", items: [["VT-016", 800, 75000]] },
    { code: `PNK-${dkey(3)}-02`, date: at(3, "13:45"), type: "PURCHASE", party: "Công ty Dệt May", by: "Nguyễn Văn A", status: "APPROVED", items: [["VT-017", 600, 80000]] },
    { code: `PNK-${dkey(4)}-01`, date: at(4, "10:10"), type: "SUPPLIER", party: "Phúc Thịnh", by: "Trần Thị B", status: "APPROVED", items: [["VT-016", 250, 80000], ["VT-014", 50, 40000]] },
  ];
  const bigStock = ["NVL-001", "SP-001", "BT-021", "BT-022", "TP-023", "TP-024", "TP-025", "VT-018", "VT-020", "VT-019"];
  const parties = Object.keys(partner);
  const people = ["Nguyễn Văn A", "Trần Thị B", "Lê Văn C"];
  for (let i = 0; i < 45; i++) {
    const daysAgo = 5 + Math.floor(i / 2);
    const sku = bigStock[i % bigStock.length];
    const m = matBySku[sku];
    const q = Math.max(1, Math.round(m.qty * 0.05));
    receipts.push({
      code: `PNK-${dkey(daysAgo)}-${String((i % 2) + 1).padStart(2, "0")}`, date: at(daysAgo, i % 2 ? "15:00" : "09:30"),
      type: i % 3 === 0 ? "PURCHASE" : "SUPPLIER", party: parties[i % parties.length], by: people[i % 3],
      status: i % 9 === 4 ? "CANCELLED" : i % 7 === 3 ? "DRAFT" : "APPROVED", items: [[sku, q, Math.round(m.cost * 0.95)]],
    });
  }

  // Phiếu xuất kho: 5 phiếu mới nhất theo ảnh + 45 phiếu cũ hơn
  const issues: (Doc & { issueType: IssueType; workshop: string })[] = [
    { code: `PXK-${dkey(0)}-01`, date: at(0, "15:00"), type: "", issueType: IssueType.PRODUCTION, workshop: "Xưởng May 1", party: "", by: "Nguyễn Văn A", status: "APPROVED", items: [["VT-016", 400, 70000]] },
    { code: `PXK-${dkey(1)}-03`, date: at(1, "11:20"), type: "", issueType: IssueType.CUSTOMER, workshop: "Giao khách hàng", party: "", by: "Trần Thị B", status: "DRAFT", items: [["SP-001", 200, 150000]] },
    { code: `PXK-${dkey(2)}-01`, date: at(2, "14:10"), type: "", issueType: IssueType.PRODUCTION, workshop: "Xưởng May 1", party: "", by: "Lê Văn C", status: "CANCELLED", items: [["VT-016", 250, 70000]] },
    { code: `PXK-${dkey(3)}-05`, date: at(3, "09:30"), type: "", issueType: IssueType.CUSTOMER, workshop: "Giao khách hàng", party: "", by: "Nguyễn Văn A", status: "APPROVED", items: [["SP-001", 150, 150000]] },
    { code: `PXK-${dkey(4)}-03`, date: at(4, "16:45"), type: "", issueType: IssueType.PRODUCTION, workshop: "Xưởng May 2", party: "", by: "Trần Thị B", status: "APPROVED", items: [["VT-014", 300, 70000]] },
  ];
  for (let i = 0; i < 45; i++) {
    const daysAgo = 5 + Math.floor(i / 2);
    const sku = bigStock[(i + 3) % bigStock.length];
    const m = matBySku[sku];
    const q = Math.max(1, Math.round(m.qty * 0.04));
    const production = matBySku[sku].type !== MaterialType.FINISHED_PRODUCT;
    issues.push({
      code: `PXK-${dkey(daysAgo)}-${String((i % 2) + 1).padStart(2, "0")}`, date: at(daysAgo, i % 2 ? "16:00" : "10:30"), type: "",
      issueType: production ? IssueType.PRODUCTION : IssueType.CUSTOMER, workshop: production ? pick(["Xưởng May 1", "Xưởng May 2"]) : "Giao khách hàng",
      party: "", by: people[(i + 1) % 3], status: i % 8 === 5 ? "CANCELLED" : i % 6 === 2 ? "DRAFT" : "APPROVED", items: [[sku, q, m.cost]],
    });
  }

  const locOf = (sku: string) => locId[matBySku[sku].bin];
  for (const r of receipts) {
    const total = r.items.reduce((s, [, q, c]) => s + q * c, 0);
    const doc = await prisma.stockReceipt.create({
      data: {
        storeId: store.id, code: r.code, supplierId: partner[r.party], receiptType: r.type, receiptDate: r.date, status: r.status,
        totalAmount: big(total), createdByName: r.by, createdAt: r.date,
        items: { create: r.items.map(([sku, q, c]) => ({ materialId: matId[sku], locationId: locOf(sku), quantity: q, unitCost: big(c), totalAmount: big(q * c) })) },
      },
    });
    if (r.status !== "APPROVED") continue;
    events.push({
      at: r.date, refId: doc.id,
      lines: r.items.map(([sku, q]) => ({ materialId: matId[sku], locationId: locOf(sku), delta: q })),
      apply: async (tx) => {
        for (const [sku, q, c] of r.items) await InventoryService.recordReceipt(tx, { storeId: store.id, materialId: matId[sku], locationId: locOf(sku), quantity: q, unitCost: big(c), refType: "RECEIPT", refId: doc.id, note: `Nhập kho ${r.code}` });
      },
    });
  }
  for (const s of issues) {
    const total = s.items.reduce((x, [, q, c]) => x + q * c, 0);
    const doc = await prisma.stockIssue.create({
      data: {
        storeId: store.id, code: s.code, issueType: s.issueType, workshop: s.workshop, issueDate: s.date, status: s.status,
        totalAmount: big(total), createdByName: s.by, createdAt: s.date,
        items: { create: s.items.map(([sku, q, c]) => ({ materialId: matId[sku], locationId: locOf(sku), quantity: q, unitCost: big(c), totalAmount: big(q * c) })) },
      },
    });
    if (s.status !== "APPROVED") continue;
    events.push({
      at: s.date, refId: doc.id,
      lines: s.items.map(([sku, q]) => ({ materialId: matId[sku], locationId: locOf(sku), delta: -q })),
      apply: async (tx) => {
        for (const [sku, q, c] of s.items) await InventoryService.recordIssue(tx, { storeId: store.id, materialId: matId[sku], locationId: locOf(sku), quantity: q, unitCost: big(c), type: MovementType.ISSUE, refType: "ISSUE", refId: doc.id, note: `Xuất kho ${s.code}` });
      },
    });
  }

  await runStockPlan(
    store.id,
    mats.map((m) => ({ materialId: matId[m.sku], locationId: locOf(m.sku), qty: m.qty, unitCost: big(m.cost) })),
    events
  );

  // Phiên kiểm kê đã duyệt trước đó + phiên đang thực hiện (ảnh "Inventory Audit")
  await prisma.stockAudit.create({
    data: {
      storeId: store.id, code: `PKK-${dkey(12)}-01`, auditDate: at(12, "16:00"), status: "APPROVED", createdByName: "Nguyễn Văn A", createdAt: at(12, "16:00"),
      items: { create: ["VT-006", "VT-007"].map((sku) => ({ materialId: matId[sku], locationId: locOf(sku), systemQty: 0, actualQty: 0, variance: 0 })) },
    },
  });
  const auditLines: [string, number, number, string | null][] = [
    ["NVL-001", 100, 100, null],
    ["NVL-002", 250, 240, "Hao hụt trong quá trình sx"],
    ["SP-001", 500, 520, "Nhập thêm hàng"],
    ["BT-001", 1000, 980, "Hư hỏng 2 bao"],
    ["TP-002", 300, 300, null],
  ];
  let variance = 0;
  await prisma.stockAudit.create({
    data: {
      storeId: store.id, code: `PKK-${dkey(0)}-01`, auditDate: at(0, "08:00"), status: "DRAFT", createdByName: "Nguyễn Văn A", createdAt: at(0, "08:00"),
      note: "Kiểm kê định kỳ",
      items: {
        create: auditLines.map(([sku, sys, act, reason]) => {
          const v = act - sys;
          variance += v * matBySku[sku].cost;
          return { materialId: matId[sku], locationId: locOf(sku), systemQty: sys, actualQty: act, variance: v, varianceValue: big(v * matBySku[sku].cost), reason };
        }),
      },
    },
  });
  await prisma.stockAudit.updateMany({ where: { storeId: store.id, status: "DRAFT" }, data: { totalVarianceValue: big(variance) } });

  // Thông báo kho (ảnh KHOvoCAST)
  const notes: [string, string][] = [
    ["Thép Tấm A36", "Còn 5 tấm"],
    ["Bao Bột Mì 50kg", "Còn 10 bao"],
    ["Ống Thép Phi 32", "Còn 20 cây"],
    ["Nhựa PP", "Còn 50kg"],
    ["Gỗ MDF 18mm", "Còn 15 tấm"],
  ];
  for (let i = 0; i < notes.length; i++) {
    await prisma.notification.create({
      data: { storeId: store.id, title: notes[i][0], message: notes[i][1], type: "LOW_STOCK", createdAt: new Date(Date.now() - i * 60_000) },
    });
  }
}

async function main() {
  console.log("=== SEED NOVACAST (dữ liệu theo ảnh mockup) ===");
  await resetDemo();
  const users = await seedUsers();
  await seedFood(users);
  console.log("✔ Cửa hàng đồ ăn");
  await seedRetail(users);
  console.log("✔ Cửa hàng bán lẻ");
  await seedWarehouse(users);
  console.log("✔ Kho doanh nghiệp");
  console.log("Tài khoản: 0900000000 / admin123 (OWNER cả 3 cửa hàng)");
}

main()
  .catch((e) => {
    console.error("Lỗi khi seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
