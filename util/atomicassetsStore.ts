import axios from 'axios';

interface AtomicAsset {
  asset_id: string;
  owner: string;
  collection_name: string;
  schema_name: string;
  template_id: string;
  [key: string]: any; // Other properties
}

class AssetStore {
  private assets: AtomicAsset[] = [];
  private account: string;
  private endpoints: string[];
  private currentEndpoint: string;

  constructor(account: string, endpoints: string[]) {
    this.account = account;
    this.endpoints = endpoints;
    this.currentEndpoint = this.getRandomEndpoint();
  }

  private async getHeadblockDifference(url: string): Promise<{ headBlockNum: number; timeDifference: number }> {
    try {
      const response = await axios.get(`${url}/v1/chain/get_info`);
      const headBlockNum = response.data.head_block_num;
      const headBlockTime = new Date(response.data.head_block_time);
      const timeDifference = (new Date().getTime() - headBlockTime.getTime()) / 1000; // difference in seconds

      return { headBlockNum, timeDifference };
    } catch (error) {
      console.error(`Error fetching head block info from ${url}:`, error);
      return { headBlockNum: 0, timeDifference: Infinity };
    }
  }

  private getRandomEndpoint(): string {
    const randomIndex = Math.floor(Math.random() * this.endpoints.length);
    //@ts-ignore
    return this.endpoints[randomIndex];
  }

  private async validateCurrentEndpoint(): Promise<boolean> {
    const { timeDifference } = await this.getHeadblockDifference(this.currentEndpoint);
    return timeDifference < 60;
  }

  public async fetchAssets(): Promise<void> {
    let attempts = 0;
    const maxAttempts = this.endpoints.length;

    while (attempts < maxAttempts) {
      try {
        
          const response = await axios.get(`${this.currentEndpoint}/atomicassets/v1/assets?owner=${this.account}`);
          this.assets = response.data.data;
          console.log(`Fetched assets from ${this.currentEndpoint}`);
          return;
        
      } catch (error) {
        console.error(`Error fetching assets from ${this.currentEndpoint}:`, error);
      }

      this.currentEndpoint = this.getRandomEndpoint();
      attempts++;
    }

    console.error('Failed to fetch assets from any endpoint');
  }

  public popRandomAsset(): AtomicAsset | null {
    if (this.assets.length === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * this.assets.length);
    const [randomAsset] = this.assets.splice(randomIndex, 1);
    //@ts-ignore
    return randomAsset;
  }
}

export { AssetStore };
export type { AtomicAsset };
