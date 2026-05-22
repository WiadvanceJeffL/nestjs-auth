/**
 * 移除使用者書籍擁有權的回應 DTO
 */
export class RemoveUserEntitlementResponseDto {
  success: boolean;
  message: string;
  userId: number;
  bookId: number;
  removedAt: string;
}
