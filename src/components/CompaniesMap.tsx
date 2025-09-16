import React, { useEffect, useState, Suspense, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MapPin, Building2, Filter, ChevronDown } from "lucide-react";

const MapComponent = React.lazy(() => import('./MapComponent'));

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
  const [showMap, setShowMap] = useState(true);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  // Get unique departments for filter
  const departments = useMemo(() => {
    const uniqueDepartments = [...new Set(companies
      .map(company => company.general_department)
      .filter(dept => dept)
    )].sort();
    return uniqueDepartments;
  }, [companies]);

  // Filter companies based on selected departments
  const filteredCompanies = useMemo(() => {
    if (selectedDepartments.length === 0) {
      return companies;
    }
    return companies.filter(company => 
      company.general_department && selectedDepartments.includes(company.general_department)
    );
  }, [companies, selectedDepartments]);

  const handleDepartmentToggle = (department: string) => {
    setSelectedDepartments(prev => 
      prev.includes(department)
        ? prev.filter(d => d !== department)
        : [...prev, department]
    );
  };

  const handleSelectAll = () => {
    if (selectedDepartments.length === departments.length) {
      setSelectedDepartments([]);
    } else {
      setSelectedDepartments(departments);
    }
  };

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
            <span>{filteredCompanies.length} entreprise{filteredCompanies.length > 1 ? 's' : ''} affichée{filteredCompanies.length > 1 ? 's' : ''}</span>
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
            <div className="flex gap-2">
              <button
                onClick={() => setShowMap(true)}
                className={`px-3 py-1 rounded text-sm ${showMap ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                Carte
              </button>
              <button
                onClick={() => setShowMap(false)}
                className={`px-3 py-1 rounded text-sm ${!showMap ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                Liste
              </button>
            </div>
            
            {showMap ? (
              <>
                <Suspense fallback={
                  <div className="h-[500px] w-3/4 mx-auto flex items-center justify-center bg-muted/30 rounded-lg border">
                    <div className="text-muted-foreground">Chargement de la carte...</div>
                  </div>
                }>
                  <MapComponent companies={filteredCompanies} />
                </Suspense>
                
                <div className="flex items-center gap-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filtrer par département :</span>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-64 justify-between">
                        {selectedDepartments.length === 0 
                          ? "Tous les départements"
                          : selectedDepartments.length === 1
                          ? selectedDepartments[0]
                          : `${selectedDepartments.length} départements sélectionnés`
                        }
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0 bg-background border shadow-xl" align="start">
                      <div className="p-2 bg-background">
                        <div className="flex items-center space-x-2 p-2 border-b bg-background">
                          <Checkbox 
                            id="select-all"
                            checked={selectedDepartments.length === departments.length}
                            onCheckedChange={handleSelectAll}
                          />
                          <label htmlFor="select-all" className="text-sm font-medium">
                            Tout sélectionner
                          </label>
                        </div>
                        <div className="max-h-48 overflow-y-auto bg-background">
                          {departments.map((department) => (
                            <div key={department} className="flex items-center space-x-2 p-2 hover:bg-muted/50 bg-background">
                              <Checkbox 
                                id={department}
                                checked={selectedDepartments.includes(department)}
                                onCheckedChange={() => handleDepartmentToggle(department)}
                              />
                              <label htmlFor={department} className="text-sm flex-1 cursor-pointer">
                                {department}
                              </label>
                            </div>
                          ))}
                        </div>
                        {selectedDepartments.length > 0 && (
                          <div className="p-2 border-t bg-background">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setSelectedDepartments([])}
                              className="w-full"
                            >
                              Effacer la sélection
                            </Button>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredCompanies.map((company) => (
                  <div key={company.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{company.company_name}</h3>
                        <p className="text-sm text-muted-foreground">SIPI: {company.sipi_number}</p>
                        {company.address1 && (
                          <p className="text-sm">{company.address1}</p>
                        )}
                        {company.city && (
                          <p className="text-sm">
                            {company.city}
                            {company.general_department && ` (${company.general_department})`}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>Lat: {company.latitude.toFixed(4)}</p>
                        <p>Lng: {company.longitude.toFixed(4)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompaniesMap;