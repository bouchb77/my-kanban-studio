import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, Download, FileSpreadsheet, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Contact {
  sipi_number: string;
  contact_name?: string;
  email?: string;
  phone?: string;
}

const ContactImportSection: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const { user } = useAuth();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json<any>(firstSheet);

        const parsedContacts: Contact[] = rawData.map((row) => ({
          sipi_number: String(row['SIPI'] || row['sipi'] || row['sipi_number'] || '').trim(),
          contact_name: String(row['Contact'] || row['contact'] || row['contact_name'] || '').trim() || undefined,
          email: String(row['E-mail'] || row['email'] || row['Email'] || '').trim() || undefined,
          phone: String(row['Téléphone'] || row['telephone'] || row['phone'] || row['Phone'] || '').trim() || undefined,
        })).filter(contact => contact.sipi_number);

        setContacts(parsedContacts);
        toast.success(`${parsedContacts.length} contacts prêts à importer`);
      } catch (error) {
        console.error('Erreur lors de la lecture du fichier:', error);
        toast.error('Erreur lors de la lecture du fichier Excel');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!user) {
      toast.error('Vous devez être connecté pour importer des données');
      return;
    }

    if (contacts.length === 0) {
      toast.error('Aucun contact à importer');
      return;
    }

    setIsImporting(true);
    
    try {
      const { error } = await supabase
        .from('contacts')
        .upsert(contacts, { onConflict: 'sipi_number' });

      if (error) {
        console.error('Erreur lors de l\'import:', error);
        toast.error('Erreur lors de l\'import des contacts');
        return;
      }

      toast.success(`${contacts.length} contacts importés avec succès`);
      setContacts([]);
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById('contact-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      toast.error('Erreur lors de l\'import des contacts');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        'SIPI': '123456789',
        'Contact': 'Jean Dupont',
        'E-mail': 'jean.dupont@entreprise.com',
        'Téléphone': '01 23 45 67 89'
      },
      {
        'SIPI': '987654321',
        'Contact': 'Marie Martin',
        'E-mail': 'marie.martin@societe.fr',
        'Téléphone': '02 34 56 78 90'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
    XLSX.writeFile(workbook, 'template_contacts.xlsx');
    toast.success('Template téléchargé');
  };

  const clearSelection = () => {
    setContacts([]);
    setSelectedFile(null);
    const fileInput = document.getElementById('contact-file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Import des Contacts
        </CardTitle>
        <CardDescription>
          Importez les informations de contact des entreprises depuis un fichier Excel.
          Colonnes attendues : SIPI, Contact, E-mail, Téléphone
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Télécharger le template */}
        <div className="space-y-2">
          <Label>1. Télécharger le template</Label>
          <Button onClick={downloadTemplate} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Télécharger le template Excel
          </Button>
        </div>

        {/* Upload du fichier */}
        <div className="space-y-2">
          <Label htmlFor="contact-file-input">2. Sélectionner le fichier Excel</Label>
          <Input
            id="contact-file-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="cursor-pointer"
          />
          {selectedFile && (
            <p className="text-sm text-muted-foreground">
              Fichier sélectionné : {selectedFile.name}
            </p>
          )}
        </div>

        {/* Nombre de contacts */}
        {contacts.length > 0 && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="font-medium">
              {contacts.length} contact{contacts.length > 1 ? 's' : ''} prêt{contacts.length > 1 ? 's' : ''} à importer
            </p>
            
            {/* Aperçu des premiers contacts */}
            {contacts.length > 0 && (
              <div className="mt-4 space-y-2">
                <Label>Aperçu des contacts :</Label>
                <div className="space-y-1 text-sm">
                  {contacts.slice(0, 3).map((contact, index) => (
                    <div key={index} className="text-muted-foreground">
                      SIPI: {contact.sipi_number}
                      {contact.contact_name && ` - ${contact.contact_name}`}
                      {contact.email && ` - ${contact.email}`}
                      {contact.phone && ` - ${contact.phone}`}
                    </div>
                  ))}
                  {contacts.length > 3 && (
                    <div className="text-muted-foreground">
                      ... et {contacts.length - 3} autre{contacts.length - 3 > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Boutons d'action */}
        <div className="flex gap-2">
          <Button
            onClick={handleImport}
            disabled={contacts.length === 0 || isImporting}
            className="flex-1"
          >
            {isImporting ? (
              <>
                <Upload className="w-4 h-4 mr-2 animate-spin" />
                Import en cours...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Importer les Contacts
              </>
            )}
          </Button>
          
          {contacts.length > 0 && (
            <Button onClick={clearSelection} variant="outline">
              <Trash2 className="w-4 h-4 mr-2" />
              Effacer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ContactImportSection;