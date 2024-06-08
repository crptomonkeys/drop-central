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
  private waxApiUrl: string;

  constructor(account: string, waxApiUrl: string) {
    this.account = account;
    this.waxApiUrl = waxApiUrl;
  }

  public async fetchAssets(): Promise<void> {
    try {
        const response = await axios.get(`${this.waxApiUrl}/atomicassets/v1/assets?owner=${this.account}`);
        this.assets = response.data.data;
    } catch (error) {
      console.error('Error fetching AtomicAssets:', error);
    }
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
export type {  AtomicAsset };
