import axios, { AxiosInstance } from 'axios';

interface Transfer {
  receiver: string;
  memo: string;
}

interface TransfersClientConfig {
  baseURL: string;
  authKey: string;
}

class TransfersClient {
  private axiosInstance: AxiosInstance;

  constructor(private config: TransfersClientConfig) {
    this.axiosInstance = axios.create({
      baseURL: config.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${config.authKey}`,
      },
    });
  }

  async postTransfer(transfers: Transfer[]): Promise<string[]> {
    try {
      const response = await this.axiosInstance.post('/transfer', transfers);
      return response.data.transferIds;
    } catch (error) {
      console.error('Error posting transfer:', error);
      throw error;
    }
  }

  async getTransferById(transferId: string): Promise<Transfer> {
    try {
      const response = await this.axiosInstance.get(`/transfer/${transferId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting transfer by ID:', error);
      throw error;
    }
  }

  async getTransfers(params: {
    application?: string;
    receiver?: string;
    sender?: string;
    memo?: string;
    status?: string;
    sort_by_time?: 'asc' | 'desc';
  }): Promise<Transfer[]> {
    try {
      const response = await this.axiosInstance.get('/transfers', { params });
      return response.data;
    } catch (error) {
      console.error('Error getting transfers:', error);
      throw error;
    }
  }
}

// Example usage:
(async () => {
  const baseURL = 'http://localhost:3000';
  const authKey = 'private_key_for_app1234';
  const applicationName = 'local_test_app';

  const client = new TransfersClient({ baseURL, authKey });

  const transfers: Transfer[] = [
    { receiver: 'crptomonkeys', memo: 'Test transfer js5' },
    ];

  try {
    // Post transfers
    const transferIds = await client.postTransfer(transfers);
    console.log('Posted transfers with IDs:', transferIds);

    // Get transfer by ID
    for (const transferId of transferIds) {
      const transfer = await client.getTransferById(transferId);
      console.log(`Transfer ${transferId}:`, transfer);
    }

    // Get filtered transfers
    const filteredTransfers = await client.getTransfers({ application: applicationName, sort_by_time: 'desc' });
    console.log('Filtered transfers:', filteredTransfers);
  } catch (error) {
    console.error('An error occurred:', error);
  }
})();
