import {
  PrismaClient,
  StoreType,
  Role,
  MovementType,
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
  console.log("=== BẮT ĐẦU SEED DỮ LIỆU ĐẦY ĐỦ CHO NOVACAST THEO MỤC 10 ===");

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

  // Gán role OWNER
  for (const st of [foodStore, retailStore, warehouseStore]) {
    await prisma.storeMember.upsert({
      where: { storeId_userId: { storeId: st.id, userId: admin.id } },
      update: {},
      create: { storeId: st.id, userId: admin.id, role: Role.OWNER },
    });
  }

  // 3. Vị trí kho mặc định cho 3 store
  const foodKitchen = await prisma.stockLocation.upsert({
    where: { storeId_name: { storeId: foodStore.id, name: "Bếp Trung Tâm" } },
    update: {},
    create: { storeId: foodStore.id, name: "Bếp Trung Tâm", isDefault: true },
  });

  const retailShelf = await prisma.stockLocation.upsert({
    where: { storeId_name: { storeId: retailStore.id, name: "Kệ Trưng Bày Bán Lẻ" } },
    update: {},
    create: { storeId: retailStore.id, name: "Kệ Trưng Bày Bán Lẻ", isDefault: true },
  });

  const retailWarehouse = await prisma.stockLocation.upsert({
    where: { storeId_name: { storeId: retailStore.id, name: "Kho Sau Cửa Hàng" } },
    update: {},
    create: { storeId: retailStore.id, name: "Kho Sau Cửa Hàng" },
  });

  const warehouseBinA1 = await prisma.stockLocation.upsert({
    where: { storeId_name: { storeId: warehouseStore.id, name: "Kệ A1 - Tầng 2" } },
    update: {},
    create: { storeId: warehouseStore.id, name: "Kệ A1 - Tầng 2", isDefault: true },
  });

  // 4. Seed Cửa Hàng Đồ Ăn: Danh mục & Món
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
    { name: "Trà Sữa Trân Châu Hoàng Gia", cat: catDrink.id, price: BigInt(39000), discount: 0 },
    { name: "Cà Phê Sữa Đá Sài Gòn", cat: catDrink.id, price: BigInt(29000), discount: 0 },
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

  // Voucher Đồ Ăn
  await prisma.voucher.upsert({
    where: { storeId_code: { storeId: foodStore.id, code: "WELCOME10" } },
    update: {},
    create: {
      storeId: foodStore.id,
      code: "WELCOME10",
      type: VoucherType.PERCENT,
      discountValue: BigInt(10),
      maxDiscount: BigInt(50000),
      minOrderValue: BigInt(100000),
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // 5. Seed Bán Lẻ: Sản phẩm + Biến thể + Tồn kho qua InventoryService
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
    },
  });

  // Nhập tồn kho 100 cái qua InventoryService
  await prisma.$transaction(async (tx) => {
    await InventoryService.recordReceipt(tx, {
      storeId: retailStore.id,
      variantId: varWhiteM.id,
      locationId: retailWarehouse.id,
      quantity: 100,
      unitCost: BigInt(90000),
      note: "Nhập tồn kho ban đầu từ NCC Dệt Kim Thành",
    });
  });

  // 6. Seed Kho Doanh Nghiệp: Vật tư + Tồn kho
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
      quantity: 65,
      unitCost: BigInt(1250000),
      note: "Nhập tồn kho vật tư NVL ban đầu",
    });
  });

  console.log("=== HOÀN TẤT SEED DỮ LIỆU ĐẦY ĐỦ VÀ HỢP LỆ VỚI SỔ CÁI ===");
}

main()
  .catch((e) => {
    console.error("Lỗi seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
