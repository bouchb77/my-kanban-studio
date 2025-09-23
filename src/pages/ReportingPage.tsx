import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { MapPin, Building2, Filter, ChevronDown, Globe, Search, Calendar as CalendarIcon, ChevronUp, ArrowUpDown, Download, ShoppingCart, Euro, TrendingUp, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import CompaniesMap from './CompaniesMap';
import CompanyDetailDialog from './CompanyDetailDialog';

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
    try {
      let allCompanies: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: companiesBatch, error: companiesError } = await supabase
          .from('companies')
          .select('id, sipi_number, company_name, latitude, longitude, address1, city, general_department, client_blocked_date, training_date, report_creation_date, last_order_date, quality')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .range(from, from + batchSize - 1);

        if (companiesError) {
          console.error('Error fetching companies:', companiesError);
          setError('Erreur lors du chargement des entreprises');
          return;
        }

        if (companiesBatch && companiesBatch.length > 0) {
          allCompanies = [...allCompanies, ...companiesBatch];
          from += batchSize;
          hasMore = companiesBatch.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      let allOrders: any[] = [];
      from = 0;
      hasMore = true;

      while (hasMore) {
        let query = supabase.from('orders').select('sipi_number, order_date, amount');
        
        if (startDate) { query = query.gte('order_date', startDate.toISOString().split('T')[0]); }
        if (endDate) { query = query.lte('order_date', endDate.toISOString().split('T')[0]); }

        const { data: ordersBatch, error: ordersError } = await query.range(from, from + batchSize - 1);

        if (ordersError) {
          console.error('Error fetching orders:', ordersError);
          setError('Erreur lors du chargement des commandes');
          return;
        }

        if (ordersBatch && ordersBatch.length > 0) {
          allOrders = [...allOrders, ...ordersBatch];
          from += batchSize;
          hasMore = ordersBatch.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      const orderStatsByCompany = new Map<string, Map<number, { totalOrders: number; totalAmount: number }>>();
      allOrders.forEach(order => {
        const year = new Date(order.order_date).getFullYear();
        if (!orderStatsByCompany.has(order.sipi_number)) { orderStatsByCompany.set(order.sipi_number, new Map()); }
        const companyStats = orderStatsByCompany.get(order.sipi_number)!;
        const yearStats = companyStats.get(year) || { totalOrders: 0, totalAmount: 0 };
        companyStats.set(year, { totalOrders: yearStats.totalOrders + 1, totalAmount: yearStats.totalAmount + (order.amount || 0) });
      });

      const companiesWithStats: Company[] = allCompanies.map(company => {
        const companyOrderStats = orderStatsByCompany.get(company.sipi_number);
        const orderStats: CompanyOrderStats[] = [];
        let totalAmount = 0;
        let totalYears = 0;
        
        if (companyOrderStats) {
          companyOrderStats.forEach((stats, year) => {
            orderStats.push({ year, totalOrders: stats.totalOrders, totalAmount: stats.totalAmount });
            totalAmount += stats.totalAmount;
            totalYears++;
          });
          orderStats.sort((a, b) => b.year - a.year);
        }
        
        const averageOrderPerYear = totalYears > 0 ? totalAmount / totalYears : 0;
        return { ...company, orderStats, averageOrderPerYear };
      });
      setCompanies(companiesWithStats);
    } catch (error) {
      console.error('Error:', error);
      setError('Erreur de connexion');
    }
  };
  
  const fetchTotalCompanies = async () => {
    try {
      const { count, error } = await supabase.from('companies').select('*', { count: 'exact', head: true });
      if (!error && count) { setTotalCompanies(count); }
    } catch (error) { console.error('Error fetching total companies:', error); }
  };

  const handleGeocodeCompanies = async () => {
    setGeocoding(true);
    try {
      toast({ title: "Géolocalisation démarrée", description: "Le processus s'exécute en arrière-plan.", });
      const { data, error } = await supabase.functions.invoke('geocode-companies');
      if (error) throw error;
      toast({ title: "✅ Processus lancé", description: data.message, });
      setTimeout(() => { fetchCompaniesData(); fetchTotalCompanies(); }, 10000);
    } catch (error) {
      console.error('Error geocoding companies:', error);
      toast({ title: "❌ Erreur", description: "Erreur lors du lancement de la géolocalisation", variant: "destructive" });
    } finally { setGeocoding(false); }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) { setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc'); } else { setSortColumn(column); setSortDirection('asc'); }
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commandes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderStats.reduce((sum, stat) => sum + stat.totalOrders, 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Toutes années confondues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'Affaires</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderStats.reduce((sum, stat) => sum + stat.totalAmount, 0).toLocaleString()} €</div>
            <p className="text-xs text-muted-foreground">
              Montant total des commandes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Années Actives</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderStats.length}</div>
            <p className="text-xs text-muted-foreground">
              Périodes avec commandes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Moyenne par Année</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orderStats.length > 0 ? Math.round(orderStats.reduce((sum, stat) => sum + stat.totalOrders, 0) / orderStats.length).toLocaleString() : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Commandes par an
            </p>
          </CardContent>
        </Card>
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
          <div className="flex flex-col gap-4">
            <h4 className="text-md font-medium">Période des commandes</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-2">Date de début</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : "Sélectionner une date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Date de fin</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : "Sélectionner une date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {(startDate || endDate) && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setStartDate(undefined); setEndDate(undefined); }}>
                  Effacer les dates
                </Button>
                <div className="text-sm text-muted-foreground flex items-center">
                  {startDate && endDate ? `Période: ${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}` : startDate ? `À partir du: ${format(startDate, "dd/MM/yyyy")}` : endDate ? `Jusqu'au: ${format(endDate, "dd/MM/yyyy")}` : ''}
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 mt-4">
            <div>
              <label className="text-sm font-medium">Numéro SIPI</label>
              <Input placeholder="Rechercher par SIPI..." value={sipiFilter} onChange={(e) => setSipiFilter(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Ville</label>
              <Input placeholder="Rechercher par ville..." value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Nom de l'entreprise</label>
              <Input placeholder="Rechercher par nom..." value={companyNameFilter} onChange={(e) => setCompanyNameFilter(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Moyenne min (€)</label>
              <Input type="number" placeholder="0" value={minAverageFilter} onChange={(e) => setMinAverageFilter(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Moyenne max (€)</label>
              <Input type="number" placeholder="1000000" value={maxAverageFilter} onChange={(e) => setMaxAverageFilter(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Formation</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {formationFilter === '' ? "Tout" : formationFilter === 'formee_payant' ? "Structure Formée (Uniquement payant)" : formationFilter === 'formee_mixte' ? "Structure Formée* (Payant comme gratuit)" : "Structure non formée"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0 bg-background border shadow-xl z-[9999]" align="start">
                  <div className="p-2 bg-background">
                    <div className="space-y-1">
                      <Button variant={formationFilter === '' ? 'default' : 'ghost'} className="w-full justify-start text-sm" onClick={() => setFormationFilter('')}>Tout</Button>
                      <Button variant={formationFilter === 'non_formee' ? 'default' : 'ghost'} className="w-full justify-start text-sm" onClick={() => setFormationFilter('non_formee')}>Structure non formée</Button>
                      <Button variant={formationFilter === 'formee_mixte' ? 'default' : 'ghost'} className="w-full justify-start text-sm" onClick={() => setFormationFilter('formee_mixte')}>Structure Formée* (Payant comme gratuit)</Button>
                      <Button variant={formationFilter === 'formee_payant' ? 'default' : 'ghost'} className="w-full justify-start text-sm" onClick={() => setFormationFilter('formee_payant')}>Structure Formée (Uniquement payant)</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium">Responsable BO</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {responsableBOFilter === '' ? "Tous les responsables BO" : responsableBOFilter}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0 bg-background border shadow-xl z-[9999]" align="start">
                  <div className="p-2 bg-background">
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      <Button variant={responsableBOFilter === '' ? 'default' : 'ghost'} className="w-full justify-start text-sm" onClick={() => setResponsableBOFilter('')}>Tous les responsables BO</Button>
                      {uniqueResponsablesBO.map((responsable) => (<Button key={responsable} variant={responsableBOFilter === responsable ? 'default' : 'ghost'} className="w-full justify-start text-sm" onClick={() => setResponsableBOFilter(responsable)}>{responsable}</Button>))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium">Formateur</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {formateurFilter === '' ? "Tous les formateurs" : formateurFilter}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0 bg-background border shadow-xl z-[9999]" align="start">
                  <div className="p-2 bg-background">
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      <Button variant={formateurFilter === '' ? 'default' : 'ghost'} className="w-full justify-start text-sm" onClick={() => setFormateurFilter('')}>Tous les formateurs</Button>
                      {uniqueFormateurs.map((formateur) => (<Button key={formateur} variant={formateurFilter === formateur ? 'default' : 'ghost'} className="w-full justify-start text-sm" onClick={() => setFormateurFilter(formateur)}>{formateur}</Button>))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {(sipiFilter || cityFilter || companyNameFilter || minAverageFilter || maxAverageFilter || formationFilter || responsableBOFilter || formateurFilter || clientTypeFilter !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => { setSipiFilter(''); setCityFilter(''); setCompanyNameFilter(''); setMinAverageFilter(''); setMaxAverageFilter(''); setFormationFilter(''); setResponsableBOFilter(''); setFormateurFilter(''); setClientTypeFilter('all'); }} className="w-full mt-2">
              Effacer tous les filtres
            </Button>
          )}
        </CardContent>
      </Card>

      {/* SECTION DES CARTES DE VISUALISATION (les deux colonnes) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CompaniesMap
          companies={filteredCompanies}
          totalCompanies={totalCompanies}
          geocoding={geocoding}
          onGeocodeCompanies={handleGeocodeCompanies}
        />
        <CompaniesMap
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
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px] cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('company_name')}>
                    <div className="flex items-center gap-2">Nom de l'entreprise{getSortIcon('company_name')}</div>
                  </TableHead>
                  <TableHead className="min-w-[120px] cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('sipi_number')}>
                    <div className="flex items-center gap-2">Numéro SIPI{getSortIcon('sipi_number')}</div>
                  </TableHead>
                  <TableHead className="min-w-[100px] cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('city')}>
                    <div className="flex items-center gap-2">Ville{getSortIcon('city')}</div>
                  </TableHead>
                  <TableHead className="min-w-[120px]">Client bloqué</TableHead>
                  <TableHead className="min-w-[150px]">Formation (Date de cmd SIPI)</TableHead>
                  <TableHead className="min-w-[180px]">Date approx Formation (rapport SIPI)</TableHead>
                  <TableHead className="min-w-[200px]">Formation</TableHead>
                  <TableHead className="min-w-[100px] cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('general_department')}>
                    <div className="flex items-center gap-2">Département{getSortIcon('general_department')}</div>
                  </TableHead>
                  <TableHead className="min-w-[120px] cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('averageOrderPerYear')}>
                    <div className="flex items-center gap-2">Moyenne/an (€){getSortIcon('averageOrderPerYear')}</div>
                  </TableHead>
                  {availableYears.map(year => (
                    <TableHead key={year} className="min-w-[150px] text-center cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort(`year_${year}`)}>
                      <div className="flex items-center justify-center gap-2">
                        <div>{year}<div className="text-xs text-muted-foreground font-normal">Détail par année</div></div>
                        {getSortIcon(`year_${year}`)}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => {
                  const yearDataMap = new Map(company.orderStats?.map(stat => [stat.year, stat]) || []);
                  return (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium cursor-pointer hover:text-primary hover:underline" onClick={() => handleCompanyClick(company)}>
                        {company.company_name}
                      </TableCell>
                      <TableCell>{company.sipi_number}</TableCell>
                      <TableCell>{company.city || "-"}</TableCell>
                      <TableCell>
                        {company.client_blocked_date && company.last_order_date && new Date(company.client_blocked_date) > new Date(company.last_order_date) ? (
                          <span className="text-destructive font-medium">Oui</span>
                        ) : (<span className="text-muted-foreground">Non</span>)}
                      </TableCell>
                      <TableCell>{company.training_date ? format(new Date(company.training_date), 'dd/MM/yyyy') : '-'}</TableCell>
                      <TableCell>{company.report_creation_date ? format(new Date(company.report_creation_date), 'dd/MM/yyyy') : '-'}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {company.training_date ? (
                            <span className="text-green-700 font-medium">Structure Formée (Uniquement payant)</span>
                          ) : company.report_creation_date ? (
                            <span className="text-blue-700 font-medium">Structure Formée* (Payant comme gratuit)</span>
                          ) : (
                            <span className="text-muted-foreground">Structure non formée</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{company.general_department || "-"}</TableCell>
                      <TableCell className="font-medium">
                        {company.averageOrderPerYear ? `${Math.round(company.averageOrderPerYear).toLocaleString()} €` : "-"}
                      </TableCell>
                      {availableYears.map(year => {
                        const yearData = yearDataMap.get(year);
                        return (
                          <TableCell key={year} className="text-center">
                            {yearData ? (<div className="space-y-1"><div className="font-medium text-primary">{yearData.totalOrders}</div><div className="text-sm text-muted-foreground">{yearData.totalAmount.toLocaleString()} €</div></div>) : (<span className="text-muted-foreground">-</span>)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <CompanyDetailDialog
        company={selectedCompany}
        open={companyDetailOpen}
        onOpenChange={setCompanyDetailOpen}
        departmentManagement={departmentManagement}
      />
    </div>
  );
};

export default ReportingPage;