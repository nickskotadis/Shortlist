export type UserType = "career_switcher" | "mid_career" | "student" | "executive";
export type DocumentType = "bullets" | "summary" | "cover_letter" | "linkedin_about" | "linkedin_headline";
export type ValidatorVerdict = "PASS" | "REVISE" | "REJECT";
export type ToneType = "professional" | "conversational" | "bold";

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

export interface HealthScoreResult {
  scores: {
    clarity: number;
    impact: number;
    ats_friendliness: number;
    action_verbs: number;
    quantification: number;
  };
  overall: number;
  recommendations: string[];
  word_count: number;
}

export interface InterviewQuestion {
  question: string;
  category: "behavioral" | "technical" | "situational" | "culture";
  why_asked: string;
  framework: string;
}

export interface InterviewPrepResult {
  questions: InterviewQuestion[];
}

export interface AnswerCoachResult {
  score: number;
  feedback: string;
  what_worked: string[];
  what_to_improve: string[];
}

export interface GenerateRequest {
  document_type: DocumentType;
  jd_text?: string;
  jd_analysis?: JdAnalysis;
  job_application_id?: string;
  user_type: UserType;
  user_data: UserData;
  candidate_input: string;
  tone?: ToneType;
}

// ── Mock Interview Simulator ──────────────────────────────────────────────────

export interface MockInterviewMessage {
  role: "interviewer" | "candidate";
  content: string;
}

export interface MockInterviewDebrief {
  overall_score: number;
  summary: string;
  strengths: string[];
  areas_to_improve: string[];
  dimension_scores: {
    structure: number;
    specificity: number;
    confidence: number;
    relevance: number;
  };
  next_steps: string[];
}

// ── Salary Negotiation Coach ──────────────────────────────────────────────────

export interface NegotiationResult {
  strategy: string;
  counter_email: string;
  phone_script: string;
  pushback_responses: Array<{
    objection: string;
    response: string;
  }>;
}

// ── Job Fit Scorer ────────────────────────────────────────────────────────────

export interface FitDimension {
  score: number;
  explanation: string;
  gaps: string[];
}

export interface FitScoreResult {
  overall: number;
  recommendation: "strong_fit" | "moderate_fit" | "stretch" | "mismatch";
  summary: string;
  dimensions: {
    skills_match: FitDimension;
    experience_level: FitDimension;
    must_haves: FitDimension;
    nice_to_haves: FitDimension;
  };
  top_gaps: string[];
  top_strengths: string[];
}

// SSE event shapes sent to the client
export type SseEvent =
  | { type: "jd_analysis"; data: JdAnalysis }
  | { type: "text"; content: string }
  | { type: "retry"; message: string }
  | { type: "done"; output: string; jd_analysis: JdAnalysis; scores: ValidatorResult["scores"]; overall: number; verdict: ValidatorVerdict; retry_count: number; prompt_version?: string; issues?: ValidatorIssue[]; generation_id?: string; keywords?: string[] }
  | { type: "tailoring_suggestions"; suggestions: string[] }
  | { type: "error"; message: string };
