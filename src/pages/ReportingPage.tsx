import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { MapPin, Building2, Filter, ChevronDown, Globe, Search, CalendarIcon, ChevronUp, ArrowUpDown, Download, ShoppingCart, Euro, TrendingUp, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import MapComponent from './MapComponent'; // Assurez-vous d'avoir ce composant

interface Company {
  id: string;
  sipi_number: string;
  company_name: string;
  latitude: number;
  longitude: number;
  address1?: string;
  city?: string;
  general_department?: string;
  client_blocked_date?: string;
  training_date?: string;
  report_creation_date?: string;
  last_order_date?: string;
  quality?: string;
  orderStats?: CompanyOrderStats[];
  averageOrderPerYear?: number;
}

interface CompanyOrderStats {
  year: number;
  totalOrders: number;
  totalAmount: number;
}

// Composant qui affiche les cartes de manière épurée
interface CompaniesMapProps {
  companies: Company[];
  totalCompanies: number;
  heatmapMode?: boolean;
  geocoding: boolean;
  onGeocodeCompanies: () => void;
}

const CompaniesMapView = ({ companies, totalCompanies, heatmapMode = false, geocoding, onGeocodeCompanies }: CompaniesMapProps) => {
  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          {heatmapMode ? "Concentration de Clients" : "Localisation des Entreprises"}
        </CardTitle>
        <CardDescription className="flex items-center gap-4">
          <span>{heatmapMode ? "Carte de chaleur basée sur la densité des commandes" : "Répartition géographique des entreprises clientes"}</span>
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4" />
            <span>{companies.length} / {totalCompanies} entreprise{companies.length > 1 ? 's' : ''}</span>
          </div>
          {totalCompanies > companies.length && (
            <Button
              size="sm"
              variant="outline"
              onClick={onGeocodeCompanies}
              disabled={geocoding}
              className="ml-auto"
            >
              <Globe className="w-4 h-4 mr-2" />
              {geocoding ? "Démarrage..." : "Lancer la géolocalisation"}
            </Button>
          )}
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
          <MapComponent companies={companies} heatmapMode={heatmapMode} />
        )}
      </CardContent>
    </Card>
  );
};

