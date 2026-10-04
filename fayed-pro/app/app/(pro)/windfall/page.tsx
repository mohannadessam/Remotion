import { createClient } from '@/lib/supabase/server';
import { loadPlans, loadReserves, loadWindfalls } from '@/lib/data';
import WindfallClient from './windfall-client';

export default async function WindfallPage() {
  const supabase = await createClient();
  const [plans, reserves, windfalls] = await Promise.all([loadPlans(supabase), loadReserves(supabase), loadWindfalls(supabase)]);
  return <WindfallClient plans={plans} reserves={reserves} windfalls={windfalls} />;
}
