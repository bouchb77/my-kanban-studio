import { supabase } from '@/integrations/supabase/client';

export interface Company {
  id: string;
  companyName: string;
  sipiNumber: string;
  address1?: string;
  address2?: string;
  city?: string;
  postalCode?: string;
  generalDepartment?: string;
  latitude?: number;
  longitude?: number;
  quality?: string;
  geocodedAddress?: string;
  geocodingDate?: Date;
  trainingDate?: Date;
  clientBlockedDate?: Date;
  lastOrderDate?: Date;
  reportCreationDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

class EncryptedCompaniesService {
  private async callEncryptedFunction(method: string, body?: any) {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.functions.invoke('encrypted-companies', {
      body: {
        method,
        body
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      throw new Error(`Function error: ${error.message}`);
    }

    if (data?.error) {
      throw new Error(`Service error: ${data.error}`);
    }

    return data;
  }

  async getCompanyBySipi(sipiNumber: string): Promise<Company | null> {
    const response = await this.callEncryptedFunction('SELECT_BY_SIPI', { sipi_number: sipiNumber });
    if (!response.data) return null;
    return this.mapDbCompany(response.data);
  }

  async getAllCompanies(): Promise<Company[]> {
    const response = await this.callEncryptedFunction('SELECT');
    const companies = response.data || [];
    return companies.map((c: any) => this.mapDbCompany(c));
  }

  async getCompaniesByArticles(articleCodes: string[] | null, lisOnly: boolean): Promise<Company[]> {
    const response = await this.callEncryptedFunction('SELECT_BY_ARTICLES', { 
      article_codes: articleCodes,
      lis_only: lisOnly 
    });
    const companies = response.data || [];
    return companies.map((c: any) => this.mapDbCompany(c));
  }

  async createCompany(companyData: Partial<Company>): Promise<Company> {
    const response = await this.callEncryptedFunction('INSERT', { companyData });
    return response.data;
  }

  async updateCompany(companyId: string, updates: Partial<Company>): Promise<Company> {
    const response = await this.callEncryptedFunction('UPDATE', { companyId, updates });
    return response.data;
  }

  async deleteCompany(companyId: string): Promise<void> {
    await this.callEncryptedFunction('DELETE', { companyId });
  }

  async bulkUpsertCompanies(companies: Partial<Company>[]): Promise<void> {
    await this.callEncryptedFunction('BULK_UPSERT', { companies });
  }

  // Map database company to frontend Company type
  mapDbCompany(row: any): Company {
    return {
      id: String(row.id),
      companyName: row.company_name,
      sipiNumber: row.sipi_number,
      address1: row.address1 || undefined,
      address2: row.address2 || undefined,
      city: row.city || undefined,
      postalCode: row.postal_code || undefined,
      generalDepartment: row.general_department || undefined,
      latitude: row.latitude ? Number(row.latitude) : undefined,
      longitude: row.longitude ? Number(row.longitude) : undefined,
      quality: row.quality || undefined,
      geocodedAddress: row.geocoded_address || undefined,
      geocodingDate: row.geocoding_date ? new Date(row.geocoding_date) : undefined,
      trainingDate: row.training_date ? new Date(row.training_date) : undefined,
      clientBlockedDate: row.client_blocked_date ? new Date(row.client_blocked_date) : undefined,
      lastOrderDate: row.last_order_date ? new Date(row.last_order_date) : undefined,
      reportCreationDate: row.report_creation_date ? new Date(row.report_creation_date) : undefined,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  // Convert frontend Company to database format
  companyToDbFormat(company: Partial<Company>): any {
    return {
      company_name: company.companyName,
      sipi_number: company.sipiNumber,
      address1: company.address1,
      address2: company.address2,
      city: company.city,
      postal_code: company.postalCode,
      general_department: company.generalDepartment,
      latitude: company.latitude,
      longitude: company.longitude,
      quality: company.quality,
      geocoded_address: company.geocodedAddress,
      geocoding_date: company.geocodingDate?.toISOString(),
      training_date: company.trainingDate?.toISOString()?.split('T')[0],
      client_blocked_date: company.clientBlockedDate?.toISOString()?.split('T')[0],
      last_order_date: company.lastOrderDate?.toISOString()?.split('T')[0],
      report_creation_date: company.reportCreationDate?.toISOString()?.split('T')[0],
    };
  }
}

export const encryptedCompaniesService = new EncryptedCompaniesService();
