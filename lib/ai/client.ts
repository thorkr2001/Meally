import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic();

// Research (web search) and nutrition plan generation — favor quality/reasoning.
export const MODEL = "claude-opus-4-8";

// Weekly meal plan generation/regeneration — high token volume, cheaper model.
export const MEAL_PLAN_MODEL = "claude-sonnet-5";
