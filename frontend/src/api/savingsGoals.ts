import { apiClient } from "./client";
import type {
  SavingsContribution,
  SavingsContributionCreate,
  SavingsGoal,
  SavingsGoalCreate,
  SavingsGoalUpdate,
} from "./types";

export async function listSavingsGoals(): Promise<SavingsGoal[]> {
  const { data } = await apiClient.get<SavingsGoal[]>("/savings-goals");
  return data;
}

export async function getSavingsGoal(id: number): Promise<SavingsGoal> {
  const { data } = await apiClient.get<SavingsGoal>(`/savings-goals/${id}`);
  return data;
}

export async function createSavingsGoal(payload: SavingsGoalCreate): Promise<SavingsGoal> {
  const { data } = await apiClient.post<SavingsGoal>("/savings-goals", payload);
  return data;
}

export async function updateSavingsGoal(id: number, payload: SavingsGoalUpdate): Promise<SavingsGoal> {
  const { data } = await apiClient.patch<SavingsGoal>(`/savings-goals/${id}`, payload);
  return data;
}

export async function deleteSavingsGoal(id: number): Promise<void> {
  await apiClient.delete(`/savings-goals/${id}`);
}

export async function listContributions(goalId: number): Promise<SavingsContribution[]> {
  const { data } = await apiClient.get<SavingsContribution[]>(`/savings-goals/${goalId}/contributions`);
  return data;
}

export async function createContribution(
  goalId: number,
  payload: SavingsContributionCreate,
): Promise<SavingsContribution> {
  const { data } = await apiClient.post<SavingsContribution>(`/savings-goals/${goalId}/contributions`, payload);
  return data;
}

export async function deleteContribution(goalId: number, contributionId: number): Promise<void> {
  await apiClient.delete(`/savings-goals/${goalId}/contributions/${contributionId}`);
}
