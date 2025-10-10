import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Lock, Loader2 } from 'lucide-react';

export const EncryptExistingDataButton = () => {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleEncrypt = async () => {
    setIsEncrypting(true);
    setResult(null);

    try {
      toast({
        title: "Chiffrement démarré",
        description: "Le processus de chiffrement des données existantes a démarré...",
      });

      const { data, error } = await supabase.functions.invoke('encrypt-existing-companies');

      if (error) {
        throw error;
      }

      setResult(data);
      
      if (data.success) {
        toast({
          title: "✅ Chiffrement terminé",
          description: data.message,
        });
      } else {
        toast({
          title: "⚠️ Erreur",
          description: data.error || "Une erreur s'est produite",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error encrypting data:', error);
      toast({
        title: "❌ Erreur",
        description: "Impossible de chiffrer les données",
        variant: "destructive",
      });
    } finally {
      setIsEncrypting(false);
    }
  };

  return (
    <div className="space-y-4">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={isEncrypting}>
            {isEncrypting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Chiffrement en cours...
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Chiffrer les données existantes
              </>
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le chiffrement</AlertDialogTitle>
            <AlertDialogDescription>
              Cette opération va chiffrer toutes les données sensibles des entreprises dans la base de données.
              <br /><br />
              <strong>Attention :</strong> Cette opération est irréversible et peut prendre plusieurs minutes selon le nombre d'entreprises.
              <br /><br />
              Les champs suivants seront chiffrés :
              <ul className="list-disc list-inside mt-2">
                <li>Nom de l'entreprise</li>
                <li>Numéro SIPI</li>
                <li>Adresse 1</li>
                <li>Adresse 2</li>
                <li>Ville</li>
                <li>Code postal</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleEncrypt}>
              Confirmer le chiffrement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {result && (
        <div className="p-4 border rounded-lg space-y-2 text-sm">
          <h3 className="font-semibold">Résultat du chiffrement :</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>Total d'entreprises :</div>
            <div className="font-medium">{result.total}</div>
            
            <div>Chiffrées :</div>
            <div className="font-medium text-green-600">{result.encrypted}</div>
            
            <div>Déjà chiffrées :</div>
            <div className="font-medium text-blue-600">{result.alreadyEncrypted}</div>
            
            <div>Erreurs :</div>
            <div className="font-medium text-destructive">{result.errors}</div>
          </div>
        </div>
      )}
    </div>
  );
};
