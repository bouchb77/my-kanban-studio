import { supabase } from '@/integrations/supabase/client';

export interface Contact {
  id: string;
  sipi_number: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

class EncryptedContactsService {
  private async callEncryptedFunction(method: string, body?: any) {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.functions.invoke('encrypted-contacts', {
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

  async getAllContacts(): Promise<Contact[]> {
    const response = await this.callEncryptedFunction('SELECT');
    const contacts = response.data || [];
    return contacts.map((c: any) => this.mapDbContact(c));
  }

  async getContactsBySipiNumbers(sipiNumbers: string[]): Promise<Contact[]> {
    const response = await this.callEncryptedFunction('SELECT', { sipi_numbers: sipiNumbers });
    const contacts = response.data || [];
    return contacts.map((c: any) => this.mapDbContact(c));
  }

  async createContact(contactData: Partial<Contact>): Promise<Contact> {
    const response = await this.callEncryptedFunction('INSERT', { contactData });
    return response.data;
  }

  async updateContact(contactId: string, updates: Partial<Contact>): Promise<Contact> {
    const response = await this.callEncryptedFunction('UPDATE', { contactId, updates });
    return response.data;
  }

  async deleteContact(contactId: string): Promise<void> {
    await this.callEncryptedFunction('DELETE', { contactId });
  }

  async bulkUpsertContacts(contacts: Partial<Contact>[]): Promise<void> {
    await this.callEncryptedFunction('BULK_UPSERT', { contacts });
  }

  // Map database contact to frontend Contact type
  mapDbContact(row: any): Contact {
    return {
      id: String(row.id),
      sipi_number: row.sipi_number,
      contact_name: row.contact_name || undefined,
      email: row.email || undefined,
      phone: row.phone || undefined,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  // Convert frontend Contact to database format
  contactToDbFormat(contact: Partial<Contact>): any {
    return {
      sipi_number: contact.sipi_number,
      contact_name: contact.contact_name,
      email: contact.email,
      phone: contact.phone,
    };
  }
}

export const encryptedContactsService = new EncryptedContactsService();
