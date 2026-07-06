import type { FieldSurveyItemType } from './field-survey-item-types';

export type { FieldSurveyItemType };

export interface FieldSurveyDimensionModule {
  label: string;
  genislikCm: number | null;
  yukseklikCm: number | null;
  derinlikCm: number | null;
}

export interface FieldSurveyMaterial {
  name: string;
  quantity: string | null;
  note: string | null;
}

export interface ParsedFieldSurveyFields {
  itemType: FieldSurveyItemType;
  title: string;
  summaryText: string;
  dimensions: FieldSurveyDimensionModule[];
  materials: FieldSurveyMaterial[];
  aiConfidence: number | null;
}

export interface FieldSurveyScanResult extends ParsedFieldSurveyFields {
  configured: boolean;
  photoUrl: string | null;
  message?: string;
}
