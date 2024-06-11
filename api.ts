import 'reflect-metadata';
import express, { Request, Response } from 'express';
import { DataSource, MoreThan } from 'typeorm';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv'; 
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { AssetStore } from './util/atomicassetsStore';
import { Session } from '@wharfkit/session';
import { WalletPluginPrivateKey } from "@wharfkit/wallet-plugin-privatekey"

dotenv.config();

const swaggerDocument = YAML.load('./swagger.yaml');

const app = express();
app.use(bodyParser.json());
app.use('/static', express.static('public'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

@Entity()
class Transfer {
  @PrimaryGeneratedColumn('uuid')
    id!: string;

  @Column('text')
    sender!: string;

  @Column('text')
    receiver!: string;

  @Column('text')
    assetId!: string;

  @Column('text')
    memo!: string;

  @Column('text')
    application!: string;

  @Column('text', { default: 'Pending' })
    status!: string;

  @Column('text')
    time!: string;

  @Column('text')
    chainTxId!: string;
}

type AllowedApplication = {
    name: string;
    id: number;
    privateKey: string;
    maxDropCount: number;
};

const AppDataSource = new DataSource({
  type: 'postgres',
  host: '127.0.0.1',
  port: 5433,
  username: 'postgres',
  password: 'postgres',
  database: 'postgres',
  synchronize: true,
  logging: false,
  entities: [Transfer],
});

AppDataSource.initialize()
  .then(() => {
    console.log('DB init done! Starting background jobs');
    processTransfersInBackground();
  })
  .catch(err => console.error('Error initializing database:', err));

const assetStore = new AssetStore(process.env.DROP_WALLET_NAME as string, ['https://aa.wax.blacklusion.io', 'https://atomic3.hivebp.io', 'https://atomic2.hivebp.io', 'https://aa.neftyblocks.com', 'https://aa-wax-public1.neftyblocks.com', 'https://aa.dapplica.io', 'https://api.atomic.greeneosio.com', 'https://wax-atomic-api.eosphere.io', 'https://wax-aa.eosdac.io', 'https://atomic.hivebp.io', 'https://atomic.3dkrender.com', 'https://wax.eosusa.io', 'https://atomic-wax-mainnet.wecan.dev', 'https://wax-atomic.eosiomadrid.io', 'https://wax.api.atomicassets.io', 'https://atomicassets.ledgerwise.io']);
        
const allowedApplications: AllowedApplication[] = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, 'allowedApplications.json'), 'utf8')    
);

const allowedApplicationsMap: Record<string, AllowedApplication> = {};
allowedApplications.forEach(app => {
    allowedApplicationsMap[app.name] = app;
});

const allowedApplicationsAuthMap: string[] = [];
allowedApplications.forEach(app => {
    allowedApplicationsAuthMap.push(app.privateKey);
});

const chain = {
  id: "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4",
  url: "https://wax.greymass.com/",
}

const walletPlugin = new WalletPluginPrivateKey(process.env.DROP_WALLET_PK as string)

const session = new Session({
  actor: process.env.DROP_WALLET_NAME,
  permission: process.env.DROP_WALLET_PERM,
  chain,
  walletPlugin,
})

const processTransfersInBackground = async () => {
  const transferRepository = AppDataSource.getRepository(Transfer);
  
  try {
    while (true) {
      const pendingTransfers = await transferRepository.find({
        where: { status: 'Pending' },
        take: 50,
      });

      if (pendingTransfers.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 10000)); 
        continue;
      }

      await assetStore.fetchAssets();

      const actions = [];
      for (const transfer of pendingTransfers) {
        const { receiver, memo, application } = transfer;

        const app = Object.values(allowedApplicationsMap).find(app => app.name === application);

        if (!app) {
          console.error('Application not allowed:', application);
          continue;
        }

        const asset = assetStore.popRandomAsset();

        if (!asset) {
          console.error(`No assets found for account: ${process.env.DROP_WALLET_NAME}`);
          continue;
        }

        transfer.assetId = asset.asset_id;
        transfer.sender = process.env.DROP_WALLET_NAME as string;

        actions.push({
            account: 'atomicassets',
            name: 'transfer',
            authorization: [session.permissionLevel],
            data: {
              from: process.env.DROP_WALLET_NAME,
              to: receiver,
              asset_ids: [asset.asset_id],
              memo: memo,
            },
          })
      }

      if (actions.length){
        const mappedAssetIds = actions.map((action) => { return action.data.asset_ids[0]; });

        try {
            const pushResult  = await session.transact({ actions: actions });

            await Promise.all(pendingTransfers.map(async (transfer) => {
              if (mappedAssetIds.includes(transfer.assetId)) {
                transfer.status = 'Completed';
                transfer.chainTxId = pushResult.response?.transaction_id ? pushResult.response?.transaction_id : "123FAIL";
                await transferRepository.save(transfer);
              }
            }));
        } catch (error) {
            console.error('Error processing transfer:', error);
        }
      }
      else {
        await new Promise(resolve => setTimeout(resolve, 60000)); 
      }
      
    }
  } catch (error) {
    console.error('Error processing transfers in background, sleeping 60s and try again:', error);
    await new Promise(resolve => setTimeout(resolve, 60000));
    processTransfersInBackground();
  }
};

app.post('/transfer', async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header is missing' });
  }

  if (!allowedApplicationsAuthMap.includes(authHeader)) {
      console.log('unauthorized request:', req.body);
      return res.status(403).json({ error: 'Unauthorized application' });
  }

  const transfers = req.body as Transfer[];

  const application = allowedApplications.filter(app => app.privateKey === req.headers['authorization'])[0];

  if (!application){
    return res.status(400).json({ error: 'Not authed or authed for wrong application' });
  }

  if (!Array.isArray(transfers) || transfers.length === 0) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const transferRepository = AppDataSource.getRepository(Transfer);
  let currentDate = new Date();
  const targetTime = new Date(currentDate.setHours(currentDate.getHours() - 24)).toISOString();
  const transferCount = await transferRepository.findAndCountBy({ application: application.name, time:  MoreThan(targetTime)});
  //@ts-ignore
  if (transferCount[1] + transfers.length > allowedApplicationsMap[application.name].maxDropCount) {
    console.error('Transfer limit reached for application:', application);
    return res.status(429).json({ error: 'Daily Drop limit for your application has been reached. Please wait 24hrs an try again.' });
  }

  const validWAX = new RegExp('(^[a-z1-5.]{0,11}[a-z1-5]$)|(^[a-z1-5.]{12}[a-j1-5]$)');

  const filteredTransfers = transfers.filter(transfer => {
    if (typeof transfer.receiver !== 'string') return false;
    if (!validWAX.test(transfer.receiver)) return false;
    return true;
  });

  try {    
    const savedTransfers = await transferRepository.save(filteredTransfers.map((transfer: any) => ({
      sender: process.env.DROP_WALLET_NAME,
      assetId: "",
      receiver: transfer.receiver,
      memo: transfer.memo,
      chainTxId: "",
      application: application.name,
      time: new Date().toISOString(),
    })));

    const transferIds = savedTransfers.map(transfer => transfer.id);

    res.json({ message: 'Transfers added to the queue', transferIds });
  } catch (error) {
    console.error('Error saving transfers:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/transfer/:id', async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header is missing' });
  }

  if (!allowedApplicationsAuthMap.includes(authHeader)) {
      console.log('unauthorized request:', req.body);
      return res.status(403).json({ error: 'Unauthorized application' });
  }

  const application = allowedApplications.filter(app => app.privateKey === req.headers['authorization'])[0];
  const transferId = req.params.id;

  if (!application){
    return res.status(400).json({ error: 'Not authed or authed for wrong application' });
  }

  try {
    const transferRepository = AppDataSource.getRepository(Transfer);
    const transfer = await transferRepository.findOneBy({ id: transferId, application: application.name, status: "Pending"  });
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    const result = await transferRepository.delete({ id: transferId, application: application.name });
    res.status(200).json({ success: 'True', id: transferId })
  } catch (error) {
    console.error('Error deleting transfer:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/transfer/:id', async (req: Request, res: Response) => {
  const transferId = req.params.id;

  try {
    const transferRepository = AppDataSource.getRepository(Transfer);
    const transfer = await transferRepository.findOneBy({ id: transferId });
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    res.json(transfer);
  } catch (error) {
    console.error('Error querying transfer:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/transfers', async (req: Request, res: Response) => {
    const transferRepository = AppDataSource.getRepository(Transfer);
    
    const { application, receiver, sender, memo, status, sort } = req.query;
  
    try {
      const queryBuilder = transferRepository.createQueryBuilder('transfer');
  
      if (application) {
        queryBuilder.andWhere('transfer.application = :application', { application });
      }
      if (receiver) {
        queryBuilder.andWhere('transfer.receiver = :receiver', { receiver });
      }
      if (sender) {
        queryBuilder.andWhere('transfer.sender = :sender', { sender });
      }
      if (memo) {
        queryBuilder.andWhere('transfer.memo ILIKE :memo', { memo: `%${memo}%` });
      }
      if (status) {
        queryBuilder.andWhere('transfer.status = :status', { status });
      }
  
      if (sort === 'asc' || sort === 'desc') {
        queryBuilder.orderBy('transfer.time', sort.toUpperCase() as 'ASC' | 'DESC');
      }
  
      const transfers = await queryBuilder.getMany();
  
      res.json(transfers);
    } catch (error) {
      console.error('Error fetching transfers:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.resolve(__dirname, 'templates/landing.html'));
});

app.get('/usage', (req: Request, res: Response) => {
  res.sendFile(path.resolve(__dirname, 'templates/usage.html'));
});
  

const port = 3091;
app.listen(port, () => {
  console.log(`Drops API is running on http://localhost:${port}`);
});
