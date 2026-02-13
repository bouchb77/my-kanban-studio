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

interface CompanyDEImport {
  company_name: string;
  address1?: string;
  address2?: string;
  city?: string;
  postal_code?: string;
  region?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
}

interface CompanyDEImportSectionProps {
  onImportComplete: () => void;
}

export function CompanyDEImportSection({ onImportComplete }: CompanyDEImportSectionProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [companies, setCompanies] = useState<CompanyDEImport[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

      const parsed: CompanyDEImport[] = jsonData.map((row: any) => ({
        company_name: String(row['Entreprise'] || row['Company'] || row['Firma'] || row['company_name'] || ''),
        address1: String(row['Adresse'] || row['Address'] || row['Adresse1'] || row['address1'] || '').trim() || undefined,
        address2: String(row['Adresse2'] || row['Address2'] || row['address2'] || '').trim() || undefined,
        city: String(row['Ville'] || row['City'] || row['Stadt'] || row['city'] || '').trim() || undefined,
        postal_code: String(row['CP'] || row['PLZ'] || row['Postal Code'] || row['postal_code'] || '').trim() || undefined,
        region: String(row['Région'] || row['Region'] || row['Bundesland'] || row['region'] || '').trim() || undefined,
        contact_name: String(row['Contact'] || row['Kontakt'] || row['contact_name'] || '').trim() || undefined,
        email: String(row['Email'] || row['E-mail'] || row['email'] || '').trim() || undefined,
        phone: String(row['Téléphone'] || row['Phone'] || row['Telefon'] || row['phone'] || '').trim() || undefined,
      })).filter(c => c.company_name);

      if (parsed.length === 0) {
        toast({
          title: "Aucune donnée trouvée",
          description: "Vérifiez que votre fichier contient au minimum la colonne 'Entreprise' ou 'Company'",
          variant: "destructive",
        });
        return;
      }

      setCompanies(parsed);
      toast({ title: "Fichier analysé", description: `${parsed.length} entreprises trouvées` });
    } catch (error) {
      console.error('Erreur lecture fichier:', error);
      toast({ title: "Erreur", description: "Impossible de lire le fichier Excel", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (companies.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Erreur", description: "Vous devez être connecté", variant: "destructive" });
      return;
    }

    const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
    if (!isAdmin) {
      toast({ title: "Permissions insuffisantes", description: "Droits administrateur requis", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Import par batch de 500
      const batchSize = 500;
      let imported = 0;

      for (let i = 0; i < companies.length; i += batchSize) {
        const batch = companies.slice(i, i + batchSize).map(c => ({
          company_name: c.company_name,
          address1: c.address1 || null,
          address2: c.address2 || null,
          city: c.city || null,
          postal_code: c.postal_code || null,
          region: c.region || null,
          contact_name: c.contact_name || null,
          email: c.email || null,
          phone: c.phone || null,
        }));

        const { error } = await supabase.from('companies_de').insert(batch);
        if (error) throw error;
        imported += batch.length;
      }

      toast({ title: "Import réussi", description: `${imported} entreprises DE importées` });
      setCompanies([]);
      onImportComplete();
    } catch (error) {
      console.error('Erreur import:', error);
      toast({ title: "Erreur d'import", description: "Impossible d'importer les entreprises", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [{
      "Entreprise": "Beispiel GmbH",
      "Adresse": "Musterstraße 1",
      "Ville": "Berlin",
      "CP": "10115",
      "Région": "Berlin",
      "Contact": "Max Mustermann",
      "Email": "max@beispiel.de",
      "Téléphone": "+49 30 12345678",
    }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "modele_entreprises_de.xlsx");
    toast({ title: "Téléchargement démarré", description: "Le modèle Excel DE a été téléchargé" });
  };

  const clearSelection = () => {
    setCompanies([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Import des entreprises DE
        </CardTitle>
        <CardDescription>
          Importez vos données d'entreprises allemandes depuis un fichier Excel (.xlsx, .xls)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Button onClick={downloadTemplate} variant="outline" className="flex items-center gap-1">
            <Download className="w-4 h-4" />
            Télécharger le modèle
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="file-upload-de">Fichier Excel</Label>
          <Input
            ref={fileInputRef}
            id="file-upload-de"
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
                <Button onClick={clearSelection} variant="outline" size="sm" className="flex items-center gap-1">
                  <Trash2 className="w-3 h-3" />
                  Effacer
                </Button>
                <Button onClick={handleImport} disabled={isLoading} size="sm" className="flex items-center gap-1">
                  <Upload className="w-4 h-4 mr-1" />
                  {isLoading ? "Import en cours..." : "Importer"}
                </Button>
              </div>
            </div>

            <div className="max-h-40 overflow-y-auto border rounded-md p-2 bg-muted/30">
              {companies.slice(0, 10).map((company, index) => (
                <div key={index} className="flex justify-between items-center py-1 text-sm">
                  <span className="font-medium">{company.company_name}</span>
                  <span className="text-muted-foreground">{company.city || '-'}</span>
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
