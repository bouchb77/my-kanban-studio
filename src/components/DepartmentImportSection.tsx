import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

const DepartmentImportSection = () => {
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log('Parsed data:', jsonData);

      // Process and import the data
      const departmentData = jsonData.map((row: any) => ({
        department_name: row['Département'] || row['Department'] || row['département'],
        responsable_bo: row['Responsable BO'] || row['ResponsableBO'] || row['responsable_bo'],
        ct: row['CT'] || row['ct'],
        formateur: row['Formateur'] || row['formateur']
      }));

      console.log('Department data to insert:', departmentData);

      // Insert data into Supabase
      const { data: insertedData, error } = await supabase
        .from('department_management')
        .upsert(departmentData, { 
          onConflict: 'department_name',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('Error inserting department data:', error);
        toast({
          title: "❌ Erreur d'import",
          description: "Erreur lors de l'importation des données des départements",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "✅ Import réussi",
        description: `${departmentData.length} départements importés avec succès`,
      });

    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: "❌ Erreur",
        description: "Erreur lors du traitement du fichier Excel",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleImportDefaultData = async () => {
    setImporting(true);
    try {
      // Fetch the default Excel file
      const response = await fetch('/department-data.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      
      const workbook = XLSX.read(arrayBuffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log('Default data parsed:', jsonData);

      // Process the data with different possible column names
      const departmentData = jsonData.map((row: any) => {
        const keys = Object.keys(row);
        console.log('Row keys:', keys);
        
        return {
          department_name: row['Département'] || row['Department'] || row['département'] || row[keys[0]],
          responsable_bo: row['Responsable BO'] || row['ResponsableBO'] || row['responsable_bo'] || row[keys[1]],
          ct: row['CT'] || row['ct'] || row[keys[2]],
          formateur: row['Formateur'] || row['formateur'] || row[keys[3]]
        };
      });

      console.log('Processed department data:', departmentData);

      // Insert data into Supabase
      const { data: insertedData, error } = await supabase
        .from('department_management')
        .upsert(departmentData, { 
          onConflict: 'department_name',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('Error inserting department data:', error);
        toast({
          title: "❌ Erreur d'import",
          description: "Erreur lors de l'importation des données des départements",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "✅ Import réussi",
        description: `${departmentData.length} départements importés avec succès`,
      });

    } catch (error) {
      console.error('Error importing default data:', error);
      toast({
        title: "❌ Erreur",
        description: "Erreur lors de l'importation des données par défaut",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Import des données départements
        </CardTitle>
        <CardDescription>
          Importez les informations des responsables BO, CT et formateurs par département
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Button
            onClick={handleImportDefaultData}
            disabled={importing}
            className="flex items-center gap-2"
          >
            {importing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Importer le fichier par défaut
          </Button>

          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={importing}
              className="hidden"
              id="excel-upload"
            />
            <label htmlFor="excel-upload">
              <Button
                variant="outline"
                disabled={importing}
                className="flex items-center gap-2 cursor-pointer"
                asChild
              >
                <span>
                  {importing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Importer un autre fichier Excel
                </span>
              </Button>
            </label>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>Le fichier Excel doit contenir les colonnes :</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Département (nom du département)</li>
            <li>Responsable BO (nom du responsable BO)</li>
            <li>CT (nom du CT)</li>
            <li>Formateur (nom du formateur)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default DepartmentImportSection;