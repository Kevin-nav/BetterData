import type { Order, UserProfile, WalletTransaction } from "@betterdata/contracts";

export type OrderRepository = {
  create(order: Omit<Order, "id" | "createdAt" | "updatedAt">): Promise<Order>;
  findByReference(reference: string): Promise<Order | null>;
  updateStatus(reference: string, status: Order["status"]): Promise<Order>;
};

export type UserRepository = {
  findById(id: string): Promise<UserProfile | null>;
  findByEmail(email: string): Promise<UserProfile | null>;
  updateWalletBalance(userId: string, amountGhs: number): Promise<UserProfile>;
};

export type WalletRepository = {
  createTransaction(transaction: Omit<WalletTransaction, "id" | "createdAt">): Promise<WalletTransaction>;
  listByUser(userId: string): Promise<WalletTransaction[]>;
};
