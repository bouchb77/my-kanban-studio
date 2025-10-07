import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useOrderDetails } from '@/hooks/useOrderDetails';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package, AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface OrderDetailDialogProps {
  orderNumber: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const OrderDetailDialog: React.FC<OrderDetailDialogProps> = ({
  orderNumber,
  open,
  onOpenChange,
}) => {
  const { orderDetails, loading } = useOrderDetails(orderNumber || undefined);

  const totalArticles = orderDetails.reduce((sum, detail) => sum + detail.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto z-[100]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Détails de la commande {orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : orderDetails.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Aucun détail trouvé pour cette commande.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="bg-muted p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Articles différents</p>
                    <p className="text-2xl font-bold">{orderDetails.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total d'articles</p>
                    <p className="text-2xl font-bold">{totalArticles}</p>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code article</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderDetails.map((detail) => (
                      <TableRow key={detail.id}>
                        <TableCell className="font-medium">
                          {detail.article_code}
                        </TableCell>
                        <TableCell className="text-right">
                          {detail.quantity}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
