import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Upload, Trash2, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Order {
  id: string;
  order_number: string;
  sipi_number: string;
  amount: number;
  order_date: string;
  status: string;
}

export const OrderImportSection: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  // Fonction pour convertir les dates Excel
  const parseExcelDate = (excelDate: any): string => {
    if (!excelDate) return '';
    
    // Si c'est déjà une chaîne de date valide au format ISO
    if (typeof excelDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(excelDate)) {
      return excelDate.split('T')[0]; // Prendre seulement la partie date
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
          return resultDate.toISOString().split('T')[0];
        }
      } catch (e) {
        console.warn('Erreur conversion date Excel:', excelDate, e);
      }
    }
    
    // Essayer de parser comme une chaîne normale
    if (typeof excelDate === 'string') {
      try {
        const parsed = new Date(excelDate);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      } catch (e) {
        console.warn('Erreur parsing date string:', excelDate, e);
      }
    }
    
    console.warn('Date non convertible:', excelDate);
    return '';
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true, dateNF: 'yyyy-mm-dd' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Skip header row and parse data
      const parsedOrders: Order[] = jsonData.slice(1).map((row, index) => ({
        id: `temp-${index}`,
        order_number: String(row[0] || ''),
        sipi_number: String(row[1] || ''),
        amount: parseFloat(row[2]) || 0,
        order_date: parseExcelDate(row[3]),
        status: String(row[4] || 'pending')
      })).filter(order => order.order_number); // Filter out empty rows

      setOrders(parsedOrders);
      toast({
        title: "Fichier analysé",
        description: `${parsedOrders.length} commandes trouvées dans le fichier.`,
      });
    } catch (error) {
      console.error('Erreur lors de la lecture du fichier:', error);
      toast({
        title: "Erreur",
        description: "Impossible de lire le fichier Excel.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (orders.length === 0) {
      toast({
        title: "Aucune donnée",
        description: "Aucune commande à importer.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      // Use the import_orders function to handle the import
      const { data, error } = await supabase.rpc('import_orders', {
        orders_data: orders.map(order => ({
          order_number: order.order_number,
          sipi_number: order.sipi_number,
          amount: order.amount,
          order_date: order.order_date,
          status: order.status
        }))
      });

      if (error) {
        throw error;
      }

      const result = data as { total?: number } | null;
      toast({
        title: "Import réussi",
        description: `${result?.total || orders.length} commandes ont été importées avec succès.`,
      });
      
      setOrders([]);
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      toast({
        title: "Erreur d'import",
        description: "Une erreur est survenue lors de l'import des commandes.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      ['N° Commande', 'SIPI', 'Montant', 'Date Commande', 'Statut'],
      ['CMD001', '123456789', 1500.50, '2024-01-15', 'pending'],
      ['CMD002', '987654321', 2300.00, '2024-01-16', 'completed'],
      ['CMD003', '456789123', 999.99, '2024-02-01', 'pending']
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'template_commandes.xlsx');
  };

  const clearData = () => {
    setOrders([]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Import des Commandes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-4">
          <Button 
            onClick={downloadTemplate}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Télécharger le modèle
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="order-file">Fichier Excel des commandes</Label>
          <Input
            id="order-file"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <p className="text-sm text-muted-foreground">
            Format attendu: N° Commande, SIPI, Montant, Date Commande (YYYY-MM-DD), Statut
          </p>
        </div>

        {orders.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">
                Aperçu des commandes ({orders.length})
              </h3>
              <div className="flex gap-2">
                <Button 
                  onClick={clearData}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Effacer
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={importing}
                  className="flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {importing ? 'Import en cours...' : 'Importer'}
                </Button>
              </div>
            </div>

            <div className="border rounded-md max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Commande</TableHead>
                    <TableHead>SIPI</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.slice(0, 10).map((order, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{order.sipi_number}</TableCell>
                      <TableCell>{order.amount.toFixed(2)} €</TableCell>
                      <TableCell>{order.order_date}</TableCell>
                      <TableCell>{order.status}</TableCell>
                    </TableRow>
                  ))}
                  {orders.length > 10 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        ... et {orders.length - 10} autres commandes
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};