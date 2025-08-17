export interface VacancyExtractionResult {
  title: string | null;
  company: string | null;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  experienceLevel: string | null;
  employmentType: string | null;
  workModel: string | null;
  description: string | null;
  requirements: string[] | null;
  responsibilities: string[] | null;
  technologies: string[] | null;
  benefits: string[] | null;
  educationLevel: string | null;
  industry: string | null;
  teamSize: string | null;
  companySize: string | null;
  applicationDeadline: string | null;
  postedDate: string | null;
  confidenceScore: number;
  qualityScore: number;
  extractionMetadata: {
    sourceType: string;
    contentLength: number;
    hasStructuredData: boolean;
    language: string;
  };
}

export interface IAiExtractionService {
  extractVacancyData(
    content: string,
    sourceUrl: string,
    options?: { skipCache?: boolean }
  ): Promise<VacancyExtractionResult | null>;
}