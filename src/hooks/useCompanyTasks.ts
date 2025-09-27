import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Task } from './useTasks';

export const useCompanyTasks = (sipiNumber: string | null) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const loadCompanyTasks = async () => {
    if (!user || !sipiNumber) {
      setTasks([]);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('sipi_number', sipiNumber)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading company tasks:', error);
        return;
      }
      
      setTasks(data as Task[] || []);
    } catch (error) {
      console.error('Error loading company tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanyTasks();
  }, [user, sipiNumber]);

  return { 
    tasks, 
    loading,
    refetch: loadCompanyTasks
  };
};