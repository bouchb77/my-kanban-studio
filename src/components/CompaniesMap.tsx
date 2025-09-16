import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Building2 } from "lucide-react";

interface Company {
  id: string;
  sipi_number: string;
  company_name: string;
  latitude: number;
  longitude: number;
  address1?: string;
  city?: string;
  general_department?: string;
}

const CompaniesMap = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch companies with GPS coordinates
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        console.log('Fetching companies with GPS coordinates...');
        const { data, error } = await supabase
          .from('companies')
          .select('id, sipi_number, company_name, latitude, longitude, address1, city, general_department')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

        if (error) {
          console.error('Error fetching companies:', error);
          setError('Erreur lors du chargement des entreprises');
          return;
        }

        console.log('Companies loaded:', data?.length || 0);
        setCompanies(data || []);
      } catch (error) {
        console.error('Error:', error);
        setError('Erreur de connexion');
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  if (loading) {
    return (
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Carte des entreprises
          </CardTitle>
          <CardDescription>
            Localisation géographique des entreprises
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center bg-muted/30 rounded-lg">
            <div className="text-muted-foreground">Chargement de la carte...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Carte des entreprises
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center bg-destructive/10 rounded-lg border border-destructive/20">
            <div className="text-destructive">{error}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Carte des entreprises
        </CardTitle>
        <CardDescription className="flex items-center gap-4">
          <span>Localisation géographique des entreprises</span>
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4" />
            <span>{companies.length} entreprises géolocalisées</span>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {companies.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center bg-muted/30 rounded-lg">
            <MapPin className="w-12 h-12 text-muted-foreground mb-4" />
            <div className="text-muted-foreground text-center">
              <p className="font-medium">Aucune entreprise géolocalisée</p>
              <p className="text-sm mt-1">Les entreprises seront affichées ici une fois géolocalisées</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-96 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-16 h-16 text-primary mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Carte interactive en cours d'implémentation</h3>
                <p className="text-muted-foreground mb-4">
                  {companies.length} entreprises sont prêtes à être affichées sur la carte
                </p>
              </div>
            </div>
            
            {/* Liste des entreprises géolocalisées */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-40 overflow-y-auto">
              {companies.slice(0, 12).map((company) => (
                <div 
                  key={company.id}
                  className="p-3 bg-background border border-border rounded-lg hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm text-foreground truncate">
                        {company.company_name}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        SIPI: {company.sipi_number}
                      </p>
                      {company.city && (
                        <p className="text-xs text-muted-foreground truncate">
                          {company.city}
                          {company.general_department && `, ${company.general_department}`}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {company.latitude.toFixed(4)}, {company.longitude.toFixed(4)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {companies.length > 12 && (
              <div className="text-center text-sm text-muted-foreground">
                ... et {companies.length - 12} autres entreprises
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompaniesMap;