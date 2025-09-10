import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserViewPreferences {
  id: string;
  user_id: string;
  view_type: 'table' | 'kanban';
  visible_columns: string[];
  column_order: string[];
  column_widths: Record<string, number>;
}

export const useUserViewPreferences = (viewType: 'table' | 'kanban' = 'table') => {
  const [preferences, setPreferences] = useState<UserViewPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const loadPreferences = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_view_preferences')
        .select('*')
        .eq('view_type', viewType)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading view preferences:', error);
        return;
      }
      
      if (data) {
        setPreferences({
          id: data.id,
          user_id: data.user_id,
          view_type: data.view_type as 'table' | 'kanban',
          visible_columns: Array.isArray(data.visible_columns) ? (data.visible_columns as string[]) : [],
          column_order: Array.isArray(data.column_order) ? (data.column_order as string[]) : [],
          column_widths: (typeof data.column_widths === 'object' && data.column_widths && !Array.isArray(data.column_widths)) ? (data.column_widths as Record<string, number>) : {},
        });
      }
    } catch (error) {
      console.error('Error loading view preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (updates: Partial<Pick<UserViewPreferences, 'visible_columns' | 'column_order' | 'column_widths'>>) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_view_preferences')
        .upsert({
          user_id: user.id,
          view_type: viewType,
          ...updates,
        }, {
          onConflict: 'user_id,view_type'
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error saving view preferences:', error);
        throw error;
      }
      
      if (data) {
        setPreferences({
          id: data.id,
          user_id: data.user_id,
          view_type: data.view_type as 'table' | 'kanban',
          visible_columns: Array.isArray(data.visible_columns) ? (data.visible_columns as string[]) : [],
          column_order: Array.isArray(data.column_order) ? (data.column_order as string[]) : [],
          column_widths: (typeof data.column_widths === 'object' && data.column_widths && !Array.isArray(data.column_widths)) ? (data.column_widths as Record<string, number>) : {},
        });
      }
    } catch (error) {
      console.error('Error saving view preferences:', error);
      throw error;
    }
  };

  const toggleColumnVisibility = async (columnId: string) => {
    if (!preferences) return;
    
    const currentVisible = preferences.visible_columns || [];
    const newVisible = currentVisible.includes(columnId)
      ? currentVisible.filter(id => id !== columnId)
      : [...currentVisible, columnId];
    
    await savePreferences({ visible_columns: newVisible });
  };

  const reorderColumns = async (newOrder: string[]) => {
    await savePreferences({ column_order: newOrder });
  };

  const setColumnWidth = async (columnId: string, width: number) => {
    if (!preferences) return;
    
    const newWidths = {
      ...preferences.column_widths,
      [columnId]: width,
    };
    
    await savePreferences({ column_widths: newWidths });
  };

  useEffect(() => {
    loadPreferences();
  }, [user, viewType]);

  // Set up real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-view-preferences-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_view_preferences',
          filter: `user_id=eq.${user.id} AND view_type=eq.${viewType}`,
        },
        () => {
          loadPreferences();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, viewType]);

  return { 
    preferences, 
    loading, 
    savePreferences,
    toggleColumnVisibility,
    reorderColumns,
    setColumnWidth,
    refetch: loadPreferences 
  };
};