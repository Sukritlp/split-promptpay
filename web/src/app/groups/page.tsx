import type { Metadata } from 'next';
import { RequireAuth } from '@/components/auth/require-auth';
import { GroupsHome } from '@/components/groups/groups-home';

export const metadata: Metadata = { title: 'กลุ่มของฉัน · split-promptpay' };

export default function GroupsPage() {
  return (
    <RequireAuth>
      <GroupsHome />
    </RequireAuth>
  );
}
