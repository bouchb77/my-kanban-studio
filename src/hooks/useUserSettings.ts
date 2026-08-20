import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserColumn {
  id: string;
  title: string;
  status: string;
  color: string;
  order: number;
}

export interface UserCustomField {
  id: string;
  name: string;
  type: string;
  required: boolean;
  options: any;
  order: number;
}

export interface UserPreferences {
  notifications: {
    push: boolean;
    email: boolean;
    dailyDigest: boolean;
    daysBeforeDue: number;
  };
}

export const useUserColumns = () => {
  const [columns, setColumns] = useState<UserColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const loadColumns = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_columns')
        .select('*')
        .order('order', { ascending: true });
      
      if (error) {
        console.error('Error loading columns:', error);
        return;
      }
      
      if (data) {
        setColumns(data);
      }
    } catch (error) {
      console.error('Error loading columns:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadColumns();
  }, [user]);

  // Set up real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-columns-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_columns'
        },
        () => {
          loadColumns();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { columns, loading, refetch: loadColumns };
};

export const useUserCustomFields = () => {
  const [customFields, setCustomFields] = useState<UserCustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const loadCustomFields = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_custom_fields')
        .select('*')
        .order('order', { ascending: true });
      
      if (error) {
        console.error('Error loading custom fields:', error);
        return;
      }
      
      if (data) {
        setCustomFields(data);
      }
    } catch (error) {
      console.error('Error loading custom fields:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomFields();
  }, [user]);

  // Set up real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-custom-fields-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_custom_fields'
        },
        () => {
          loadCustomFields();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { customFields, loading, refetch: loadCustomFields };
};

export const useUserPreferences = () => {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const loadPreferences = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading preferences:', error);
        return;
      }
      
      if (data) {
        setPreferences({
          notifications: data.notifications as any
        });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreferences();
  }, [user]);

  return { preferences, loading, refetch: loadPreferences };
};