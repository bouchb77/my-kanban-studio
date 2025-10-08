import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Filter, ChevronDown, Search, CalendarIcon, ChevronUp, ArrowUpDown, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import CompanyDetailDialog from './CompanyDetailDialog';
import { useUserViewPreferences } from '@/hooks/useUserViewPreferences';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DragDropList } from './DragDropList';
import { Separator } from './ui/separator';

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
  averageAmountPerYear?: number;
  periodOrders?: number;
  periodAmount?: number;
}

interface CompanyOrderStats {
  year: number;
  totalOrders: number;
  totalAmount: number;
}

interface CompaniesTableOnlyProps {
  startDate?: Date;
  endDate?: Date;
  onDateChange?: {
    setStartDate: (date: Date | undefined) => void;
    setEndDate: (date: Date | undefined) => void;
  };
  onFilteredDataChange?: (companies: Company[]) => void;
}

const CompaniesTableOnly = ({ 
  startDate: externalStartDate,
  endDate: externalEndDate,
  onDateChange,
  onFilteredDataChange
}: CompaniesTableOnlyProps) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [totalCompanies, setTotalCompanies] = useState(0);
  
  // Company detail dialog state
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyDetailOpen, setCompanyDetailOpen] = useState(false);
  
  // Filtres
  const [sipiFilter, setSipiFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [companyNameFilter, setCompanyNameFilter] = useState('');
  const [minAverageFilter, setMinAverageFilter] = useState('');
  const [maxAverageFilter, setMaxAverageFilter] = useState('');
  const [formationFilter, setFormationFilter] = useState('');
  const [responsableBOFilter, setResponsableBOFilter] = useState('');
  const [formateurFilter, setFormateurFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [lisOnlyFilter, setLisOnlyFilter] = useState<'oui' | 'non' | ''>('');

  // Department management data
  const [departmentManagement, setDepartmentManagement] = useState<Record<string, any>>({});
  
  // LIS companies set
  const [lisCompanySipiNumbers, setLisCompanySipiNumbers] = useState<Set<string>>(new Set());
  
  // Article filter states
  const [availableArticles, setAvailableArticles] = useState<string[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [articleCompanyMap, setArticleCompanyMap] = useState<Map<string, Set<string>>>(new Map());
  
  // Date filters - use external ones if provided, otherwise local state
  const [localStartDate, setLocalStartDate] = useState<Date>();
  const [localEndDate, setLocalEndDate] = useState<Date>();
  
  const startDate = externalStartDate ?? localStartDate;
  const endDate = externalEndDate ?? localEndDate;
  
  const setStartDate = onDateChange?.setStartDate ?? setLocalStartDate;
  const setEndDate = onDateChange?.setEndDate ?? setLocalEndDate;
  
  // Sort state
  const [sortColumn, setSortColumn] = useState<string | null>('averageAmountPerYear');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const { toast } = useToast();

  // Column preferences - using 'table' for now, will create a reporting-specific view type later
  const { preferences, loading: preferencesLoading, toggleColumnVisibility, reorderColumns } = useUserViewPreferences('table');
  
  // Column manager state
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);

  // Load companies and order data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Load companies with pagination
        let allCompanies: any[] = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data: companiesData, error: companiesError } = await supabase
            .from('companies')
            .select('*')
            .range(from, from + batchSize - 1);

          if (companiesError) {
            console.error('Error loading companies:', companiesError);
            setError('Erreur lors du chargement des entreprises');
            return;
          }

          if (companiesData && companiesData.length > 0) {
            allCompanies = [...allCompanies, ...companiesData];
            from += batchSize;
            hasMore = companiesData.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        // Load orders with pagination
        let loadedOrders: any[] = [];
        from = 0;
        hasMore = true;

        while (hasMore) {
          const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select('sipi_number, amount, order_date')
            .range(from, from + batchSize - 1);

          if (ordersError) {
            console.error('Error loading orders:', ordersError);
            setError('Erreur lors du chargement des commandes');
            return;
          }

          if (ordersData && ordersData.length > 0) {
            loadedOrders = [...loadedOrders, ...ordersData];
            from += batchSize;
            hasMore = ordersData.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        setAllOrders(loadedOrders);

        // Group orders by SIPI number and year (for display)
        const ordersByCompany = new Map<string, Map<number, { totalOrders: number; totalAmount: number }>>();
        
        loadedOrders.forEach(order => {
          if (!order.sipi_number || !order.order_date) return;
          
          const year = new Date(order.order_date).getFullYear();
          if (isNaN(year)) return;
          
          if (!ordersByCompany.has(order.sipi_number)) {
            ordersByCompany.set(order.sipi_number, new Map());
          }
          
          const yearMap = ordersByCompany.get(order.sipi_number)!;
          if (!yearMap.has(year)) {
            yearMap.set(year, { totalOrders: 0, totalAmount: 0 });
          }
          
          const yearData = yearMap.get(year)!;
          yearData.totalOrders += 1;
          yearData.totalAmount += parseFloat(order.amount) || 0;
        });

        // Add order stats to companies
        const companiesWithStats = allCompanies.map(company => {
          const orderStats: CompanyOrderStats[] = [];
          const companyOrders = ordersByCompany.get(company.sipi_number);
          
          if (companyOrders) {
            companyOrders.forEach((data, year) => {
              orderStats.push({
                year,
                totalOrders: data.totalOrders,
                totalAmount: data.totalAmount
              });
            });
          }
          
          orderStats.sort((a, b) => a.year - b.year);
          
          const totalOrders = orderStats.reduce((sum, stat) => sum + stat.totalOrders, 0);
          const averageOrderPerYear = orderStats.length > 0 ? totalOrders / orderStats.length : 0;

          return {
            ...company,
            orderStats,
            averageOrderPerYear
          };
        });

        setCompanies(companiesWithStats);
        setTotalCompanies(companiesWithStats.length);

        // Load department management data
        const { data: deptData, error: deptError } = await supabase
          .from('department_management')
          .select('*');

        if (deptError) {
          console.error('Error loading department management:', deptError);
        } else if (deptData) {
          const deptMap: Record<string, any> = {};
          deptData.forEach(dept => {
            deptMap[dept.department_name] = dept;
          });
          setDepartmentManagement(deptMap);
        }

        // Load all article codes
        const { data: allArticlesData, error: articlesError } = await supabase
          .from('order_details')
          .select('article_code');

        if (!articlesError && allArticlesData) {
          const uniqueArticles = Array.from(new Set(allArticlesData.map(d => d.article_code).filter(Boolean)));
          setAvailableArticles(uniqueArticles.sort());

          // Build map of article -> sipi_numbers
          const { data: allOrderDetails, error: allOrderDetailsError } = await supabase
            .from('order_details')
            .select('order_number, article_code');

          if (!allOrderDetailsError && allOrderDetails) {
            const { data: allOrders, error: allOrdersError } = await supabase
              .from('orders')
              .select('order_number, sipi_number');

            if (!allOrdersError && allOrders) {
              const articleMap = new Map<string, Set<string>>();
              
              allOrderDetails.forEach(detail => {
                const order = allOrders.find(o => o.order_number === detail.order_number);
                if (order && order.sipi_number && detail.article_code) {
                  if (!articleMap.has(detail.article_code)) {
                    articleMap.set(detail.article_code, new Set());
                  }
                  articleMap.get(detail.article_code)!.add(order.sipi_number);
                }
              });
              
              setArticleCompanyMap(articleMap);
            }
          }
        }

        // Load companies that order ONLY "LIS" article (and nothing else)
        const { data: lisOrderDetails, error: lisError } = await supabase
          .from('order_details')
          .select('order_number')
          .eq('article_code', 'LIS');

        if (!lisError && lisOrderDetails) {
          const lisOrderNumbers = new Set(lisOrderDetails.map(d => d.order_number));
          
          // Get orders with these order numbers to find sipi_numbers
          const { data: lisOrders, error: lisOrdersError } = await supabase
            .from('orders')
            .select('sipi_number')
            .in('order_number', Array.from(lisOrderNumbers));

          if (!lisOrdersError && lisOrders) {
            const potentialLisSipiNumbers = new Set(lisOrders.map(o => o.sipi_number).filter(Boolean));
            
            // Now check for each sipi_number if they have ordered OTHER articles than LIS
            const { data: allOrders, error: allOrdersError } = await supabase
              .from('orders')
              .select('order_number, sipi_number')
              .in('sipi_number', Array.from(potentialLisSipiNumbers));
            
            if (!allOrdersError && allOrders) {
              const allOrderNumbers = allOrders.map(o => o.order_number);
              
              // Get all order details for these companies
              const { data: allDetails, error: allDetailsError } = await supabase
                .from('order_details')
                .select('order_number, article_code')
                .in('order_number', allOrderNumbers);
              
              if (!allDetailsError && allDetails) {
                // Group details by sipi_number
                const sipiArticles = new Map<string, Set<string>>();
                
                allDetails.forEach(detail => {
                  const order = allOrders.find(o => o.order_number === detail.order_number);
                  if (order && order.sipi_number) {
                    if (!sipiArticles.has(order.sipi_number)) {
                      sipiArticles.set(order.sipi_number, new Set());
                    }
                    sipiArticles.get(order.sipi_number)!.add(detail.article_code);
                  }
                });
                
                // Keep only sipi_numbers that have ONLY ordered LIS
                const lisOnlySipiNumbers = new Set<string>();
                sipiArticles.forEach((articles, sipiNumber) => {
                  if (articles.size === 1 && articles.has('LIS')) {
                    lisOnlySipiNumbers.add(sipiNumber);
                  }
                });
                
                setLisCompanySipiNumbers(lisOnlySipiNumbers);
              }
            }
          }
        }
        
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter companies based on all criteria INCLUDING date range
  const filteredCompanies = useMemo(() => {
    return companies.filter(company => {
      // SIPI filter
      if (sipiFilter && !company.sipi_number?.toLowerCase().includes(sipiFilter.toLowerCase())) {
        return false;
      }
      
      // City filter
      if (cityFilter && !company.city?.toLowerCase().includes(cityFilter.toLowerCase())) {
        return false;
      }
      
      // Company name filter
      if (companyNameFilter && !company.company_name?.toLowerCase().includes(companyNameFilter.toLowerCase())) {
        return false;
      }
      
      // Department filter
      if (selectedDepartments.length > 0 && !selectedDepartments.includes(company.general_department || '')) {
        return false;
      }

      // Formateur filter
      if (formateurFilter && company.general_department) {
        const deptData = departmentManagement[company.general_department];
        if (!deptData || deptData.formateur !== formateurFilter) {
          return false;
        }
      }

      // Responsable BO filter
      if (responsableBOFilter && company.general_department) {
        const deptData = departmentManagement[company.general_department];
        if (!deptData || deptData.responsable_bo !== responsableBOFilter) {
          return false;
        }
      }

      // Quality filter
      if (qualityFilter) {
        const displayQuality = company.quality === 'Industrie' ? 'Client' : company.quality === 'Distributeur' ? 'Revendeur' : company.quality;
        if (displayQuality !== qualityFilter) {
          return false;
        }
      }

      // LIS Only filter
      if (lisOnlyFilter === 'oui') {
        if (!lisCompanySipiNumbers.has(company.sipi_number)) {
          return false;
        }
      } else if (lisOnlyFilter === 'non') {
        if (lisCompanySipiNumbers.has(company.sipi_number)) {
          return false;
        }
      }

      // Filter by selected articles (company must have ordered at least one of the selected articles)
      if (selectedArticles.length > 0) {
        const hasSelectedArticle = selectedArticles.some(article => {
          const companiesForArticle = articleCompanyMap.get(article);
          return companiesForArticle?.has(company.sipi_number);
        });
        if (!hasSelectedArticle) {
          return false;
        }
      }

      // Formation filter
      if (formationFilter) {
        const formationStatus = company.training_date 
          ? 'Structure Formée (Uniquement payant)' 
          : company.report_creation_date 
          ? 'Structure Formée* (Payant comme gratuit)' 
          : 'Structure non formée';
        
        if (formationStatus !== formationFilter) {
          return false;
        }
      }
      
      // Date range filter - filter based on actual order dates
      let filteredOrders = allOrders.filter(order => order.sipi_number === company.sipi_number);
      
      if (startDate || endDate) {
        filteredOrders = filteredOrders.filter(order => {
          if (!order.order_date) return false;
          const orderDate = new Date(order.order_date);
          
          if (startDate && orderDate < startDate) return false;
          if (endDate && orderDate > endDate) return false;
          
          return true;
        });
        
        // If no orders in range, filter out this company
        if (filteredOrders.length === 0) return false;
      }
      
      // Calculate period totals and average based on filtered orders
      const periodOrders = filteredOrders.length;
      const periodAmount = filteredOrders.reduce((sum, order) => sum + (parseFloat(order.amount) || 0), 0);
      
      // Calculate date range in years for averaging
      let periodYears = 1;
      if (startDate && endDate) {
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        periodYears = Math.max(diffDays / 365.25, 0.1); // Minimum 0.1 year to avoid division issues
      } else if (startDate || endDate) {
        // If only one date is set, calculate from/to first/last order
        const orderDates = filteredOrders.map(o => new Date(o.order_date)).sort((a, b) => a.getTime() - b.getTime());
        if (orderDates.length > 0) {
          const firstDate = startDate || orderDates[0];
          const lastDate = endDate || orderDates[orderDates.length - 1];
          const diffTime = Math.abs(lastDate.getTime() - firstDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          periodYears = Math.max(diffDays / 365.25, 0.1);
        }
      } else {
        // No date filter - use all years span
        const years = company.orderStats?.map(s => s.year) || [];
        periodYears = years.length > 0 ? Math.max(...years) - Math.min(...years) + 1 : 1;
      }
      
      const averageOrderPerYear = periodOrders / periodYears;
      const averageAmountPerYear = periodAmount / periodYears;
      
      // Store these for display
      company.periodOrders = periodOrders;
      company.periodAmount = periodAmount;
      company.averageOrderPerYear = averageOrderPerYear;
      company.averageAmountPerYear = averageAmountPerYear;
      
      // Average order filter (based on amount)
      if (minAverageFilter || maxAverageFilter) {
        const avg = averageAmountPerYear;
        if (minAverageFilter && avg < parseFloat(minAverageFilter)) return false;
        if (maxAverageFilter && avg > parseFloat(maxAverageFilter)) return false;
      }
      
      return true;
    });
  }, [companies, allOrders, sipiFilter, cityFilter, companyNameFilter, minAverageFilter, maxAverageFilter, selectedDepartments, formateurFilter, responsableBOFilter, qualityFilter, formationFilter, departmentManagement, startDate, endDate, lisOnlyFilter, lisCompanySipiNumbers]);

  // Get unique departments for filter
  const uniqueDepartments = useMemo(() => {
    const depts = new Set(companies.map(c => c.general_department).filter(Boolean));
    return Array.from(depts).sort();
  }, [companies]);

  // Get unique formateurs from department management
  const uniqueFormateurs = useMemo(() => {
    const formateurs = new Set<string>();
    Object.values(departmentManagement).forEach((dept: any) => {
      if (dept.formateur) formateurs.add(dept.formateur);
    });
    return Array.from(formateurs).sort();
  }, [departmentManagement]);

  // Get unique responsables BO from department management
  const uniqueResponsablesBO = useMemo(() => {
    const responsables = new Set<string>();
    Object.values(departmentManagement).forEach((dept: any) => {
      if (dept.responsable_bo) responsables.add(dept.responsable_bo);
    });
    return Array.from(responsables).sort();
  }, [departmentManagement]);

  // Get unique quality values (mapped to display names)
  const uniqueQualityValues = useMemo(() => {
    const qualities = new Set<string>();
    companies.forEach(company => {
      if (company.quality) {
        const displayQuality = company.quality === 'Industrie' ? 'Client' : company.quality === 'Distributeur' ? 'Revendeur' : company.quality;
        qualities.add(displayQuality);
      }
    });
    return Array.from(qualities).sort();
  }, [companies]);

  // Formation options
  const formationOptions = [
    'Structure non formée',
    'Structure Formée* (Payant comme gratuit)',
    'Structure Formée (Uniquement payant)'
  ];

  // Get available years from order data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    companies.forEach(company => {
      company.orderStats?.forEach(stat => {
        years.add(stat.year);
      });
    });
    return Array.from(years).sort();
  }, [companies]);

  // Notify parent of filtered data changes
  useEffect(() => {
    if (onFilteredDataChange) {
      onFilteredDataChange(filteredCompanies);
    }
  }, [filteredCompanies, onFilteredDataChange]);

  // Sort companies
  const sortedCompanies = useMemo(() => {
    if (!sortColumn) return filteredCompanies;
    
    return [...filteredCompanies].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortColumn) {
        case 'sipi_number':
          aValue = a.sipi_number || '';
          bValue = b.sipi_number || '';
          break;
        case 'company_name':
          aValue = a.company_name || '';
          bValue = b.company_name || '';
          break;
        case 'city':
          aValue = a.city || '';
          bValue = b.city || '';
          break;
        case 'general_department':
          aValue = a.general_department || '';
          bValue = b.general_department || '';
          break;
        case 'averageOrderPerYear':
          aValue = a.averageOrderPerYear || 0;
          bValue = b.averageOrderPerYear || 0;
          break;
        case 'averageAmountPerYear':
          aValue = a.averageAmountPerYear || 0;
          bValue = b.averageAmountPerYear || 0;
          break;
        case 'periodAmount':
          aValue = a.periodAmount || 0;
          bValue = b.periodAmount || 0;
          break;
        case 'quality':
          aValue = a.quality === 'Industrie' ? 'Client' : a.quality === 'Distributeur' ? 'Revendeur' : a.quality || '';
          bValue = b.quality === 'Industrie' ? 'Client' : b.quality === 'Distributeur' ? 'Revendeur' : b.quality || '';
          break;
        case 'formation':
          aValue = a.training_date ? 2 : a.report_creation_date ? 1 : 0;
          bValue = b.training_date ? 2 : b.report_creation_date ? 1 : 0;
          break;
        case 'training_date':
          aValue = a.training_date ? new Date(a.training_date).getTime() : 0;
          bValue = b.training_date ? new Date(b.training_date).getTime() : 0;
          break;
        case 'report_creation_date':
          aValue = a.report_creation_date ? new Date(a.report_creation_date).getTime() : 0;
          bValue = b.report_creation_date ? new Date(b.report_creation_date).getTime() : 0;
          break;
        default:
          return 0;
      }
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredCompanies, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Define all available columns - MUST BE BEFORE EARLY RETURNS
  const allColumns = useMemo(() => {
    const columns = [
      { id: 'sipi_number', label: 'SIPI', type: 'system' as const, order: 0 },
      { id: 'company_name', label: 'Entreprise', type: 'system' as const, order: 1 },
      { id: 'city', label: 'Ville', type: 'system' as const, order: 2 },
      { id: 'general_department', label: 'Département', type: 'system' as const, order: 3 },
      { id: 'quality', label: 'Type', type: 'system' as const, order: 4 },
      { id: 'formation', label: 'Formation', type: 'system' as const, order: 5 },
      { id: 'training_date', label: 'Formation (Date de cmd SIPI)', type: 'system' as const, order: 6 },
      { id: 'report_creation_date', label: 'Date approx Formation (Rapport SIPI)', type: 'system' as const, order: 7 },
      { id: 'averageAmountPerYear', label: 'Moyenne/An', type: 'system' as const, order: 8 },
    ];
    
    let nextOrder = 9;
    if (startDate || endDate) {
      columns.push({ id: 'periodAmount', label: 'Période filtrée', type: 'system' as const, order: nextOrder++ });
    }
    
    availableYears.forEach(year => {
      columns.push({ id: `year_${year}`, label: String(year), type: 'system' as const, order: nextOrder++ });
    });
    
    return columns;
  }, [startDate, endDate, availableYears]);

  // Get visible columns based on preferences
  const visibleColumns = useMemo(() => {
    if (!preferences?.visible_columns || preferences.visible_columns.length === 0) {
      return allColumns.map(col => col.id);
    }
    // Filter out columns that no longer exist and ensure all year columns are included
    const yearColumns = allColumns.filter(col => col.id.startsWith('year_')).map(col => col.id);
    const visibleWithYears = [...preferences.visible_columns.filter(id => 
      !id.startsWith('year_') && allColumns.some(col => col.id === id)
    ), ...yearColumns];
    return visibleWithYears;
  }, [preferences, allColumns]);

  // Get column order based on preferences
  const orderedColumns = useMemo(() => {
    if (!preferences?.column_order || preferences.column_order.length === 0) {
      return allColumns.filter(col => visibleColumns.includes(col.id));
    }
    
    const ordered: typeof allColumns = [];
    preferences.column_order.forEach(id => {
      if (visibleColumns.includes(id) && !id.startsWith('year_')) {
        const col = allColumns.find(col => col.id === id);
        if (col) ordered.push(col);
      }
    });
    
    // Add year columns at the end
    const yearCols = allColumns.filter(col => col.id.startsWith('year_') && visibleColumns.includes(col.id));
    return [...ordered, ...yearCols];
  }, [preferences, allColumns, visibleColumns]);

  // Get visible column objects for DragDropList - include ALL visible non-year columns
  const visibleColumnObjects = useMemo(() => {
    const nonYearColumns = allColumns.filter(col => !col.id.startsWith('year_'));
    const visibleNonYear = nonYearColumns.filter(col => visibleColumns.includes(col.id));
    
    // Order them according to orderedColumns if available
    if (preferences?.column_order && preferences.column_order.length > 0) {
      const ordered: typeof allColumns = [];
      preferences.column_order.forEach(id => {
        const col = visibleNonYear.find(c => c.id === id);
        if (col) ordered.push(col);
      });
      // Add any visible columns not in the order list
      visibleNonYear.forEach(col => {
        if (!ordered.find(c => c.id === col.id)) {
          ordered.push(col);
        }
      });
      return ordered;
    }
    
    return visibleNonYear;
  }, [allColumns, visibleColumns, preferences]);

  const handleToggleColumn = async (columnId: string) => {
    await toggleColumnVisibility(columnId);
  };

  const handleReorderColumns = async (reorderedItems: typeof allColumns) => {
    const newOrder = reorderedItems.map(item => item.id);
    await reorderColumns(newOrder);
  };

  // Early returns after all hooks are called
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Chargement des données...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-4">
        {/* Date filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Date de début des commandes:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yyyy") : "Sélectionner"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Date de fin des commandes:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd/MM/yyyy") : "Sélectionner"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Search filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">SIPI</label>
            <Input
              placeholder="Rechercher SIPI..."
              value={sipiFilter}
              onChange={(e) => setSipiFilter(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Ville</label>
            <Input
              placeholder="Rechercher ville..."
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Entreprise</label>
            <Input
              placeholder="Nom d'entreprise..."
              value={companyNameFilter}
              onChange={(e) => setCompanyNameFilter(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Montant Min (€)</label>
            <Input
              type="number"
              placeholder="Montant/an min"
              value={minAverageFilter}
              onChange={(e) => setMinAverageFilter(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Montant Max (€)</label>
            <Input
              type="number"
              placeholder="Montant/an max"
              value={maxAverageFilter}
              onChange={(e) => setMaxAverageFilter(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* Formateur and Formation filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Formateur</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">
                    {formateurFilter || "Sélectionner un formateur"}
                  </span>
                  <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-background z-50">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm"
                    onClick={() => setFormateurFilter('')}
                  >
                    Tous les formateurs
                  </Button>
                  {uniqueFormateurs.map((formateur) => (
                    <Button
                      key={formateur}
                      variant={formateurFilter === formateur ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      onClick={() => setFormateurFilter(formateur)}
                    >
                      {formateur}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Formation</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">
                    {formationFilter || "Tous les statuts"}
                  </span>
                  <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-background z-50">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm"
                    onClick={() => setFormationFilter('')}
                  >
                    Tous les statuts
                  </Button>
                  {formationOptions.map((option) => (
                    <Button
                      key={option}
                      variant={formationFilter === option ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      onClick={() => setFormationFilter(option)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Responsable BO and Quality filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Responsable BO</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">
                    {responsableBOFilter || "Sélectionner un responsable BO"}
                  </span>
                  <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-background z-50">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm"
                    onClick={() => setResponsableBOFilter('')}
                  >
                    Tous les responsables BO
                  </Button>
                  {uniqueResponsablesBO.map((responsable) => (
                    <Button
                      key={responsable}
                      variant={responsableBOFilter === responsable ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      onClick={() => setResponsableBOFilter(responsable)}
                    >
                      {responsable}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Type de client</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">
                    {qualityFilter || "Tous les types"}
                  </span>
                  <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-background z-50">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm"
                    onClick={() => setQualityFilter('')}
                  >
                    Tous les types
                  </Button>
                  {uniqueQualityValues.map((quality) => (
                    <Button
                      key={quality}
                      variant={qualityFilter === quality ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      onClick={() => setQualityFilter(quality)}
                    >
                      {quality}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* LIS Only filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">LIS Only</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="truncate">
                  {lisOnlyFilter === 'oui' ? 'Oui' : lisOnlyFilter === 'non' ? 'Non' : 'Tous'}
                </span>
                <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 bg-background z-50">
              <div className="space-y-2">
                <Button
                  variant={lisOnlyFilter === '' ? "secondary" : "ghost"}
                  className="w-full justify-start text-sm"
                  onClick={() => setLisOnlyFilter('')}
                >
                  Tous
                </Button>
                <Button
                  variant={lisOnlyFilter === 'oui' ? "secondary" : "ghost"}
                  className="w-full justify-start text-sm"
                  onClick={() => setLisOnlyFilter('oui')}
                >
                  Oui
                </Button>
                <Button
                  variant={lisOnlyFilter === 'non' ? "secondary" : "ghost"}
                  className="w-full justify-start text-sm"
                  onClick={() => setLisOnlyFilter('non')}
                >
                  Non
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Article filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Produits commandés</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="truncate">
                  {selectedArticles.length > 0 
                    ? `${selectedArticles.length} produit${selectedArticles.length > 1 ? 's' : ''} sélectionné${selectedArticles.length > 1 ? 's' : ''}` 
                    : 'Tous les produits'}
                </span>
                <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-background z-50">
              <div className="space-y-2">
                {selectedArticles.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setSelectedArticles([])}
                  >
                    Effacer la sélection
                  </Button>
                )}
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {availableArticles.map((article) => (
                    <div key={article} className="flex items-center space-x-2">
                      <Checkbox
                        id={`article-${article}`}
                        checked={selectedArticles.includes(article)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedArticles([...selectedArticles, article]);
                          } else {
                            setSelectedArticles(selectedArticles.filter(a => a !== article));
                          }
                        }}
                      />
                      <label htmlFor={`article-${article}`} className="text-sm cursor-pointer flex-1">
                        {article}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Department filter */}
        <div className="flex items-center space-x-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-between">
                <Filter className="w-4 h-4 mr-2" />
                Départements ({selectedDepartments.length})
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {uniqueDepartments.map((dept) => (
                  <div key={dept} className="flex items-center space-x-2">
                    <Checkbox
                      id={dept}
                      checked={selectedDepartments.includes(dept)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedDepartments([...selectedDepartments, dept]);
                        } else {
                          setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
                        }
                      }}
                    />
                    <label htmlFor={dept} className="text-sm cursor-pointer">
                      {dept}
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            onClick={() => {
              setSipiFilter('');
              setCityFilter('');
              setCompanyNameFilter('');
              setMinAverageFilter('');
              setMaxAverageFilter('');
              setSelectedDepartments([]);
              setFormateurFilter('');
              setResponsableBOFilter('');
              setQualityFilter('');
              setFormationFilter('');
              setStartDate(undefined);
              setEndDate(undefined);
            }}
          >
            Effacer les filtres
          </Button>

          <Sheet open={columnManagerOpen} onOpenChange={setColumnManagerOpen}>
            <SheetTrigger asChild>
              <Button variant="outline">
                <Settings2 className="mr-2 h-4 w-4" />
                Colonnes
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle>Personnaliser les colonnes</SheetTitle>
                <SheetDescription>
                  Choisissez les colonnes à afficher et réorganisez-les par glisser-déposer.
                </SheetDescription>
              </SheetHeader>
              
              <div className="space-y-6 mt-6">
                {/* Toggle columns */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Colonnes disponibles</h3>
                  <div className="space-y-2">
                    {allColumns.filter(col => !col.id.startsWith('year_')).map((column) => (
                      <div key={column.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={column.id}
                          checked={visibleColumns.includes(column.id)}
                          onCheckedChange={() => handleToggleColumn(column.id)}
                        />
                        <label
                          htmlFor={column.id}
                          className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {column.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Reorder columns */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Ordre des colonnes</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Faites glisser les colonnes pour les réorganiser
                  </p>
                  <DragDropList
                    items={visibleColumnObjects}
                    onReorder={handleReorderColumns}
                    renderItem={(column) => (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{column.label}</span>
                      </div>
                    )}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Results summary */}
      <div className="text-sm text-muted-foreground">
        {sortedCompanies.length} entreprise{sortedCompanies.length !== 1 ? 's' : ''} trouvée{sortedCompanies.length !== 1 ? 's' : ''} sur {totalCompanies}
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {orderedColumns.map((column) => {
                  if (!column) return null;
                  
                  const getSortIcon = (colId: string) => {
                    if (sortColumn === colId) {
                      return sortDirection === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />;
                    }
                    return <ArrowUpDown className="ml-2 h-4 w-4" />;
                  };

                  // Year columns - not sortable
                  if (column.id.startsWith('year_')) {
                    return (
                      <TableHead key={column.id} className="text-center min-w-[100px]">
                        {column.label}
                      </TableHead>
                    );
                  }

                  // Period column - special styling
                  if (column.id === 'periodAmount') {
                    return (
                      <TableHead key={column.id} className="text-center min-w-[120px] bg-primary/5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 p-0 font-semibold"
                          onClick={() => handleSort(column.id)}
                        >
                          {column.label}
                          {getSortIcon(column.id)}
                        </Button>
                      </TableHead>
                    );
                  }

                  // Regular columns
                  return (
                    <TableHead 
                      key={column.id} 
                      className={cn(
                        column.id === 'sipi_number' && 'w-[120px]',
                        ['quality', 'formation', 'training_date', 'report_creation_date', 'averageAmountPerYear'].includes(column.id) && 'text-center'
                      )}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 p-0 font-semibold"
                        onClick={() => handleSort(column.id)}
                      >
                        {column.label}
                        {getSortIcon(column.id)}
                      </Button>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCompanies.map((company) => {
                const yearDataMap = new Map<number, CompanyOrderStats>();
                company.orderStats?.forEach(stat => {
                  yearDataMap.set(stat.year, stat);
                });

                const renderCell = (columnId: string) => {
                  // Year columns
                  if (columnId.startsWith('year_')) {
                    const year = parseInt(columnId.replace('year_', ''));
                    const yearData = yearDataMap.get(year);
                    return (
                      <TableCell key={columnId} className="text-center">
                        {yearData ? (
                          <div className="space-y-1">
                            <div className="font-medium text-primary">
                              {yearData.totalOrders}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {yearData.totalAmount.toLocaleString()} €
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    );
                  }

                  // Regular columns
                  switch (columnId) {
                    case 'sipi_number':
                      return <TableCell key={columnId} className="font-medium">{company.sipi_number}</TableCell>;
                    case 'company_name':
                      return <TableCell key={columnId} className="max-w-[200px] truncate">{company.company_name}</TableCell>;
                    case 'city':
                      return <TableCell key={columnId}>{company.city || '-'}</TableCell>;
                    case 'general_department':
                      return <TableCell key={columnId}>{company.general_department || '-'}</TableCell>;
                    case 'quality':
                      return (
                        <TableCell key={columnId} className="text-center text-sm">
                          {company.quality === 'Industrie' ? 'Client' : company.quality === 'Distributeur' ? 'Revendeur' : company.quality || '-'}
                        </TableCell>
                      );
                    case 'formation':
                      return (
                        <TableCell key={columnId} className="text-center text-sm">
                          {company.training_date 
                            ? 'Formée (payant)' 
                            : company.report_creation_date 
                            ? 'Formée* (P+G)' 
                            : 'Non formée'}
                        </TableCell>
                      );
                    case 'training_date':
                      return (
                        <TableCell key={columnId} className="text-center text-sm">
                          {company.training_date ? format(new Date(company.training_date), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                      );
                    case 'report_creation_date':
                      return (
                        <TableCell key={columnId} className="text-center text-sm">
                          {company.report_creation_date ? format(new Date(company.report_creation_date), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                      );
                    case 'averageAmountPerYear':
                      return (
                        <TableCell key={columnId} className="text-center">
                          {company.averageAmountPerYear ? (
                            <div className="space-y-1">
                              <div className="font-medium text-primary">
                                {Math.round(company.averageOrderPerYear || 0)} cmd
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {Math.round(company.averageAmountPerYear).toLocaleString()} €
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      );
                    case 'periodAmount':
                      return (
                        <TableCell key={columnId} className="text-center bg-primary/5">
                          {company.periodOrders ? (
                            <div className="space-y-1">
                              <div className="font-bold text-primary">
                                {company.periodOrders} cmd
                              </div>
                              <div className="text-sm font-semibold">
                                {Math.round(company.periodAmount || 0).toLocaleString()} €
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      );
                    default:
                      return null;
                  }
                };

                return (
                  <TableRow 
                    key={company.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedCompany(company);
                      setCompanyDetailOpen(true);
                    }}
                  >
                    {orderedColumns.map((column) => column && renderCell(column.id))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Company Detail Dialog */}
      <CompanyDetailDialog
        company={selectedCompany}
        open={companyDetailOpen}
        onOpenChange={setCompanyDetailOpen}
        departmentManagement={departmentManagement}
      />
    </div>
  );
};

export default CompaniesTableOnly;