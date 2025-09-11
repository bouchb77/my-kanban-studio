import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from './useTasks';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'task_due' | 'task_overdue' | 'task_completed' | 'task_assigned' | 'project_comment';
  read: boolean;
  task_id?: string;
  project_id?: string;
  created_at: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { tasks } = useTasks();

  // Load read notifications from database
  const loadReadNotifications = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('notification_id, read')
        .eq('user_id', user.id)
        .eq('read', true);
      
      if (error) {
        console.error('Error loading read notifications:', error);
        return;
      }
      
      if (data) {
        const readIds = new Set(data.map(item => item.notification_id));
        setReadNotifications(readIds);
      }
    } catch (error) {
      console.error('Error loading read notifications:', error);
    }
  };

  // Load comment notifications from database
  const loadCommentNotifications = async () => {
    if (!user) return [];
    
    try {
      const { data, error } = await supabase
        .from('user_notifications')
        .select(`
          id,
          notification_id,
          created_at,
          read
        `)
        .eq('user_id', user.id)
        .like('notification_id', 'comment_%')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading comment notifications:', error);
        return [];
      }
      
      if (!data) return [];
      
      // Pour chaque notification de commentaire, récupérer les détails
      const commentNotifications: Notification[] = await Promise.all(
        data.map(async (notif) => {
          const commentId = notif.notification_id.replace('comment_', '');
          
          try {
            const { data: commentData, error: commentError } = await supabase
              .from('project_task_comments')
              .select(`
                id,
                comment,
                created_at,
                user_id,
                project_tasks!project_task_comments_task_id_fkey(
                  title,
                  project_id,
                  projects!project_tasks_project_id_fkey(name)
                )
              `)
              .eq('id', commentId)
              .single();
            
            if (commentError || !commentData) {
              return null;
            }
            
            // Récupérer les informations du profil séparément
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', commentData.user_id)
              .single();
            
            const authorName = profileData?.full_name || 
                             profileData?.email || 
                             'Un utilisateur';
            const taskTitle = commentData.project_tasks?.title || 'Tâche inconnue';
            const projectName = commentData.project_tasks?.projects?.name || 'Projet inconnu';
            
            return {
              id: notif.notification_id,
              title: 'Nouveau commentaire',
              message: `${authorName} a commenté la tâche "${taskTitle}" dans le projet "${projectName}"`,
              type: 'project_comment' as const,
              read: notif.read,
              task_id: commentData.project_tasks ? undefined : undefined,
              project_id: commentData.project_tasks?.project_id,
              created_at: notif.created_at
            };
          } catch (error) {
            console.error('Error loading comment details:', error);
            return null;
          }
        })
      );
      
      return commentNotifications.filter((notif): notif is Notification => notif !== null);
    } catch (error) {
      console.error('Error loading comment notifications:', error);
      return [];
    }
  };

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

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    
    try {
      // Save to database
      await supabase
        .from('user_notifications')
        .upsert({
          user_id: user.id,
          notification_id: notificationId,
          read: true
        }, {
          onConflict: 'user_id,notification_id'
        });
      
      // Update local state
      setReadNotifications(prev => new Set([...prev, notificationId]));
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, read: true }
            : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      // Prepare all notifications to mark as read
      const allIds = notifications.map(n => n.id);
      const upsertData = allIds.map(id => ({
        user_id: user.id,
        notification_id: id,
        read: true
      }));
      
      // Save all to database
      await supabase
        .from('user_notifications')
        .upsert(upsertData, {
          onConflict: 'user_id,notification_id'
        });
      
      // Update local state
      setReadNotifications(prev => new Set([...prev, ...allIds]));
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Load read notifications on mount and when user changes
  useEffect(() => {
    loadReadNotifications();
  }, [user]);

  // Generate notifications when tasks or read notifications change
  useEffect(() => {
    const generateAllNotifications = async () => {
      const taskNotifications = generateNotificationsFromTasks();
      const commentNotifications = await loadCommentNotifications();
      
      const allNotifications = [...taskNotifications, ...commentNotifications];
      
      // Trier par date de création (plus récent en premier)
      allNotifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setNotifications(allNotifications);
      setLoading(false);
    };
    
    if (tasks.length > 0 || user) {
      generateAllNotifications();
    }
  }, [tasks, readNotifications, user]);

  // Surveillance en temps réel des nouveaux commentaires
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('project-comment-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          // Si c'est une notification de commentaire, recharger toutes les notifications
          if (payload.new.notification_id?.startsWith('comment_')) {
            const taskNotifications = generateNotificationsFromTasks();
            const commentNotifications = await loadCommentNotifications();
            
            const allNotifications = [...taskNotifications, ...commentNotifications];
            
            allNotifications.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            
            setNotifications(allNotifications);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refetch: async () => {
      await loadReadNotifications();
      const taskNotifications = generateNotificationsFromTasks();
      const commentNotifications = await loadCommentNotifications();
      
      const allNotifications = [...taskNotifications, ...commentNotifications];
      
      allNotifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setNotifications(allNotifications);
    }
  };
};