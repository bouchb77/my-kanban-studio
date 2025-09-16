import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';

interface Company {
  id?: string;
  sipi_number: string;
  company_name: string;
  address1?: string;
  address2?: string;
  city?: string;
  postal_code?: string;
  general_department?: string;
  quality?: string;
  last_order_date?: string;
  client_blocked_date?: string;
  training_date?: string;
  report_creation_date?: string;
  latitude?: number;
  longitude?: number;
  geocoded_address?: string;
}

export function CompanyImportSection() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fonction pour convertir les dates Excel
  const parseExcelDate = (excelDate: any): string | undefined => {
    console.log('parseExcelDate appelée avec:', excelDate, 'type:', typeof excelDate);
    
    if (!excelDate) return undefined;
    
    // Si c'est déjà une chaîne de date valide au format ISO
    if (typeof excelDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(excelDate)) {
      const result = excelDate.split('T')[0]; // Prendre seulement la partie date
      console.log('Date string détectée:', excelDate, '→', result);
      return result;
    }
    
    // Si c'est un objet Date JavaScript
    if (excelDate instanceof Date) {
      const result = excelDate.toISOString().split('T')[0];
      console.log('Date object détectée:', excelDate, '→', result);
      return result;
    }
    
    // Si c'est un nombre (format Excel - jours depuis 1900-01-01)
    if (typeof excelDate === 'number') {
      try {
        // Excel compte les jours depuis le 1er janvier 1900
        // Mais il y a une erreur dans Excel qui compte 1900 comme une année bissextile
        const excelEpoch = new Date(1900, 0, 1);
        const millisecondsPerDay = 24 * 60 * 60 * 1000;
        
        // Ajuster pour l'erreur d'Excel avec 1900
        let adjustedDays = excelDate;
        if (excelDate > 59) { // après le 28 février 1900
          adjustedDays = excelDate - 1;
        }
        
        const resultDate = new Date(excelEpoch.getTime() + (adjustedDays - 1) * millisecondsPerDay);
        
        if (!isNaN(resultDate.getTime())) {
          const result = resultDate.toISOString().split('T')[0];
          console.log('Date number convertie:', excelDate, '→', result);
          return result;
        }
      } catch (e) {
        console.warn('Erreur conversion date Excel number:', excelDate, e);
      }
    }
    
    // Essayer de parser comme une chaîne normale
    if (typeof excelDate === 'string') {
      try {
        const parsed = new Date(excelDate);
        if (!isNaN(parsed.getTime())) {
          const result = parsed.toISOString().split('T')[0];
          console.log('Date string parsed:', excelDate, '→', result);
          return result;
        }
      } catch (e) {
        console.warn('Erreur parsing date string:', excelDate, e);
      }
    }
    
    console.warn('Date non convertible:', excelDate, 'type:', typeof excelDate);
    return undefined;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true, dateNF: 'yyyy-mm-dd' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Transformer les données Excel en format attendu
      const parsedCompanies: Company[] = jsonData.map((row: any, index: number) => {
        console.log(`Ligne ${index + 1} - Données brutes:`, row);
        
        const company = {
          sipi_number: String(row['N° Société'] || row['No Société'] || row['SIPI'] || '').replace(/\D/g, ''),
          company_name: String(row['Nom de société'] || row['Nom société'] || row['Société'] || row['Company'] || ''),
          address1: String(row['Adresse1'] || row['Adresse 1'] || ''),
          address2: String(row['Adresse2'] || row['Adresse 2'] || ''),
          city: String(row['Ville'] || ''),
          postal_code: String(row['CP'] || row['Code Postal'] || ''),
          general_department: String(row['Département général'] || row['Département'] || ''),
          quality: String(row['Qualité'] || ''),
          last_order_date: parseExcelDate(row['Date de dernière cmd']),
          client_blocked_date: parseExcelDate(row['Date de client bloqué']),
          training_date: parseExcelDate(row['Date de formation']),
          report_creation_date: parseExcelDate(row['Date de création du rapport'])
        };
        
        console.log(`Ligne ${index + 1} - Dates parsées:`, {
          'Date de dernière cmd': row['Date de dernière cmd'],
          'Date de client bloqué': row['Date de client bloqué'],
          'Date de formation': row['Date de formation'],
          'Date de création du rapport': row['Date de création du rapport'],
          parsed_last_order_date: company.last_order_date,
          parsed_client_blocked_date: company.client_blocked_date,
          parsed_training_date: company.training_date,
          parsed_report_creation_date: company.report_creation_date
        });
        
        return company;
      }).filter(company => company.sipi_number && company.company_name);

      if (parsedCompanies.length === 0) {
        toast({
          title: "Aucune donnée trouvée",
          description: "Vérifiez que votre fichier contient les colonnes requises (N° Société et Nom de société minimum)",
          variant: "destructive",
        });
        return;
      }

      setCompanies(parsedCompanies);
      toast({
        title: "Fichier analysé",
        description: `${parsedCompanies.length} entreprises trouvées`,
      });
    } catch (error) {
      console.error('Error reading Excel file:', error);
      toast({
        title: "Erreur",
        description: "Impossible de lire le fichier Excel",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const geocodeAddress = async (company: Company): Promise<{latitude?: number, longitude?: number, geocoded_address?: string}> => {
    const addressParts = [
      company.address1,
      company.address2,
      company.city,
      company.general_department
    ].filter(Boolean);
    
    if (addressParts.length === 0) {
      return {};
    }

    const address = addressParts.join(', ');
    
    try {
      // Using Nominatim API (OpenStreetMap) for geocoding - free service
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=fr`,
        {
          headers: {
            'User-Agent': 'TaskFlow-App'
          }
        }
      );
      
      if (!response.ok) {
        console.warn('Geocoding API error for:', address);
        return {};
      }
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        return {
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          geocoded_address: result.display_name
        };
      }
    } catch (error) {
      console.warn('Geocoding failed for:', address, error);
    }
    
    return {};
  };

  const geocodeCompaniesInBackground = async () => {
    console.log('Début de la géolocalisation en arrière-plan');
    
    try {
      // Récupérer les entreprises sans géolocalisation
      const { data: companiesWithoutGPS, error: fetchError } = await supabase
        .from('companies')
        .select('id, sipi_number, company_name, address1, address2, city, general_department')
        .is('latitude', null);

      if (fetchError) {
        console.error('Erreur récupération entreprises:', fetchError);
        return;
      }

      if (!companiesWithoutGPS || companiesWithoutGPS.length === 0) {
        console.log('Aucune entreprise à géolocaliser');
        return;
      }

      console.log(`Géolocalisation de ${companiesWithoutGPS.length} entreprises`);
      
      // Traiter par petits lots pour éviter les timeouts
      const batchSize = 10;
      let processed = 0;
      
      for (let i = 0; i < companiesWithoutGPS.length; i += batchSize) {
        const batch = companiesWithoutGPS.slice(i, Math.min(i + batchSize, companiesWithoutGPS.length));
        
        for (const company of batch) {
          try {
            const gpsData = await geocodeAddress(company);
            
            if (gpsData.latitude && gpsData.longitude) {
              // Mettre à jour l'entreprise avec les coordonnées GPS
              const { error: updateError } = await supabase
                .from('companies')
                .update({
                  latitude: gpsData.latitude,
                  longitude: gpsData.longitude,
                  geocoded_address: gpsData.geocoded_address,
                  geocoding_date: new Date().toISOString()
                })
                .eq('id', company.id);

              if (updateError) {
                console.error('Erreur mise à jour GPS pour', company.company_name, ':', updateError);
              } else {
                console.log('GPS mis à jour pour:', company.company_name);
              }
            }
            
            processed++;
            
            // Délai pour respecter les limites de l'API
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (error) {
            console.error('Erreur géolocalisation pour', company.company_name, ':', error);
          }
        }
        
        // Notification de progression
        if (i + batchSize < companiesWithoutGPS.length) {
          toast({
            title: "Géolocalisation en cours",
            description: `${processed}/${companiesWithoutGPS.length} entreprises géolocalisées`,
          });
        }
        
        // Pause entre les lots
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      toast({
        title: "Géolocalisation terminée",
        description: `${processed} entreprises géolocalisées avec succès`,
      });
      
    } catch (error) {
      console.error('Erreur géolocalisation en arrière-plan:', error);
      toast({
        title: "Erreur géolocalisation",
        description: "Impossible de géolocaliser les entreprises",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    console.log('=== DEBUT IMPORT DEBUG ===');
    
    // Vérifier l'état de connexion
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('Utilisateur connecté:', user);
    console.log('Erreur utilisateur:', userError);
    
    if (!user) {
      console.error('ERREUR: Utilisateur non connecté');
      toast({
        title: "Erreur d'authentification",
        description: "Vous devez être connecté pour importer des données",
        variant: "destructive",
      });
      return;
    }

    if (companies.length === 0) {
      console.log('Aucune entreprise à importer');
      return;
    }

    console.log('Début de l\'import de', companies.length, 'entreprises');
    setIsLoading(true);
    
    // Vérifier les permissions admin
    const { data: adminCheck, error: adminError } = await supabase.rpc('is_current_user_admin');
    console.log('Vérification admin:', adminCheck, adminError);
    
    if (!adminCheck) {
      console.error('ERREUR: Utilisateur sans droits admin');
      toast({
        title: "Permissions insuffisantes",
        description: "Vous devez avoir les droits administrateur pour importer des données",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    
    try {
      // Supprimer toutes les entreprises existantes (admin uniquement)
      console.log('Suppression des entreprises existantes...');
      const { error: deleteError } = await supabase
        .from('companies')
        .delete()
        .gte('created_at', '1900-01-01'); // Delete all

      if (deleteError) {
        console.error('Error deleting existing companies:', deleteError);
        throw deleteError;
      }
      console.log('Entreprises existantes supprimées');

      // Géolocaliser par lots pour optimiser les performances
      const batchSize = 50; // Traiter par lots de 50
      const companiesWithGPS = [];
      
      console.log('Début de la géolocalisation par lots');
      
      for (let i = 0; i < companies.length; i += batchSize) {
        const batch = companies.slice(i, Math.min(i + batchSize, companies.length));
        
        console.log(`Traitement du lot ${Math.floor(i/batchSize) + 1}/${Math.ceil(companies.length/batchSize)}`);
        
        // Traiter le lot actuel sans géolocalisation d'abord (plus rapide)
        const batchWithoutGPS = batch.map(company => {
          console.log('Dates avant insertion:', {
            last_order_date: company.last_order_date,
            client_blocked_date: company.client_blocked_date,
            training_date: company.training_date,
            report_creation_date: company.report_creation_date
          });
          
          return {
            sipi_number: company.sipi_number,
            company_name: company.company_name,
            address1: company.address1 || null,
            address2: company.address2 || null,
            city: company.city || null,
            postal_code: company.postal_code || null,
            general_department: company.general_department || null,
            quality: company.quality || null,
            last_order_date: company.last_order_date ? company.last_order_date : null,
            client_blocked_date: company.client_blocked_date ? company.client_blocked_date : null,
            training_date: company.training_date ? company.training_date : null,
            report_creation_date: company.report_creation_date ? company.report_creation_date : null,
            latitude: null,
            longitude: null,
            geocoded_address: null,
            geocoding_date: null
          };
        });
        
        companiesWithGPS.push(...batchWithoutGPS);
        
        // Mise à jour du progrès
        toast({
          title: "Import en cours...",
          description: `Traitement ${Math.min(i + batchSize, companies.length)}/${companies.length} entreprises`,
        });
        
        // Insérer le lot en base
        if (i === 0) {
          // Premier lot : supprimer les anciennes données
          const { error: deleteError } = await supabase
            .from('companies')
            .delete()
            .gte('created_at', '1900-01-01');
          
          if (deleteError) {
            console.error('Erreur suppression:', deleteError);
            throw deleteError;
          }
          console.log('Anciennes entreprises supprimées');
        }
        
        // Insérer le lot actuel
        console.log('Insertion du lot avec données:', batchWithoutGPS.slice(0, 2)); // Log des 2 premières entreprises
        const { data: insertData, error: insertError } = await supabase
          .from('companies')
          .insert(batchWithoutGPS)
          .select('sipi_number, last_order_date, client_blocked_date, training_date, report_creation_date');
        
        if (insertError) {
          console.error('Erreur insertion lot:', insertError);
          console.error('Données qui ont causé l\'erreur:', batchWithoutGPS.slice(0, 2));
          throw insertError;
        }
        
        console.log(`Lot ${Math.floor(i/batchSize) + 1} inséré avec succès`);
        if (insertData && insertData.length > 0) {
          console.log('Données insérées avec dates:', insertData.slice(0, 2));
        }
      }

      console.log('Import terminé avec succès');

      toast({
        title: "Import réussi",
        description: `${companies.length} entreprises importées avec succès. Démarrage de la géolocalisation...`,
      });
      setCompanies([]);
      
      // Démarrer la géolocalisation en arrière-plan
      geocodeCompaniesInBackground();
    } catch (error) {
      console.error('Error importing companies:', error);
      toast({
        title: "Erreur d'import",
        description: "Impossible d'importer les entreprises",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      { 
        "N° Société": "12345678", 
        "Nom de société": "Exemple SA",
        "Adresse1": "123 Rue de la Paix",
        "Adresse2": "Bâtiment A",
        "Ville": "Paris",
        "CP": "75001",
        "Département général": "Île-de-France",
        "Qualité": "Premium",
        "Date de dernière cmd": "2024-01-15",
        "Date de client bloqué": "",
        "Date de formation": "2024-02-01",
        "Date de création du rapport": "2024-01-01"
      },
      { 
        "N° Société": "87654321", 
        "Nom de société": "Demo SARL",
        "Adresse1": "456 Avenue des Champs",
        "Adresse2": "",
        "Ville": "Lyon",
        "CP": "69001",
        "Département général": "Rhône-Alpes",
        "Qualité": "Standard",
        "Date de dernière cmd": "2024-02-20",
        "Date de client bloqué": "2024-03-01",
        "Date de formation": "",
        "Date de création du rapport": "2024-01-15"
      }
    ];
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, ws, "Entreprises");
    XLSX.writeFile(wb, "modele_entreprises.xlsx");
  };

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Import des entreprises
        </CardTitle>
        <CardDescription>
          Importez un fichier Excel avec toutes les informations d'entreprises (N° Société, Nom, Adresse, etc.)
          <br />
          <strong>Dates au format:</strong> AAAA-MM-JJ (ex: 2024-01-15) ou format Excel
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={downloadTemplate}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Télécharger le modèle
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="excel-upload">Fichier Excel</Label>
          <Input
            ref={fileInputRef}
            id="excel-upload"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </div>

        {companies.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{companies.length} entreprises</Badge>
                <span className="text-sm text-muted-foreground">prêtes à importer</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCompanies([])}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Effacer
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={isLoading}
                  className="bg-primary text-primary-foreground"
                >
                  <Upload className="w-4 h-4 mr-1" />
                  {isLoading ? "Import en cours..." : "Importer"}
                </Button>
              </div>
            </div>

            <div className="max-h-40 overflow-y-auto border rounded-md p-2 bg-muted/30">
              {companies.slice(0, 10).map((company, index) => (
                <div key={index} className="flex justify-between items-center py-1 text-sm">
                  <span className="font-medium">{company.sipi_number}</span>
                  <span className="text-muted-foreground">{company.company_name}</span>
                </div>
              ))}
              {companies.length > 10 && (
                <div className="text-center text-sm text-muted-foreground py-2">
                  ... et {companies.length - 10} autres
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}