import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, MapPin, Calendar, Euro, Package, TrendingUp, Loader2, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { useCompanyTasks } from '@/hooks/useCompanyTasks';
import { useUserColumns } from '@/hooks/useUserSettings';

interface Company {
  id: string;
  sipi_number: string;
  company_name: string;
  latitude: number;
  longitude: number;
  address1?: string;
  address2?: string;
  city?: string;
  postal_code?: string;
  general_department?: string;
  last_order_date?: string;
  quality?: string;
  client_blocked_date?: string;
  training_date?: string;
  report_creation_date?: string;
}

interface Order {
  id: string;
  order_number: string;
  order_date: string;
  amount: number;
  status: string;
}

interface CompanyDetailDialogProps {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentManagement?: Record<string, any>;
}

const CompanyDetailDialog: React.FC<CompanyDetailDialogProps> = ({
  company,
  open,
  onOpenChange,
  departmentManagement = {},
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [orderStats, setOrderStats] = useState({
    totalOrders: 0,
    totalAmount: 0,
    averageAmount: 0,
    lastOrderDate: null as string | null,
  });

  // Hook pour récupérer les tâches liées à l'entreprise
  const { tasks: companyTasks, loading: tasksLoading } = useCompanyTasks(company?.company_name || null);
  const { columns } = useUserColumns();

  useEffect(() => {
    if (company && open) {
      fetchCompanyOrders();
    }
  }, [company, open]);

  const fetchCompanyOrders = async () => {
    if (!company) return;

    setLoading(true);
    try {
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('id, order_number, order_date, amount, status')
        .eq('sipi_number', company.sipi_number)
        .order('order_date', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        return;
      }

      setOrders(ordersData || []);

      // Calculate statistics
      const totalOrders = ordersData?.length || 0;
      const totalAmount = ordersData?.reduce((sum, order) => sum + (order.amount || 0), 0) || 0;
      const averageAmount = totalOrders > 0 ? totalAmount / totalOrders : 0;
      const lastOrderDate = ordersData?.[0]?.order_date || null;

      setOrderStats({
        totalOrders,
        totalAmount,
        averageAmount,
        lastOrderDate,
      });
    } catch (error) {
      console.error('Error fetching company orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour obtenir le libellé du statut depuis les colonnes utilisateur
  const getStatusLabel = (status: string) => {
    const column = columns.find(col => col.status === status);
    if (column) return column.title;
    
    // Fallback vers les statuts par défaut
    const defaultLabels: Record<string, string> = {
      'todo': 'À faire',
      'in-progress': 'En cours',
      'review': 'En révision',
      'done': 'Terminée'
    };
    return defaultLabels[status] || status;
  };

  // Fonction pour obtenir la couleur du badge selon le statut
  const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    if (status === 'done' || status.toLowerCase().includes('terminé')) return 'default';
    if (status === 'in-progress') return 'secondary';
    if (status === 'review') return 'outline';
    return 'secondary';
  };

  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Building2 className="w-6 h-6" />
            {company.company_name}
          </DialogTitle>
          <DialogDescription>
            Détail de l'entreprise et historique des commandes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informations générales */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{company.sipi_number}</Badge>
                  <span className="text-sm text-muted-foreground">Numéro SIPI</span>
                </div>
                
                {company.city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{company.city}</span>
                    {company.postal_code && (
                      <Badge variant="secondary">{company.postal_code}</Badge>
                    )}
                  </div>
                )}

                {company.general_department && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Département:</span>
                    <Badge variant="outline">{company.general_department}</Badge>
                  </div>
                )}

                {company.quality && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Qualité:</span>
                    <Badge variant="secondary">{company.quality}</Badge>
                  </div>
                )}
              </div>

              {(company.address1 || company.address2) && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-1">Adresse:</p>
                  <div className="text-sm text-muted-foreground">
                    {company.address1 && <div>{company.address1}</div>}
                    {company.address2 && <div>{company.address2}</div>}
                  </div>
                </div>
              )}

              {(company.last_order_date || company.training_date || company.client_blocked_date || company.report_creation_date) && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-2">Dates importantes:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {company.last_order_date && (
                      <div>
                        <span className="text-muted-foreground">Dernière commande:</span>
                        <div>{format(new Date(company.last_order_date), 'dd/MM/yyyy')}</div>
                      </div>
                    )}
                    {company.training_date && (
                      <div>
                        <span className="text-muted-foreground">Formation (Date de cmd SIPI):</span>
                        <div>{format(new Date(company.training_date), 'dd/MM/yyyy')}</div>
                      </div>
                    )}
                    {company.report_creation_date && (
                      <div>
                        <span className="text-muted-foreground">Date approx Formation (rapport SIPI):</span>
                        <div>{format(new Date(company.report_creation_date), 'dd/MM/yyyy')}</div>
                      </div>
                    )}
                    {company.client_blocked_date && (
                      <div>
                        <span className="text-muted-foreground">Client bloqué:</span>
                        <div className="text-destructive">{format(new Date(company.client_blocked_date), 'dd/MM/yyyy')}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status section */}
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-2">Status:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Client bloqué:</span>
                    <div>
                      {company.client_blocked_date && company.last_order_date && 
                       new Date(company.client_blocked_date) > new Date(company.last_order_date) ? (
                        <Badge variant="destructive">Oui</Badge>
                      ) : (
                        <Badge variant="secondary">Non</Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Formation:</span>
                    <div>
                      {company.training_date ? (
                        <Badge variant="default">Structure Formée (Uniquement payant)</Badge>
                      ) : company.report_creation_date ? (
                        <Badge variant="outline">Structure Formée* (Payant comme gratuit)</Badge>
                      ) : (
                        <Badge variant="secondary">Structure non formée</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Department management section */}
              {company.general_department && departmentManagement[company.general_department] && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-2">Équipe départementale:</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Responsable BO:</span>
                      <div className="font-medium">{departmentManagement[company.general_department].responsable_bo || '-'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CT:</span>
                      <div className="font-medium">{departmentManagement[company.general_department].ct || '-'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Formateur:</span>
                      <div className="font-medium">{departmentManagement[company.general_department].formateur || '-'}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statistiques des commandes */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Commandes</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderStats.totalOrders}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Montant Total</CardTitle>
                <Euro className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderStats.totalAmount.toLocaleString()} €</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Montant Moyen</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(orderStats.averageAmount).toLocaleString()} €</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Dernière Commande</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {orderStats.lastOrderDate 
                    ? format(new Date(orderStats.lastOrderDate), 'dd/MM/yyyy')
                    : 'Aucune'
                  }
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tâches liées à l'entreprise */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckSquare className="w-5 h-5" />
                Tâches liées à cette entreprise ({companyTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  <span>Chargement des tâches...</span>
                </div>
              ) : companyTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune tâche trouvée pour cette entreprise
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Titre</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Priorité</TableHead>
                        <TableHead>Échéance</TableHead>
                        <TableHead>Créée le</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">{task.title}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(task.status)}>
                              {getStatusLabel(task.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              task.priority === 'high' ? 'destructive' : 
                              task.priority === 'medium' ? 'default' : 'secondary'
                            }>
                              {task.priority === 'high' ? 'Haute' : 
                               task.priority === 'medium' ? 'Moyenne' : 'Basse'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {task.due_date ? format(new Date(task.due_date), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell>
                            {format(new Date(task.created_at), 'dd/MM/yyyy')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historique des commandes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Historique des commandes</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  <span>Chargement des commandes...</span>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune commande trouvée pour cette entreprise
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numéro de commande</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.order_number}</TableCell>
                          <TableCell>{format(new Date(order.order_date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="font-medium">{order.amount.toLocaleString()} €</TableCell>
                          <TableCell>
                            <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                              {order.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CompanyDetailDialog;