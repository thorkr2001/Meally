import { redirect } from "next/navigation";
import { getActiveNutritionPlan, getDraftNutritionPlan, getActiveMealPlan, getProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const activePlan = await getActiveNutritionPlan(profile.id);
  if (!activePlan) {
    const draftPlan = await getDraftNutritionPlan(profile.id);
    redirect(draftPlan ? "/plan/review" : "/onboarding");
  }

  const activeMealPlan = await getActiveMealPlan(activePlan.id);
  if (!activeMealPlan) redirect("/meal-plan");

  redirect("/today");
}
