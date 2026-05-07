export const USER_ROLES = ["guest", "user", "agent", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type SavedNumber = {
  id: string;
  userId: string;
  label: string;
  phone: string;
  createdAt: string;
};

export type UserProfile = {
  id: string;
  email?: string;
  phone?: string;
  displayName?: string;
  role: UserRole;
  isSuspended: boolean;
  walletBalanceGhs: number;
  createdAt: string;
};
