import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Unlock } from 'lucide-react';

export const DecryptSipiButton = () => {
  const [loading, setLoading] = useState(false);

  const handleDecrypt = async () => {
    if (!confirm('Voulez-vous décrypter tous les numéros SIPI dans la base de données ? Cette opération est nécessaire pour que les statistiques fonctionnent correctement.')) {
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast.error('Vous devez être connecté');
        return;
      }

      const response = await fetch(
        `https://grfnbxbxcbqiddbcrdru.supabase.co/functions/v1/decrypt-sipi-numbers`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors du décryptage');
      }

      toast.success(
        `Décryptage terminé ! ${result.updated} SIPI décryptés, ${result.alreadyDecrypted} déjà en clair, ${result.errors} erreurs`
      );
    } catch (error) {
      console.error('Error decrypting SIPI numbers:', error);
      toast.error(
        error instanceof Error 
          ? error.message 
          : 'Erreur lors du décryptage des numéros SIPI'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleDecrypt}
      disabled={loading}
      variant="outline"
      className="gap-2"
    >
      <Unlock className="h-4 w-4" />
      {loading ? 'Décryptage en cours...' : 'Décrypter les SIPI'}
    </Button>
  );
};
