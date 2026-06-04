export class AdminIapReceiptItemDto {
  id: number; // iap_receipts.id
  receiptId: string; // transaction_id
  userId: number;
  username: string;
  email: string;
  platform: 'GOOGLE' | 'APPLE';
  productId: string;
  productName: string;
  price: string; // Decimal as string
  currency: string;
  baseCoins: number;
  bonusCoins: number;
  totalCoins: number;
  status: string;
  createdAt: Date;
}

export class AdminIapReceiptsResponseDto {
  items: AdminIapReceiptItemDto[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
