import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/task';

class EncryptedTasksService {
  private async callEncryptedFunction(method: string, body?: any) {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.functions.invoke('encrypted-tasks', {
      body: {
        method,
        body
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      throw new Error(`Function error: ${error.message}`);
    }

    if (data?.error) {
      throw new Error(`Service error: ${data.error}`);
    }

    return data;
  }

  async getAllTasks(): Promise<Task[]> {
    const response = await this.callEncryptedFunction('SELECT');
    return response.data || [];
  }

  async createTask(taskData: Partial<Task>): Promise<Task> {
    const response = await this.callEncryptedFunction('INSERT', { taskData });
    return response.data;
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    const response = await this.callEncryptedFunction('UPDATE', { taskId, updates });
    return response.data;
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.callEncryptedFunction('DELETE', { taskId });
  }

  // Map database task to frontend Task type
  mapDbTask(row: any): Task {
    return {
      id: String(row.id),
      title: row.title,
      description: row.description || undefined,
      status: (row.status as Task["status"]) ?? "todo",
      priority: (["low", "medium", "high"].includes(row.priority)
        ? row.priority
        : "medium") as Task["priority"],
      tags: row.tags ?? [],
      assignee: row.assignee || undefined,
      dueDate: row.due_date ? new Date(row.due_date) : undefined,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
      customFields: row.custom_fields || {},
      sipiNumber: row.sipi_number || undefined,
      companyName: row.company_name || undefined,
      category: row.category || 'general',
    };
  }

  // Convert frontend Task to database format
  taskToDbFormat(task: Partial<Task>): any {
    return {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      tags: task.tags,
      assignee: task.assignee,
      due_date: task.dueDate?.toISOString(),
      custom_fields: task.customFields,
      sipi_number: task.sipiNumber,
      company_name: task.companyName,
      category: task.category,
    };
  }
}

export const encryptedTasksService = new EncryptedTasksService();