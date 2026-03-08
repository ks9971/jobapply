export interface PortalAdapter {
  name: string;
  login(username: string, password: string): Promise<boolean>;
  searchJobs(query: string, location: string): Promise<JobListing[]>;
  applyToJob(jobId: string, cvPath: string): Promise<ApplicationResult>;
  logout(): Promise<void>;
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  description: string;
  url: string;
  postedAt?: string;
  portal: string;
}

export interface ApplicationResult {
  success: boolean;
  applicationId?: string;
  message: string;
}
