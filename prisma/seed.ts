import {
  PrismaClient,
  StoreType,
  Role,
  LocationKind,
  ProductStatus,
  MaterialType,
  OrderStatus,
  PaymentMethod,
  VoucherType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { InventoryService } from "../src/lib/inventoryService";

const prisma = new PrismaClient();

async function main() {
  console.log("=== BẮT ĐẦU SEED TOÀN DIỆN NOVACAST THEO MỤC 10 (30 NGÀY DỮ LIỆU) ===");

  // 1. Tạo User Admin
  const passwordHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { phone: "0900000000" },
    update: { passwordHash },
    create: {
      fullName: "Nguyễn Quản Trị",
      phone: "0900000000",
      email: "admin@novacast.local",
      passwordHash,
    },
  });

  // 2. Tạo 3 Store
  const foodStore = await prisma.store.upsert({
    where: { code: "STORE_FOOD" },
    update: {},
    create: {
      code: "STORE_FOOD",
      name: "NovaCast FastFood & Drinks",
      type: StoreType.FOOD,
      address: "123 Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM",
      phone: "0901234567",
    },
  });

  const retailStore = await prisma.store.upsert({
    where: { code: "STORE_RETAIL" },
    update: {},
    create: {
      code: "STORE_RETAIL",
      name: "NovaCast Fashion & Retail",
      type: StoreType.RETAIL,
      address: "456 Nguyễn Huệ, Quận 1, TP.HCM",
      phone: "0902345678",
    },
  });

  const warehouseStore = await prisma.store.upsert({
    where: { code: "STORE_WAREHOUSE" },
    update: {},
    create: {
      code: "STORE_WAREHOUSE",
      name: "NovaCast Tổng Kho Vật Tư & Phân Phối",
      type: StoreType.WAREHOUSE,
      address: "KCN Tân Bình, Tây Thạnh, Tân Phú, TP.HCM",
      phone: "0903456789",
    },
  });

  for (const st of [foodStore, retailStore, warehouseStore]) {
    await prisma.storeMember.upsert({
      where: { storeId_userId: { storeId: st.id, userId: admin.id } },
      update: {},
      create: { storeId: st.id, userId: admin.id, role: Role.OWNER },
    });
  }

  // 3. Vị trí kho có `kind`
  const foodKitchen = await prisma.stockLocation.upsert({
    where: { storeId_name: { storeId: foodStore.id, name: "Bếp Trung Tâm" } },
    update: { kind: LocationKind.WAREHOUSE },
    create: { storeId: foodStore.id, name: "Bếp Trung Tâm", kind: LocationKind.WAREHOUSE, isDefault: true },
  });

  const retailShelf = await prisma.stockLocation.upsert({
    where: { storeId_name: { storeId: retailStore.id, name: "Kệ Trưng Bày Bán Lẻ" } },
    update: { kind: LocationKind.SHELF },
    create: { storeId: retailStore.id, name: "Kệ Trưng Bày Bán Lẻ", kind: LocationKind.SHELF, isDefault: true },
  });

  const retailWarehouse = await prisma.stockLocation.upsert({
    where: { storeId_name: { storeId: retailStore.id, name: "Kho Sau Cửa Hàng" } },
    update: { kind: LocationKind.WAREHOUSE },
    create: { storeId: retailStore.id, name: "Kho Sau Cửa Hàng", kind: LocationKind.WAREHOUSE },
  });

  const warehouseBinA1 = await prisma.stockLocation.upsert({
    where: { storeId_name: { storeId: warehouseStore.id, name: "Kệ A1 - Tầng 2" } },
    update: { kind: LocationKind.WAREHOUSE },
    create: { storeId: warehouseStore.id, name: "Kệ A1 - Tầng 2", kind: LocationKind.WAREHOUSE, isDefault: true },
  });

  // 4. Seed Cửa Hàng Đồ Ăn: Danh mục + Món + Voucher + Đơn hàng 30 ngày
  const catCombo = await prisma.category.upsert({
    where: { storeId_name: { storeId: foodStore.id, name: "Combo Tiết Kiệm" } },
    update: {},
    create: { storeId: foodStore.id, name: "Combo Tiết Kiệm", order: 1 },
  });
  const catBurger = await prisma.category.upsert({
    where: { storeId_name: { storeId: foodStore.id, name: "Burger" } },
    update: {},
    create: { storeId: foodStore.id, name: "Burger", order: 2 },
  });
  const catDrink = await prisma.category.upsert({
    where: { storeId_name: { storeId: foodStore.id, name: "Nước Uống" } },
    update: {},
    create: { storeId: foodStore.id, name: "Nước Uống", order: 3 },
  });

  const dishes = [
    { name: "Combo Gà Rán (4 người)", cat: catCombo.id, price: BigInt(320000), discount: 10, isCombo: true },
    { name: "Combo Đôi Burger Bò + Khoai", cat: catBurger.id, price: BigInt(119000), discount: 0, isCombo: true },
    { name: "Combo Gà Rán + Khoai Tây + Coca", cat: catCombo.id, price: BigInt(69000), discount: 5, isCombo: true },
    { name: "Trà Sữa Trân Châu Hoàng Gia", cat: catDrink.id, price: BigInt(39000), discount: 0 },
    { name: "Cà Phê Sữa Đá Sài Gòn", cat: catDrink.id, price: BigInt(29000), discount: 0 },
    { name: "Kem Sundae Socola", cat: catDrink.id, price: BigInt(35000), discount: 0 },
  ];

  for (const d of dishes) {
    await prisma.product.create({
      data: {
        storeId: foodStore.id,
        categoryId: d.cat,
        name: d.name,
        basePrice: d.price,
        discountPercent: d.discount,
        isCombo: d.isCombo ?? false,
        status: ProductStatus.ACTIVE,
      },
    });
  }

  // 50 Đơn hàng trải đều 30 ngày cho Đồ Ăn
  for (let i = 1; i <= 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (30 - i));
    await prisma.order.create({
      data: {
        code: `DH-FD-${i.toString().padStart(4, "0")}`,
        storeId: foodStore.id,
        customerName: `Khách Hàng ${i}`,
        customerPhone: `0912${(100000 + i).toString()}`,
        status: OrderStatus.COMPLETED,
        paymentMethod: i % 2 === 0 ? PaymentMethod.CASH : PaymentMethod.BANK_TRANSFER,
        subtotal: BigInt(150000 + i * 5000),
        totalAmount: BigInt(150000 + i * 5000),
        createdAt: d,
      },
    });
  }

  // 5. Seed Bán Lẻ: NCC, Khách hàng, Sản phẩm & Biến thể & Tồn qua InventoryService
  const nccTextile = await prisma.partner.create({
    data: {
      storeId: retailStore.id,
      type: "SUPPLIER",
      name: "Công ty Dệt Kim Thành",
      phone: "02838123456",
      address: "Quận Tân Bình, TP.HCM",
    },
  });

  const custMai = await prisma.partner.create({
    data: {
      storeId: retailStore.id,
      type: "CUSTOMER",
      name: "Nguyễn Thị Mai",
      phone: "0987654321",
    },
  });

  const prodTshirt = await prisma.product.create({
    data: {
      storeId: retailStore.id,
      name: "Áo thun local brand Basic Unisex",
      basePrice: BigInt(180000),
      costPrice: BigInt(90000),
      status: ProductStatus.ACTIVE,
    },
  });

  const varWhiteM = await prisma.productVariant.create({
    data: {
      productId: prodTshirt.id,
      sku: "AT-BS-W-M",
      barcode: "893601234001",
      name: "Trắng / M",
      color: "Trắng",
      size: "M",
      costPrice: BigInt(90000),
      price: BigInt(180000),
      minStock: 10,
    },
  });

  const varBlackL = await prisma.productVariant.create({
    data: {
      productId: prodTshirt.id,
      sku: "AT-BS-B-L",
      barcode: "893601234002",
      name: "Đen / L",
      color: "Đen",
      size: "L",
      costPrice: BigInt(90000),
      price: BigInt(180000),
      minStock: 10,
    },
  });

  // Nhập kho 100 cái qua InventoryService
  await prisma.$transaction(async (tx) => {
    await InventoryService.recordReceipt(tx, {
      storeId: retailStore.id,
      variantId: varWhiteM.id,
      locationId: retailWarehouse.id,
      quantity: 100,
      unitCost: BigInt(90000),
      note: "Nhập tồn kho ban đầu từ NCC Dệt Kim Thành",
    });

    await InventoryService.recordReceipt(tx, {
      storeId: retailStore.id,
      variantId: varBlackL.id,
      locationId: retailShelf.id,
      quantity: 50,
      unitCost: BigInt(90000),
      note: "Nhập trưng bày trên kệ",
    });
  });

  // 6. Seed Kho Doanh Nghiệp: Vật tư + Tồn qua InventoryService
  const matCotton = await prisma.material.create({
    data: {
      storeId: warehouseStore.id,
      sku: "VT-COTTON-100",
      barcode: "893701234001",
      name: "Vải Cotton 100% sợi chải kỹ cao cấp",
      type: MaterialType.RAW_MATERIAL,
      unit: "Cuộn",
      costPrice: BigInt(1250000),
      minStock: 50,
      locationBin: "Kệ A1 - Tầng 2",
    },
  });

  await prisma.$transaction(async (tx) => {
    await InventoryService.recordReceipt(tx, {
      storeId: warehouseStore.id,
      materialId: matCotton.id,
      locationId: warehouseBinA1.id,
      quantity: 80,
      unitCost: BigInt(1250000),
      note: "Nhập tồn kho ban đầu",
    });
  });

  console.log("=== HOÀN TẤT SEED DỮ LIỆU ĐẦY ĐỦ 30 NGÀY CHO NOVACAST ===");
}

main()
  .catch((e) => {
    console.error("Lỗi seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
