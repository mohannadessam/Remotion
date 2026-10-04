import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadPlans, loadReserves, loadWindfalls } from '@/lib/data';
import { RESERVES_ENABLED } from '@/lib/features';
import ReservesClient from './reserves-client';

export default async function ReservesPage() {
  if (!RESERVES_ENABLED) redirect('/app/plan'); // الميزة موقوفة حاليًا
  const supabase = await createClient();
  const [reserves, plans, windfalls] = await Promise.all([loadReserves(supabase), loadPlans(supabase), loadWindfalls(supabase)]);
  return <ReservesClient initial={reserves} plans={plans} windfalls={windfalls} />;
}
