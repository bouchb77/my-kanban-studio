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
}

export function CompanyImportSection() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
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
        last_order_date: row['Date de dernière cmd'] ? String(row['Date de dernière cmd']) : undefined,
        client_blocked_date: row['Date de client bloqué'] ? String(row['Date de client bloqué']) : undefined,
        training_date: row['Date de formation'] ? String(row['Date de formation']) : undefined,
        report_creation_date: row['Date de création du rapport'] ? String(row['Date de création du rapport']) : undefined
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

  const handleImport = async () => {
    if (companies.length === 0) return;

    setIsLoading(true);
    try {
      // Supprimer toutes les entreprises existantes (admin uniquement)
      const { error: deleteError } = await supabase
        .from('companies')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError) throw deleteError;

      // Insérer les nouvelles entreprises
      const { error: insertError } = await supabase
        .from('companies')
        .insert(
          companies.map(company => ({
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
            report_creation_date: company.report_creation_date || null
          }))
        );

      if (insertError) throw insertError;

      toast({
        title: "Import réussi",
        description: `${companies.length} entreprises importées avec succès`,
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