import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Lock, Loader2 } from 'lucide-react';

export const EncryptExistingDataButton = () => {
  const [isEncryptingCompanies, setIsEncryptingCompanies] = useState(false);
  const [isEncryptingContacts, setIsEncryptingContacts] = useState(false);
  const [companiesResult, setCompaniesResult] = useState<any>(null);
  const [contactsResult, setContactsResult] = useState<any>(null);
  const { toast } = useToast();

  const handleEncryptCompanies = async () => {
    setIsEncryptingCompanies(true);
    setCompaniesResult(null);

    try {
      toast({
        title: "Chiffrement des entreprises démarré",
        description: "Le processus de chiffrement des entreprises a démarré...",
      });

      const { data, error } = await supabase.functions.invoke('encrypt-existing-companies');

      if (error) {
        throw error;
      }

      setCompaniesResult(data);
      
      toast({
        title: "✅ Chiffrement des entreprises terminé",
        description: `${data.encrypted} entreprises chiffrées, ${data.alreadyEncrypted} déjà chiffrées`,
      });
    } catch (error) {
      console.error('Error encrypting companies:', error);
      toast({
        title: "❌ Erreur",
        description: "Impossible de chiffrer les entreprises",
        variant: "destructive",
      });
    } finally {
      setIsEncryptingCompanies(false);
    }
  };

  const handleEncryptContacts = async () => {
    setIsEncryptingContacts(true);
    setContactsResult(null);

    try {
      toast({
        title: "Chiffrement des contacts démarré",
        description: "Traitement par lots de 500 contacts...",
      });

      let offset = 0;
      let hasMore = true;
      let totalEncrypted = 0;
      let totalAlreadyEncrypted = 0;
      let totalErrors = 0;
      let totalCount = 0;
      let batchNumber = 1;

      // Traiter par lots jusqu'à ce qu'il n'y ait plus de contacts
      while (hasMore) {
        console.log(`🚀 Processing batch ${batchNumber} (offset: ${offset})...`);
        
        const { data, error } = await supabase.functions.invoke('encrypt-existing-contacts', {
          body: { offset, batchSize: 500 }
        });

        if (error) {
          console.error('Batch error:', error);
          throw error;
        }

        if (!data) {
          throw new Error('No data returned from function');
        }

        // Accumuler les résultats
        totalEncrypted += data.encrypted || 0;
        totalAlreadyEncrypted += data.alreadyEncrypted || 0;
        totalErrors += data.errors || 0;
        totalCount = data.total || 0;
        hasMore = data.hasMore || false;
        offset = data.nextOffset || 0;

        // Mettre à jour l'affichage avec la progression
        setContactsResult({
          total: totalCount,
          encrypted: totalEncrypted,
          alreadyEncrypted: totalAlreadyEncrypted,
          errors: totalErrors,
          currentBatch: batchNumber,
          processed: offset
        });

        // Toast de progression
        toast({
          title: `Lot ${batchNumber} traité`,
          description: `${totalEncrypted} contacts chiffrés sur ${totalCount} au total`,
        });

        batchNumber++;

        // Petite pause entre les lots pour éviter de surcharger
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Toast final
      toast({
        title: "✅ Chiffrement des contacts terminé",
        description: `${totalEncrypted} contacts chiffrés, ${totalAlreadyEncrypted} déjà chiffrés sur ${totalCount} contacts`,
      });
    } catch (error) {
      console.error('Error encrypting contacts:', error);
      toast({
        title: "❌ Erreur",
        description: error instanceof Error ? error.message : "Impossible de chiffrer les contacts",
        variant: "destructive",
      });
    } finally {
      setIsEncryptingContacts(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Chiffrement des entreprises */}
      <div className="space-y-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={isEncryptingCompanies}>
              {isEncryptingCompanies ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Chiffrement des entreprises en cours...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Chiffrer les entreprises existantes
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer le chiffrement des entreprises</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  Cette opération va chiffrer toutes les données sensibles des entreprises dans la base de données.
                  <br /><br />
                  <strong>Attention :</strong> Cette opération est irréversible et peut prendre plusieurs minutes.
                  <br /><br />
                  Les champs suivants seront chiffrés :
                  <ul className="list-disc list-inside mt-2">
                    <li>Nom de l'entreprise</li>
                    <li>Adresse 1</li>
                    <li>Adresse 2</li>
                    <li>Ville</li>
                    <li>Code postal</li>
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleEncryptCompanies}>
                Confirmer le chiffrement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {companiesResult && (
          <div className="p-4 border rounded-lg space-y-2 text-sm">
            <h3 className="font-semibold">Résultat du chiffrement des entreprises :</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>Total d'entreprises :</div>
              <div className="font-medium">{companiesResult.total}</div>
              
              <div>Chiffrées :</div>
              <div className="font-medium text-green-600">{companiesResult.encrypted}</div>
              
              <div>Déjà chiffrées :</div>
              <div className="font-medium text-blue-600">{companiesResult.alreadyEncrypted}</div>
              
              <div>Erreurs :</div>
              <div className="font-medium text-destructive">{companiesResult.errors}</div>
            </div>
          </div>
        )}
      </div>

      {/* Chiffrement des contacts */}
      <div className="space-y-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={isEncryptingContacts}>
              {isEncryptingContacts ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Chiffrement des contacts en cours...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Chiffrer les contacts existants
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer le chiffrement des contacts</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  Cette opération va chiffrer toutes les données sensibles des contacts dans la base de données.
                  <br /><br />
                  <strong>Attention :</strong> Cette opération est irréversible et peut prendre plusieurs minutes.
                  <br /><br />
                  Les champs suivants seront chiffrés :
                  <ul className="list-disc list-inside mt-2">
                    <li>Nom du contact</li>
                    <li>Email</li>
                    <li>Téléphone</li>
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleEncryptContacts}>
                Confirmer le chiffrement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {contactsResult && (
          <div className="p-4 border rounded-lg space-y-2 text-sm">
            <h3 className="font-semibold">
              {isEncryptingContacts ? `🔄 Traitement en cours (Lot ${contactsResult.currentBatch || 1})...` : 'Résultat du chiffrement des contacts :'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>Total de contacts :</div>
              <div className="font-medium">{contactsResult.total}</div>
              
              {isEncryptingContacts && (
                <>
                  <div>Traités :</div>
                  <div className="font-medium">{contactsResult.processed || 0} / {contactsResult.total}</div>
                </>
              )}
              
              <div>Chiffrés :</div>
              <div className="font-medium text-green-600">{contactsResult.encrypted}</div>
              
              <div>Déjà chiffrés :</div>
              <div className="font-medium text-blue-600">{contactsResult.alreadyEncrypted}</div>
              
              <div>Erreurs :</div>
              <div className="font-medium text-destructive">{contactsResult.errors}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
