/** Quiz, category, model and metadata endpoints. */

import { request } from "./http";
import type {
  CategoriesResponse,
  DevInfoResponse,
  GenerateQuizFromCategoryInput,
  GenerateQuizFromPdfInput,
  GenerateQuizInput,
  ModelsResponse,
  Quiz,
} from "@/types/api";

/** Only *available* models come back — the server filters on credentials. */
export function getModels(signal?: AbortSignal): Promise<ModelsResponse> {
  return request<ModelsResponse>("/quiz/models", { signal });
}

export function getCategories(signal?: AbortSignal): Promise<CategoriesResponse> {
  return request<CategoriesResponse>("/categories", { signal });
}

export function generateQuiz(
  input: GenerateQuizInput,
  signal?: AbortSignal,
): Promise<Quiz> {
  return request<Quiz>("/quiz/generate", { method: "POST", json: input, signal });
}

/**
 * Same endpoint, `multipart/form-data`. The field name is `file`; the server
 * extracts the text and derives the topic when we do not supply one.
 */
export function generateQuizFromPdf(
  input: GenerateQuizFromPdfInput,
  signal?: AbortSignal,
): Promise<Quiz> {
  const form = new FormData();
  form.append("file", input.file, input.file.name);
  form.append("difficulty", input.difficulty);
  form.append("num_questions", String(input.num_questions));
  form.append("include_images", String(input.include_images));
  if (input.model) form.append("model", input.model);
  if (input.topic) form.append("topic", input.topic);

  return request<Quiz>("/quiz/generate", { method: "POST", form, signal });
}

export function generateQuizFromCategory(
  input: GenerateQuizFromCategoryInput,
  signal?: AbortSignal,
): Promise<Quiz> {
  return request<Quiz>("/quiz/category", { method: "POST", json: input, signal });
}

export function getDevInfo(signal?: AbortSignal): Promise<DevInfoResponse> {
  return request<DevInfoResponse>("/dev-info", { signal });
}
