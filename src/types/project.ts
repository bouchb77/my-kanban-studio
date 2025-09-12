export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  start_date?: string;
  end_date?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  color: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCollaborator {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: string;
  profiles?: {
    full_name?: string;
    email?: string;
  };
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  progress: number;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  created_by: string;
  dependencies: string[];
  category_id?: string;
  created_at: string;
  updated_at: string;
  assignments?: ProjectTaskAssignment[];
  comments?: ProjectTaskComment[];
  category?: {
    id: string;
    name: string;
    color: string;
    order_index: number;
  };
}

export interface ProjectTaskAssignment {
  id: string;
  task_id: string;
  user_id: string;
  assigned_at: string;
  profiles?: {
    full_name?: string;
    email?: string;
  };
  status?: ProjectTaskAssignmentStatus;
}

export interface ProjectTaskAssignmentStatus {
  id: string;
  assignment_id: string;
  user_id: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectTaskComment {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name?: string;
    email?: string;
  };
}