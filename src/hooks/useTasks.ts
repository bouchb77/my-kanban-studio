import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  user_id: string;
  sipi_number?: string;
  company_name?: string;
}

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const loadTasks = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading tasks:', error);
        return;
      }
      
      setTasks(data as Task[] || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [user]);

  // Set up real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getTaskStats = () => {
    const completed = tasks.filter(task => task.status === 'done').length;
    const inProgress = tasks.filter(task => task.status === 'in-progress').length;
    const inReview = tasks.filter(task => task.status === 'review').length;
    const todo = tasks.filter(task => task.status === 'todo').length;
    
    const now = new Date();
    const overdue = tasks.filter(task => {
      if (!task.due_date) return false;
      
      const dueDate = new Date(task.due_date);
      if (isNaN(dueDate.getTime())) return false;
      
      return dueDate < now && task.status !== 'done';
    }).length;

    return {
      total: tasks.length,
      completed,
      inProgress,
      inReview,
      todo,
      overdue,
      completionRate: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0
    };
  };

  const getRecentTasks = (limit: number = 4) => {
    return tasks
      .filter(task => {
        // S'assurer que updated_at est valide
        if (!task.updated_at) return false;
        const updatedDate = new Date(task.updated_at);
        return !isNaN(updatedDate.getTime());
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, limit);
  };

  const getOverdueTasks = (limit: number = 5) => {
    const now = new Date();
    return tasks
      .filter(task => {
        // Vérifier que due_date existe et est valide
        if (!task.due_date) return false;
        
        const dueDate = new Date(task.due_date);
        // Vérifier que la date est valide
        if (isNaN(dueDate.getTime())) return false;
        
        return dueDate < now && task.status !== 'done';
      })
      .sort((a, b) => {
        const dateA = new Date(a.due_date);
        const dateB = new Date(b.due_date);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, limit);
  };

  return { 
    tasks, 
    loading, 
    refetch: loadTasks,
    getTaskStats,
    getRecentTasks,
    getOverdueTasks
  };
};