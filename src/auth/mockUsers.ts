// 模擬帳號表 — 之後串 Supabase 時移除此檔
export type UserRole = 'admin' | 'crew';

export interface MockUser {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  displayName: string;
}

export const MOCK_USERS: MockUser[] = [
  {
    id: 'user-admin-001',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin',
    displayName: '大林 (管理員)',
  },
  {
    id: 'user-crew-001',
    email: 'crew@example.com',
    password: 'crew123',
    role: 'crew',
    displayName: '小林水手 (船員)',
  },
];
