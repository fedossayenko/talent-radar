export interface QualityAssessmentResult {
  overallScore: number;
  completeness: number;
  clarity: number;
  specificity: number;
  relevance: number;
  professionalism: number;
  issues: string[];
  recommendations: string[];
}

export interface IAiAssessmentService {
  assessContentQuality(content: string): Promise<QualityAssessmentResult>;
  validateExtractionResult(result: any): Promise<{
    isValid: boolean;
    confidence: number;
    issues: string[];
  }>;
}