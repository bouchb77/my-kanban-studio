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
import { useEncryptedCompanies } from '@/hooks/useEncryptedCompanies';

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
  const { bulkUpsertCompanies } = useEncryptedCompanies();

  // Fonction pour convertir les dates Excel
  const cleanCity = (cityName: string): string => {
    // Retirer CEDEX et tout ce qui suit
    const cleanedCity = cityName.replace(/\s*CEDEX.*$/i, '').trim();
    return cleanedCity;
  };

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
          city: cleanCity(String(row['Ville'] || '')),
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

  const forceGeocodeAllCompanies = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('geocode-companies');
      if (error) {
        throw error;
      }
      
      toast({
        title: "Géolocalisation démarrée",
        description: "Géolocalisation Google Maps prioritaire avec fallbacks lancée en arrière-plan",
      });
    } catch (error) {
      console.error('Erreur démarrage géolocalisation forcée:', error);
      toast({
        title: "Erreur",
        description: "Impossible de démarrer la géolocalisation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
      // Convertir les données au format attendu par le service de chiffrement
      const companiesData = companies.map(company => ({
        sipiNumber: company.sipi_number,
        companyName: company.company_name,
        address1: company.address1 || undefined,
        address2: company.address2 || undefined,
        city: company.city || undefined,
        postalCode: company.postal_code || undefined,
        generalDepartment: company.general_department || undefined,
        quality: company.quality || undefined,
        lastOrderDate: company.last_order_date ? new Date(company.last_order_date) : undefined,
        clientBlockedDate: company.client_blocked_date ? new Date(company.client_blocked_date) : undefined,
        trainingDate: company.training_date ? new Date(company.training_date) : undefined,
        reportCreationDate: company.report_creation_date ? new Date(company.report_creation_date) : undefined,
      }));

      console.log('Import via service de chiffrement...');
      
      // Utiliser le service de chiffrement pour l'import
      const success = await bulkUpsertCompanies(companiesData);
      
      if (success) {
        console.log('Import terminé avec succès');
        toast({
          title: "Import réussi",
          description: `${companies.length} entreprises importées (cryptées). Géolocalisation en cours...`,
        });
        setCompanies([]);
        
        // Démarrer la géolocalisation en arrière-plan
        const { error: geocodeError } = await supabase.functions.invoke('geocode-companies');
        if (geocodeError) {
          console.error('Erreur démarrage géolocalisation:', geocodeError);
          toast({
            title: "Géolocalisation",
            description: "Erreur lors du démarrage de la géolocalisation automatique",
            variant: "destructive",
          });
        }
      }
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
        "Département général": "75",
        "Qualité": "Client Premium",
        "Date de dernière cmd": "2024-01-15",
        "Date de client bloqué": "",
        "Date de formation": "2023-12-01",
        "Date de création du rapport": "2023-11-15"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "modele_entreprises.xlsx");
    
    toast({
      title: "Téléchargement démarré",
      description: "Le modèle Excel a été téléchargé",
    });
  };

  const clearSelection = () => {
    setCompanies([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Import des entreprises
        </CardTitle>
        <CardDescription>
          Importez vos données d'entreprises depuis un fichier Excel (.xlsx, .xls)<br/>
          <span className="text-xs text-muted-foreground mt-1 block">
            ✅ Google Maps Geocoding API prioritaire + OpenRouteService + Nominatim OSM en fallback
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Button 
            onClick={downloadTemplate} 
            variant="outline"
            className="flex items-center gap-1"
          >
            <Download className="w-4 h-4" />
            Télécharger le modèle
          </Button>
          
          <Button 
            onClick={forceGeocodeAllCompanies} 
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-1"
          >
            {isLoading ? "Géolocalisation en cours..." : "Google Maps Geocoding"}
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="file-upload">Fichier Excel</Label>
          <Input
            ref={fileInputRef}
            id="file-upload"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="cursor-pointer"
          />
          {isUploading && <p className="text-sm text-muted-foreground">Lecture du fichier...</p>}
        </div>

        {companies.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-sm">
                {companies.length} entreprises prêtes à importer
              </Badge>
              <div className="flex gap-2">
                <Button 
                  onClick={clearSelection} 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Effacer
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={isLoading || companies.length === 0}
                  size="sm"
                  className="flex items-center gap-1"
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