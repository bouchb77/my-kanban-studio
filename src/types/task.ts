export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  dueDate?: Date;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  customFields?: Record<string, any>;
}

export interface Column {
  id: string;
  title: string;
  status: Task['status'];
  order: number;
  color?: string;
}

export interface UserSettings {
  id: string;
  userId: string;
  columns: Column[];
  customFields: CustomField[];
  notifications: NotificationSettings;
}

export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'date' | 'checkbox';
  options?: string[];
  required?: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  daysBeforeDue: number;
  email: boolean;
  push: boolean;
}