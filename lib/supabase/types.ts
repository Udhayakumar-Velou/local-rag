export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  color?: string;
  custom_prompt?: string;
  created_at: string;
  updated_at: string;
}

export interface CloudConversation {
  id: string;
  user_id: string;
  project_id?: string | null;
  title: string;
  messages: any[];
  updated_at: number;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
}
