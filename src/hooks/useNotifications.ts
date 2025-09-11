import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from './useTasks';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'task_due' | 'task_overdue' | 'task_completed' | 'task_assigned';
  read: boolean;
  task_id?: string;
  created_at: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { tasks } = useTasks();

  const generateNotificationsFromTasks = () => {
    const generatedNotifications: Notification[] = [];
    const now = new Date();

    tasks.forEach(task => {
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        const timeDiff = dueDate.getTime() - now.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        // Tâche en retard
        if (daysDiff < 0) {
          generatedNotifications.push({
            id: `overdue-${task.id}`,
            title: 'Tâche en retard',
            message: `La tâche "${task.title}" était due il y a ${Math.abs(daysDiff)} jour(s)`,
            type: 'task_overdue',
            read: readNotifications.has(`overdue-${task.id}`),
            task_id: task.id,
            created_at: task.due_date
          });
        }
        // Tâche due dans les 3 prochains jours
        else if (daysDiff <= 3 && daysDiff >= 0) {
          generatedNotifications.push({
            id: `due-${task.id}`,
            title: 'Échéance approche',
            message: `La tâche "${task.title}" est due ${daysDiff === 0 ? "aujourd'hui" : `dans ${daysDiff} jour(s)`}`,
            type: 'task_due',
            read: readNotifications.has(`due-${task.id}`),
            task_id: task.id,
            created_at: task.due_date
          });
        }
      }

      // Tâche terminée récemment
      if (task.status === 'done' && task.updated_at) {
        const updatedDate = new Date(task.updated_at);
        const timeDiff = now.getTime() - updatedDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        if (daysDiff <= 1) {
          generatedNotifications.push({
            id: `completed-${task.id}`,
            title: 'Tâche terminée',
            message: `La tâche "${task.title}" a été marquée comme terminée`,
            type: 'task_completed',
            read: readNotifications.has(`completed-${task.id}`),
            task_id: task.id,
            created_at: task.updated_at
          });
        }
      }
    });

    // Trier par date de création (plus récent en premier)
    generatedNotifications.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return generatedNotifications;
  };

  const markAsRead = (notificationId: string) => {
    setReadNotifications(prev => new Set([...prev, notificationId]));
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, read: true }
          : notif
      )
    );
  };

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadNotifications(prev => new Set([...prev, ...allIds]));
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (tasks.length > 0) {
      const generatedNotifications = generateNotificationsFromTasks();
      setNotifications(generatedNotifications);
      setLoading(false);
    }
  }, [tasks, readNotifications]);

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refetch: () => {}
  };
};