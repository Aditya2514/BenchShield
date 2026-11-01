import createClient from 'openapi-fetch';
import type { paths, components } from './schema.js';

export type { paths, components };
export type Schema<T extends keyof components['schemas']> = components['schemas'][T];

export type BenchmarkImportRequest = Schema<'BenchmarkImportRequest'>;
export type BenchmarkImportResponse = Schema<'BenchmarkImportResponse'>;
export type RowError = Schema<'RowError'>;
export type PolicyCreateRequest = Schema<'PolicyCreateRequest'>;
export type PolicyResponse = Schema<'PolicyResponse'>;
export type BudgetCeilings = Schema<'BudgetCeilings'>;
export type InvestigationLaunchRequest = Schema<'InvestigationLaunchRequest'>;
export type InvestigationResponse = Schema<'InvestigationResponse'>;
export type FindingItem = Schema<'FindingItem'>;
export type EvidenceSnapshot = Schema<'EvidenceSnapshot'>;
export type FindingsListResponse = Schema<'FindingsListResponse'>;
export type ReviewDecisionRequest = Schema<'ReviewDecisionRequest'>;
export type ExperimentItem = Schema<'ExperimentItem'>;
export type ExperimentListResponse = Schema<'ExperimentListResponse'>;
export type ExperimentCreateRequest = Schema<'ExperimentCreateRequest'>;
export type ReportResponse = Schema<'ReportResponse'>;
export type ErrorResponse = Schema<'ErrorResponse'>;

export function createApiClient(baseUrl: string = '/api/v1', options?: RequestInit) {
  return createClient<paths>({
    baseUrl,
    ...options,
  });
}

