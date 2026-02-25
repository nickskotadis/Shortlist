export type UserType = "career_switcher" | "mid_career" | "student" | "executive";
export type DocumentType = "bullets" | "summary" | "cover_letter";
export type ValidatorVerdict = "PASS" | "REVISE" | "REJECT";

export interface JdAnalysis {
  role_title: string;
  seniority_level: string;
  department: string;
  industry: string;
  company_type: string;
  explicit_requirements: string[];
  implicit_signals: {
    what_they_actually_need: string;
    seniority_indicators: string[];
    culture_signals: string[];
    red_flags: string[];
  };
  must_haves: string[];
  nice_to_haves: string[];
  key_terminology: string[];
  tone_target: string;
  hiring_manager_worry: string;
}

export interface UserData {
  years_experience?: string;
  candidate_name?: string;
  additional_notes?: string;
  // career_switcher
  from_role?: string;
  from_industry?: string;
  to_role?: string;
  to_industry?: string;
  // mid_career
  current_level?: string;
  target_level?: string;
  current_job_title?: string;
  target_job_title?: string;
  industry?: string;
  // student
  degree?: string;
  school?: string;
  grad_year?: string;
  gpa?: string;
  target_role?: string;
  target_industry?: string;
  // executive
  most_recent_role?: string;
  most_recent_company_type?: string;
}

export interface ValidatorIssue {
  type: string;
  location: string;
  fix: string;
}

export interface ValidatorResult {
  scores: {
    specificity: number;
    relevance: number;
    authenticity: number;
    impact: number;
    clean: number;
  };
  overall: number;
  issues: ValidatorIssue[];
  verdict: ValidatorVerdict;
  verdict_reason: string;
}

export interface GenerateRequest {
  document_type: DocumentType;
  jd_text?: string;
  jd_analysis?: JdAnalysis;
  job_application_id?: string;
  user_type: UserType;
  user_data: UserData;
  candidate_input: string;
}

// SSE event shapes sent to the client
export type SseEvent =
  | { type: "jd_analysis"; data: JdAnalysis }
  | { type: "text"; content: string }
  | { type: "retry"; message: string }
  | { type: "done"; output: string; jd_analysis: JdAnalysis; scores: ValidatorResult["scores"]; overall: number; verdict: ValidatorVerdict; retry_count: number; prompt_version?: string }
  | { type: "error"; message: string };
