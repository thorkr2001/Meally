import { redirect } from "next/navigation";
import { getProfile, getRouteStatus } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const plans = await getRouteStatus(profile.id);
  const activePlan = plans.find((p) => p.status === "ACCEPTED");
  if (!activePlan) {
    const hasDraft = plans.some((p) => p.status === "DRAFT");
    redirect(hasDraft ? "/plan/review" : "/onboarding");
  }

  if (activePlan.mealPlans.length === 0) redirect("/meal-plan");

  redirect("/today");
}
