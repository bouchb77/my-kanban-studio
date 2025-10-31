import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OrderDetail {
  order_number: string;
  article_code: string;
  quantity: number;
  expiration_date?: string;
}

export const OrderDetailImportSection = () => {
  const [details, setDetails] = useState<OrderDetail[]>([]);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);

  const parseExcelDate = (dateStr: string): string | null => {
    // Format attendu: MM/DD/YY ou DD/MM/YYYY
    const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!match) return null;
    
    let [, part1, part2, year] = match;
    
    // Convertir l'année en 4 chiffres si nécessaire
    if (year.length === 2) {
      year = '20' + year;
    }
    
    // Assume MM/DD/YY format (American format commonly in Excel)
    const month = part1.padStart(2, '0');
    const day = part2.padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        toast.error('Fichier vide ou invalide');
        return;
      }

      // La première ligne contient les codes d'articles (headers)
      // Chaque article occupe 2 colonnes: quantité puis date
      // Les headers ont les codes articles avec des colonnes vides entre eux
      const headers = jsonData[0];
      
      const parsedDetails: OrderDetail[] = [];

      // Parcourir chaque ligne de données (à partir de la ligne 1)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const orderNumber = String(row[0] || '').trim();
        if (!orderNumber) continue;

        // Parcourir toutes les colonnes pour trouver les codes articles dans les headers
        for (let colIndex = 1; colIndex < headers.length; colIndex++) {
          const articleCode = String(headers[colIndex] || '').trim();
          
          // Si on a un code article dans le header
          if (articleCode) {
            // La quantité est dans cette colonne
            const quantityCell = row[colIndex];
            if (!quantityCell) continue;

            const quantityStr = String(quantityCell).trim();
            const quantity = parseInt(quantityStr);
            
            // Vérifier que c'est bien un nombre valide
            if (isNaN(quantity) || quantity <= 0) continue;

            const detail: OrderDetail = {
              order_number: orderNumber,
              article_code: articleCode,
              quantity: quantity,
            };

            // La date de péremption est toujours dans la colonne suivante (colIndex + 1)
            if (colIndex + 1 < row.length && row[colIndex + 1]) {
              const dateCell = String(row[colIndex + 1]).trim();
              if (dateCell && dateCell.includes('/')) {
                const parsedDate = parseExcelDate(dateCell);
                if (parsedDate) {
                  detail.expiration_date = parsedDate;
                }
              }
            }

            parsedDetails.push(detail);
          }
        }
      }

      console.log('Parsed details:', parsedDetails.slice(0, 5));
      setDetails(parsedDetails);
      toast.success(`${parsedDetails.length} détails de commandes chargés depuis le fichier`);
    } catch (error) {
      console.error('Erreur lors de la lecture du fichier:', error);
      toast.error('Erreur lors de la lecture du fichier');
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (details.length === 0) {
      toast.error('Aucun détail de commande à importer');
      return;
    }

    setImporting(true);
    try {
      const BATCH_SIZE = 10000; // Lots plus petits pour éviter le timeout
      const batches = [];
      
      // Diviser en lots
      for (let i = 0; i < details.length; i += BATCH_SIZE) {
        batches.push(details.slice(i, i + BATCH_SIZE));
      }

      toast.info(`Import de ${details.length} détails en ${batches.length} lot(s)...`);

      let totalInserted = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;

      // Importer chaque lot
      for (let i = 0; i < batches.length; i++) {
        toast.info(`Import du lot ${i + 1}/${batches.length}...`);
        
        const { data, error } = await supabase.rpc('import_order_details', {
          details_data: batches[i] as any
        });

        if (error) throw error;

        const result = data as { inserted: number; updated: number; skipped: number };
        totalInserted += result.inserted;
        totalUpdated += result.updated;
        totalSkipped += result.skipped;
      }

      toast.success(
        `Import terminé: ${totalInserted} insérés, ${totalUpdated} mis à jour, ${totalSkipped} ignorés`
      );
      setDetails([]);
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      toast.error('Erreur lors de l\'import des détails de commandes');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['order_number', 'CI.D', 'CI.FA', 'CI.VD', 'ETLIS', 'MICRO', 'MINI', 'LOA', 'LPD', 'LPF'],
      ['', '31/12/2025', '31/12/2025', '31/12/2026', '31/12/2026', '31/12/2025', '31/12/2025', '31/12/2026', '31/12/2026', '31/12/2025'],
      ['505835', '0', '0', '0', '0', '0', '1', '0', '1', '0'],
      ['505836', '0', '0', '0', '0', '0', '0', '0', '0', '2']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Détails Commandes');
    XLSX.writeFile(wb, 'template_details_commandes.xlsx');
  };

  const clearData = () => {
    setDetails([]);
    toast.info('Données effacées');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import des Détails de Commandes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Importez un fichier Excel avec les articles commandés.
            Format matriciel: colonne 0 = numéro de commande, ligne 1 = codes articles en headers,
            lignes suivantes = quantités suivies optionnellement de dates de péremption (MM/DD/YY ou DD/MM/YYYY).
          </AlertDescription>
        </Alert>

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={downloadTemplate}
            variant="outline"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Télécharger le modèle
          </Button>

          <label>
            <Button
              variant="outline"
              className="gap-2"
              disabled={uploading}
              asChild
            >
              <span>
                <Upload className="w-4 h-4" />
                {uploading ? 'Chargement...' : 'Charger un fichier'}
              </span>
            </Button>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>

          {details.length > 0 && (
            <>
              <Button
                onClick={clearData}
                variant="outline"
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Effacer
              </Button>

              <Button
                onClick={handleImport}
                className="gap-2"
                disabled={importing}
              >
                <CheckCircle2 className="w-4 h-4" />
                {importing ? 'Import en cours...' : `Importer ${details.length} détails`}
              </Button>
            </>
          )}
        </div>

        {details.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">
              Aperçu des données ({details.length} lignes - affichage des 10 premières)
            </h3>
            <div className="border rounded-lg overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Numéro de commande</th>
                    <th className="px-4 py-2 text-left">Code article</th>
                    <th className="px-4 py-2 text-right">Quantité</th>
                    <th className="px-4 py-2 text-left">Date péremption</th>
                  </tr>
                </thead>
                <tbody>
                  {details.slice(0, 10).map((detail, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-2">{detail.order_number}</td>
                      <td className="px-4 py-2">{detail.article_code}</td>
                      <td className="px-4 py-2 text-right">{detail.quantity}</td>
                      <td className="px-4 py-2">{detail.expiration_date || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
