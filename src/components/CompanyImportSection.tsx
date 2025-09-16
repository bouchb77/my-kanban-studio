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
    if (!excelDate) return undefined;
    
    // Si c'est déjà une chaîne de date valide
    if (typeof excelDate === 'string' && excelDate.includes('-')) {
      return excelDate;
    }
    
    // Si c'est un nombre (format Excel)
    if (typeof excelDate === 'number') {
      try {
        const date = XLSX.SSF.parse_date_code(excelDate);
        if (date && date.y && date.m && date.d) {
          return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        }
      } catch (e) {
        console.warn('Erreur conversion date Excel:', excelDate);
      }
    }
    
    return undefined;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Transformer les données Excel en format attendu
      const parsedCompanies: Company[] = jsonData.map((row: any) => ({
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
      })).filter(company => company.sipi_number && company.company_name);

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

      // Geocode and insert companies with GPS coordinates
      const companiesWithGPS = [];
      let processed = 0;
      
      console.log('Début de la géolocalisation pour', companies.length, 'entreprises');
      
      for (const company of companies) {
        console.log(`Géolocalisation ${processed + 1}/${companies.length}: ${company.company_name}`);
        
        // Update progress in UI
        toast({
          title: "Géolocalisation en cours...",
          description: `Traitement ${processed + 1}/${companies.length}: ${company.company_name}`,
        });
        
        const gpsData = await geocodeAddress(company);
        console.log('GPS pour', company.company_name, ':', gpsData);
        companiesWithGPS.push({
          sipi_number: company.sipi_number,
          company_name: company.company_name,
          address1: company.address1 || null,
          address2: company.address2 || null,
          city: company.city || null,
          postal_code: company.postal_code || null,
          general_department: company.general_department || null,
          quality: company.quality || null,
          last_order_date: company.last_order_date || null,
          client_blocked_date: company.client_blocked_date || null,
          training_date: company.training_date || null,
          report_creation_date: company.report_creation_date || null,
          latitude: gpsData.latitude || null,
          longitude: gpsData.longitude || null,
          geocoded_address: gpsData.geocoded_address || null,
          geocoding_date: gpsData.latitude ? new Date().toISOString() : null
        });
        
        processed++;
        
        // Add delay to respect API limits
        if (processed < companies.length) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
      }

      // Insert all companies at once
      console.log('Tentative d\'insertion de', companiesWithGPS.length, 'entreprises');
      const { data: insertedData, error: insertError } = await supabase
        .from('companies')
        .insert(companiesWithGPS)
        .select();

      if (insertError) {
        console.error('Erreur insertion:', insertError);
        throw insertError;
      }

      console.log('Insertion réussie:', insertedData?.length, 'entreprises insérées');

      const geocodedCount = companiesWithGPS.filter(c => c.latitude && c.longitude).length;
      console.log('Statistiques finales:', {
        total: companies.length,
        inserted: insertedData?.length,
        geocoded: geocodedCount
      });
      
      toast({
        title: "Import réussi",
        description: `${companies.length} entreprises importées avec succès. ${geocodedCount} géolocalisées.`,
      });
      setCompanies([]);
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