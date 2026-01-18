export enum ViewState {
  PROFILE = 'PROFILE',
  PROJECTS = 'PROJECTS',
  EDUCATION = 'EDUCATION',
  SKILLS = 'SKILLS',
  TERMINAL = 'TERMINAL',
  SEARCH = 'SEARCH'
}

export interface Project {
  title: string;
  description: string;
  tech: string[];
  type: string;
}

export interface Education {
  degree: string;
  school: string;
  year: string;
  score: string;
  details?: string[];
}

export interface Certificate {
  name: string;
  icon: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}