import { faker } from '@faker-js/faker';

export class MockDataFactory {
  static createCompanyData(overrides: Partial<any> = {}) {
    return {
      name: faker.company.name(),
      website: faker.internet.url(),
      description: faker.company.catchPhrase(),
      industry: faker.helpers.arrayElement(['Technology', 'Finance', 'Healthcare', 'Education', 'Manufacturing']),
      size: faker.helpers.arrayElement(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']),
      location: `${faker.location.city()}, ${faker.location.state()}`,
      logo: faker.image.url(),
      founded: faker.date.past({ years: 30 }).getFullYear(),
      ...overrides,
    };
  }

  static createVacancyData(companyId?: string, overrides: Partial<any> = {}) {
    const title = faker.helpers.arrayElement([
      'Senior Software Engineer',
      'Frontend Developer',
      'Backend Engineer',
      'Full Stack Developer',
      'DevOps Engineer',
      'Data Scientist',
      'Product Manager',
      'UX Designer',
    ]);

    return {
      title,
      description: faker.lorem.paragraphs(3),
      requirements: JSON.stringify(faker.helpers.arrayElements([
        'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java',
        'AWS', 'Docker', 'Kubernetes', 'PostgreSQL', 'MongoDB', 'Git',
      ], { min: 3, max: 6 })),
      location: faker.helpers.arrayElement(['Remote', 'San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX']),
      salaryMin: faker.number.int({ min: 60000, max: 120000 }),
      salaryMax: faker.number.int({ min: 120000, max: 200000 }),
      experienceLevel: faker.helpers.arrayElement(['junior', 'mid', 'senior', 'lead', 'principal']),
      employmentType: faker.helpers.arrayElement(['full-time', 'part-time', 'contract', 'internship']),
      companyId: companyId || undefined,
      sourceUrl: faker.internet.url(),
      sourceSite: faker.internet.domainName(),
      status: faker.helpers.arrayElement(['active', 'inactive', 'filled']),
      postedAt: faker.date.recent({ days: 30 }),
      ...overrides,
    };
  }

  static createCompanyAnalysisData(companyId: string, overrides: Partial<any> = {}) {
    return {
      companyId,
      cultureScore: faker.number.float({ min: 1, max: 10, fractionDigits: 1 }),
      retentionRate: faker.number.float({ min: 70, max: 95, fractionDigits: 1 }),
      hiringProcess: JSON.stringify(faker.helpers.arrayElements([
        'Application Review',
        'Phone Screening',
        'Technical Interview',
        'System Design Interview',
        'Cultural Fit Interview',
        'Final Interview',
        'Reference Check',
        'Offer',
      ], { min: 3, max: 6 })),
      techStack: JSON.stringify(faker.helpers.arrayElements([
        'React', 'Node.js', 'Python', 'Java', 'Go', 'Rust',
        'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch',
        'AWS', 'Docker', 'Kubernetes', 'Terraform',
      ], { min: 4, max: 8 })),
      workLifeBalance: faker.number.float({ min: 1, max: 10, fractionDigits: 1 }),
      careerGrowth: faker.number.float({ min: 1, max: 10, fractionDigits: 1 }),
      salaryCompetitiveness: faker.number.float({ min: 1, max: 10, fractionDigits: 1 }),
      benefitsScore: faker.number.float({ min: 1, max: 10, fractionDigits: 1 }),
      analysisSource: 'ai_generated',
      confidenceScore: faker.number.float({ min: 0.5, max: 1, fractionDigits: 2 }),
      rawData: JSON.stringify({}),
      ...overrides,
    };
  }

  static createCvData(overrides: Partial<any> = {}) {
    return {
      filename: faker.system.fileName({ extensionCount: 1 }) + '.pdf',
      originalName: faker.person.fullName() + '_CV.pdf',
      mimeType: 'application/pdf',
      size: faker.number.int({ min: 100000, max: 2000000 }),
      path: `/uploads/cv/${faker.string.uuid()}.pdf`,
      extractedText: faker.lorem.paragraphs(10),
      skills: JSON.stringify(faker.helpers.arrayElements([
        'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java',
        'AWS', 'Docker', 'Kubernetes', 'PostgreSQL', 'MongoDB', 'Git',
      ], { min: 5, max: 10 })),
      experience: faker.number.int({ min: 1, max: 15 }),
      education: JSON.stringify(faker.helpers.arrayElements([
        'Bachelor of Computer Science',
        'Master of Software Engineering',
        'Bachelor of Information Technology',
        'Master of Computer Science',
      ], { min: 1, max: 2 })),
      ...overrides,
    };
  }

  static createApplicationData(vacancyId: string, cvId?: string, overrides: Partial<any> = {}) {
    return {
      vacancyId,
      cvId,
      status: faker.helpers.arrayElement(['draft', 'applied', 'interview', 'rejected', 'offered', 'accepted']),
      appliedAt: faker.date.recent({ days: 7 }),
      coverLetter: faker.lorem.paragraphs(3),
      notes: faker.lorem.paragraph(),
      ...overrides,
    };
  }

  static createVacancyScoreData(vacancyId: string, overrides: Partial<any> = {}) {
    return {
      vacancyId,
      overallScore: faker.number.float({ min: 1, max: 10, fractionDigits: 1 }),
      salaryScore: faker.number.float({ min: 1, max: 10, fractionDigits: 1 }),
      locationScore: faker.number.float({ min: 1, max: 10, fractionDigits: 1 }),
      companyScore: faker.number.float({ min: 1, max: 10, fractionDigits: 1 }),
      roleScore: faker.number.float({ min: 1, max: 10, fractionDigits: 1 }),
      techStackScore: faker.number.float({ min: 1, max: 10, fractionDigits: 1 }),
      workLifeBalanceScore: faker.number.float({ min: 1, max: 10, fractionDigits: 1 }),
      careerGrowthScore: faker.number.float({ min: 1, max: 10, fractionDigits: 1 }),
      scoringCriteria: JSON.stringify({
        salaryRange: `${faker.number.int({ min: 80000, max: 120000 })}-${faker.number.int({ min: 120000, max: 180000 })}`,
        preferredLocation: faker.helpers.arrayElement(['Remote', 'San Francisco', 'New York']),
        requiredSkills: faker.helpers.arrayElements(['React', 'Node.js', 'TypeScript'], { min: 2, max: 3 }),
        experienceLevel: faker.helpers.arrayElement(['mid', 'senior']),
      }),
      scoredAt: new Date(),
      ...overrides,
    };
  }
}