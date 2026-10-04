import { createClient } from '@/lib/supabase/server';
import { loadPlans, loadReserves, loadWindfalls } from '@/lib/data';
import PlanClient from './plan-client';

export default async function PlanPage() {
  const supabase = await createClient();
  const [plans, reserves, windfalls] = await Promise.all([loadPlans(supabase), loadReserves(supabase), loadWindfalls(supabase)]);
  return <PlanClient plans={plans} reserves={reserves} windfalls={windfalls} />;
}
