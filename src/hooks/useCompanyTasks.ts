import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Task } from '@/types/task';
import { encryptedTasksService } from '@/services/encryptedTasksService';

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
      const allTasks = await encryptedTasksService.getAllTasks();
      const mappedTasks = allTasks.map(task => encryptedTasksService.mapDbTask(task));
      const filteredTasks = mappedTasks.filter(task => task.sipiNumber === sipiNumber);
      setTasks(filteredTasks);
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