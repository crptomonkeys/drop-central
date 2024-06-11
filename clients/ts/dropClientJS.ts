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

  async deleteTransferById(transferId: string): Promise<Transfer> {
    try {
      const response = await this.axiosInstance.delete(`/transfer/${transferId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting transfer by ID:', error);
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

export default TransfersClient;