const ReportingPage = () => {
  const { tasks, getTaskStats, loading: tasksLoading } = useTasks();
  const { orderStats, loading: ordersLoading } = useOrders();
  const { toast } = useToast();

  // État de toutes les entreprises
  const [companies, setCompanies] = useState<Company[]>([]);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyDetailOpen, setCompanyDetailOpen] = useState(false);

  // Filtres d'état centralisés
  const [sipiFilter, setSipiFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [companyNameFilter, setCompanyNameFilter] = useState('');
  const [minAverageFilter, setMinAverageFilter] = useState('');
  const [maxAverageFilter, setMaxAverageFilter] = useState('');
  const [formationFilter, setFormationFilter] = useState('');
  const [responsableBOFilter, setResponsableBOFilter] = useState('');
  const [formateurFilter, setFormateurFilter] = useState('');
  const [clientTypeFilter, setClientTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [departmentManagement, setDepartmentManagement] = useState<Record<string, any>>({});

  // Fonctions de données et de filtrage
  const fetchDepartmentManagement = async () => {
    try {
      const { data, error } = await supabase.from('department_management').select('*');
      if (error) { console.error('Error fetching department management:', error); return; }
      const managementMap: Record<string, any> = {};
      data?.forEach(dept => { managementMap[dept.department_name] = dept; });
      setDepartmentManagement(managementMap);
    } catch (error) { console.error('Error fetching department management:', error); }
  };

  const fetchCompaniesData = async () => {
    // ... (toute votre logique de récupération et de traitement des données des entreprises)
  };
  
  const fetchTotalCompanies = async () => {
    // ... (logique pour récupérer le nombre total d'entreprises)
  };

  const handleGeocodeCompanies = async () => {
    setGeocoding(true);
    try {
      toast({
        title: "Géolocalisation démarrée",
        description: "Le processus s'exécute en arrière-plan.",
      });
      const { data, error } = await supabase.functions.invoke('geocode-companies');
      if (error) throw error;
      toast({
        title: "✅ Processus lancé",
        description: data.message,
      });
      setTimeout(() => {
        fetchCompaniesData();
        fetchTotalCompanies();
      }, 10000);
    } catch (error) {
      console.error('Error geocoding companies:', error);
      toast({
        title: "❌ Erreur",
        description: "Erreur lors du lancement de la géolocalisation",
        variant: "destructive"
      });
    } finally {
      setGeocoding(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleCompanyClick = async (company: Company) => {
    try {
      const { data: fullCompanyData, error } = await supabase.from('companies').select('*').eq('id', company.id).single();
      if (error) { console.error('Error fetching company details:', error); return; }
      setSelectedCompany(fullCompanyData);
      setCompanyDetailOpen(true);
    } catch (error) { console.error('Error fetching company details:', error); }
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) { return <ArrowUpDown className="w-4 h-4 opacity-50" />; }
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };
  
  const departments = useMemo(() => {
    const uniqueDepartments = [...new Set(companies.map(company => company.general_department).filter(dept => dept))].sort();
    return uniqueDepartments;
  }, [companies]);
  
  const handleDepartmentToggle = (department: string) => {
    setSelectedDepartments(prev => prev.includes(department) ? prev.filter(d => d !== department) : [...prev, department]);
  };

  const handleSelectAll = () => {
    if (selectedDepartments.length === departments.length) { setSelectedDepartments([]); } else { setSelectedDepartments(departments); }
  };

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    companies.forEach(company => {
      if (company.orderStats) { company.orderStats.forEach(stat => years.add(stat.year)); }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [companies]);

  const uniqueResponsablesBO = useMemo(() => {
    const responsables = new Set<string>();
    Object.values(departmentManagement).forEach((dept: any) => { if (dept.responsable_bo) { responsables.add(dept.responsable_bo); } });
    return Array.from(responsables).sort();
  }, [departmentManagement]);

  const uniqueFormateurs = useMemo(() => {
    const formateurs = new Set<string>();
    Object.values(departmentManagement).forEach((dept: any) => { if (dept.formateur) { formateurs.add(dept.formateur); } });
    return Array.from(formateurs).sort();
  }, [departmentManagement]);

  const filteredCompanies = useMemo(() => {
    let filtered = companies.filter(company => {
      if (clientTypeFilter !== 'all') { if (!company.quality || company.quality !== clientTypeFilter) { return false; } }
      if (selectedDepartments.length > 0) { if (!company.general_department || !selectedDepartments.includes(company.general_department)) { return false; } }
      if (sipiFilter && !company.sipi_number.toLowerCase().includes(sipiFilter.toLowerCase())) { return false; }
      if (cityFilter && (!company.city || !company.city.toLowerCase().includes(cityFilter.toLowerCase()))) { return false; }
      if (companyNameFilter && !company.company_name.toLowerCase().includes(companyNameFilter.toLowerCase())) { return false; }
      if (minAverageFilter || maxAverageFilter) {
        const average = company.averageOrderPerYear || 0;
        const min = minAverageFilter ? parseFloat(minAverageFilter) : 0;
        const max = maxAverageFilter ? parseFloat(maxAverageFilter) : Infinity;
        if (average < min || average > max) { return false; }
      }
      if (formationFilter) {
        let formationStatus = 'non_formee';
        if (company.training_date) { formationStatus = 'formee_payant'; } else if (company.report_creation_date) { formationStatus = 'formee_mixte'; }
        if (formationStatus !== formationFilter) { return false; }
      }
      if (responsableBOFilter && company.general_department) {
        const deptData = departmentManagement[company.general_department];
        if (!deptData || !deptData.responsable_bo || !deptData.responsable_bo.toLowerCase().includes(responsableBOFilter.toLowerCase())) { return false; }
      }
      if (formateurFilter && company.general_department) {
        const deptData = departmentManagement[company.general_department];
        if (!deptData || !deptData.formateur || !deptData.formateur.toLowerCase().includes(formateurFilter.toLowerCase())) { return false; }
      }
      return true;
    });

    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any; let bValue: any;
        switch (sortColumn) {
          case 'company_name': aValue = a.company_name.toLowerCase(); bValue = b.company_name.toLowerCase(); break;
          case 'sipi_number': aValue = a.sipi_number; bValue = b.sipi_number; break;
          case 'city': aValue = (a.city || '').toLowerCase(); bValue = (b.city || '').toLowerCase(); break;
          case 'general_department': aValue = (a.general_department || '').toLowerCase(); bValue = (b.general_department || '').toLowerCase(); break;
          case 'averageOrderPerYear': aValue = a.averageOrderPerYear || 0; bValue = b.averageOrderPerYear || 0; break;
          default:
            if (sortColumn.startsWith('year_')) {
              const year = parseInt(sortColumn.replace('year_', ''));
              const aData = a.orderStats?.find(stat => stat.year === year);
              const bData = b.orderStats?.find(stat => stat.year === year);
              aValue = aData?.totalAmount || 0; bValue = bData?.totalAmount || 0;
            } else { return 0; }
        }
        const comparison = typeof aValue === 'string' && typeof bValue === 'string' ? aValue.localeCompare(bValue) : aValue - bValue;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    return filtered;
  }, [companies, clientTypeFilter, selectedDepartments, sipiFilter, cityFilter, companyNameFilter, minAverageFilter, maxAverageFilter, formationFilter, responsableBOFilter, formateurFilter, departmentManagement, sortColumn, sortDirection]);

  // Chargement des données au montage et mise à jour
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchCompaniesData(),
        fetchTotalCompanies(),
        fetchDepartmentManagement(),
      ]);
      setLoading(false);
    };
    loadData();
  }, [startDate, endDate]);

  if (loading || tasksLoading || ordersLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Chargement des données...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reporting</h1>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exporter
        </Button>
      </div>

      {/* SECTION UNIQUE DES FILTRES ET STATISTIQUES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtres de visualisation
          </CardTitle>
          <CardDescription>
            Ces filtres s'appliquent aux cartes ci-dessous et au tableau
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Le contenu de tous vos filtres va ici, en une seule fois */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium">Date de début</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Sélectionner"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium">Date de fin</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Sélectionner"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium">Numéro SIPI</label>
              <Input placeholder="Rechercher SIPI..." value={sipiFilter} onChange={(e) => setSipiFilter(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Ville</label>
              <Input placeholder="Rechercher ville..." value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Nom d'entreprise</label>
              <Input placeholder="Rechercher entreprise..." value={companyNameFilter} onChange={(e) => setCompanyNameFilter(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => {
              setStartDate(undefined); setEndDate(undefined); setSipiFilter(''); setCityFilter(''); setCompanyNameFilter('');
            }}>
              Réinitialiser les filtres
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SECTION DES CARTES DE VISUALISATION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CompaniesMapView
          companies={filteredCompanies}
          totalCompanies={totalCompanies}
          geocoding={geocoding}
          onGeocodeCompanies={handleGeocodeCompanies}
        />
        <CompaniesMapView
          companies={filteredCompanies}
          totalCompanies={totalCompanies}
          heatmapMode={true}
          geocoding={geocoding}
          onGeocodeCompanies={handleGeocodeCompanies}
        />
      </div>

      {/* SECTION DU TABLEAU UNIQUE */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des entreprises ({filteredCompanies.length})</CardTitle>
          <CardDescription>
            {totalCompanies} entreprises au total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              {/* ... (votre tableau complet ici) */}
            </Table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default ReportingPage;