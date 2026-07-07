"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { reviseNutritionPlan } from "@/lib/ai/nutritionPlan";
import { getProfile } from "@/lib/session";

export async function updatePlan(formData: FormData) {
  const id = String(formData.get("id"));
  const profile = await getProfile();
  if (!profile) return;

  await db.nutritionPlan.updateMany({
    where: { id, profileId: profile.id },
    data: {
      calories: Number(formData.get("calories")),
      proteinG: Number(formData.get("proteinG")),
      carbsG: Number(formData.get("carbsG")),
      fatG: Number(formData.get("fatG")),
      sugarG: Number(formData.get("sugarG")),
      fiberG: Number(formData.get("fiberG")),
    },
  });

  revalidatePath("/plan/review");
}

export async function revisePlan(formData: FormData) {
  const id = String(formData.get("id"));
  const feedback = String(formData.get("feedback") ?? "").trim();
  if (!feedback) return;

  const profile = await getProfile();
  if (!profile) return;

  const current = await db.nutritionPlan.findFirst({ where: { id, profileId: profile.id } });
  if (!current) return;

  const revised = await reviseNutritionPlan(current, feedback);

  await db.nutritionPlan.update({
    where: { id },
    data: {
      calories: revised.calories,
      proteinG: revised.proteinG,
      carbsG: revised.carbsG,
      fatG: revised.fatG,
      sugarG: revised.sugarG,
      fiberG: revised.fiberG,
      researchNotes: revised.researchNotes,
      version: { increment: 1 },
    },
  });

  revalidatePath("/plan/review");
}

export async function acceptPlan(formData: FormData) {
  const id = String(formData.get("id"));
  const profile = await getProfile();
  if (!profile) return;

  const result = await db.nutritionPlan.updateMany({
    where: { id, profileId: profile.id },
    data: { status: "ACCEPTED" },
  });
  if (result.count === 0) return;

  redirect("/meal-plan");
}
