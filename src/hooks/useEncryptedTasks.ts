import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Task } from '@/types/task';
import { encryptedTasksService } from '@/services/encryptedTasksService';
import { useToast } from '@/hooks/use-toast';

export const useEncryptedTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadTasks = async () => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const rawTasks = await encryptedTasksService.getAllTasks();
      const mappedTasks = rawTasks.map(task => encryptedTasksService.mapDbTask(task));
      setTasks(mappedTasks);
    } catch (error) {
      console.error('Error loading encrypted tasks:', error);
      toast({ 
        title: "Erreur", 
        description: "Impossible de charger les tâches", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (taskData: Partial<Task>): Promise<Task | null> => {
    if (!user) return null;
    
    try {
      const dbTaskData = encryptedTasksService.taskToDbFormat({
        ...taskData,
        // Ensure required fields have defaults
        status: taskData.status || 'todo',
        priority: taskData.priority || 'medium',
        tags: taskData.tags || [],
        customFields: taskData.customFields || {},
        category: taskData.category || 'general',
      });

      const rawTask = await encryptedTasksService.createTask(dbTaskData);
      const newTask = encryptedTasksService.mapDbTask(rawTask);
      
      setTasks(prev => [newTask, ...prev]);
      
      toast({ 
        title: "Tâche créée", 
        description: "La tâche a été créée avec succès" 
      });
      
      return newTask;
    } catch (error) {
      console.error('Error creating task:', error);
      toast({ 
        title: "Erreur", 
        description: "Impossible de créer la tâche", 
        variant: "destructive" 
      });
      return null;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>): Promise<Task | null> => {
    if (!user) return null;
    
    try {
      const dbUpdates = encryptedTasksService.taskToDbFormat(updates);
      const rawTask = await encryptedTasksService.updateTask(taskId, dbUpdates);
      const updatedTask = encryptedTasksService.mapDbTask(rawTask);
      
      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ));
      
      return updatedTask;
    } catch (error) {
      console.error('Error updating task:', error);
      toast({ 
        title: "Erreur", 
        description: "Impossible de mettre à jour la tâche", 
        variant: "destructive" 
      });
      return null;
    }
  };

  const deleteTask = async (taskId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      await encryptedTasksService.deleteTask(taskId);
      
      setTasks(prev => prev.filter(task => task.id !== taskId));
      
      toast({ 
        title: "Tâche supprimée", 
        description: "La tâche a été supprimée avec succès" 
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({ 
        title: "Erreur", 
        description: "Impossible de supprimer la tâche", 
        variant: "destructive" 
      });
      return false;
    }
  };

  const updateTaskField = async (taskId: string, field: string, value: any): Promise<boolean> => {
    const updates: any = {};
    
    // Handle different field types
    if (field === 'dueDate') {
      updates.dueDate = value ? new Date(value) : undefined;
    } else if (field === 'tags') {
      updates.tags = Array.isArray(value) ? value : [];
    } else {
      updates[field] = value;
    }
    
    const result = await updateTask(taskId, updates);
    return result !== null;
  };

  useEffect(() => {
    loadTasks();
  }, [user]);

  return {
    tasks,
    loading,
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    updateTaskField,
  };
};