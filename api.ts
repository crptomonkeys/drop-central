import 'reflect-metadata';
import express, { Request, Response } from 'express';
import { DataSource, LessThan, MoreThan } from 'typeorm';
import { Api, JsonRpc } from 'eosjs';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';

import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig';
import { AssetStore } from './util/atomicassetsStore';
import { TransactResult } from 'eosjs/dist/eosjs-api-interfaces';

const app = express();
app.use(bodyParser.json());

const DROP_WALLET_PK = ["needs to be loaded from file or env in prod"]
const DROP_WALLET_NAME = 'plchldr'

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
  host: 'localhost',
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

const assetStore = new AssetStore(DROP_WALLET_NAME, 'https://aa.wax.blacklusion.io');
        
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

const rpc = new JsonRpc('https://wax.greymass.com/', { fetch });

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
          console.error(`No assets found for account: ${DROP_WALLET_NAME}`);
          continue;
        }

        transfer.assetId = asset.asset_id;
        transfer.sender = DROP_WALLET_NAME;

        actions.push({
            account: 'atomicassets',
            name: 'transfer',
            authorization: [{
              actor: DROP_WALLET_NAME,
              permission: 'claimlink',
            }],
            data: {
              from: DROP_WALLET_NAME,
              to: receiver,
              asset_ids: [asset.asset_id],
              memo: memo,
            },
          })
      }

      if (actions.length){
        const mappedAssetIds = actions.map((action) => {return action.data.asset_ids[0]})
        const api = new Api({ rpc, signatureProvider: new JsSignatureProvider(DROP_WALLET_PK) });
        try {
            const pushResult  = await api.transact({actions:actions}, {
            blocksBehind: 3,
            expireSeconds: 30,
            }) as TransactResult;

            await Promise.all(pendingTransfers.map(async (transfer) => {
              if (mappedAssetIds.includes(transfer.assetId)) {
                transfer.status = 'Completed';
                transfer.chainTxId = pushResult.transaction_id ? pushResult.transaction_id : "123FAIL";
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
      console.log('unauthorized request:', req.body)
      return res.status(403).json({ error: 'Unauthorized application' });
  }

  const transfers = req.body;

  const application = allowedApplications.filter(app => app.privateKey === req.headers['authorization'])[0] 

  if (!application){
    return res.status(400).json({ error: 'Not authed or authed for wrong application' });
  }

  if (!Array.isArray(transfers) || transfers.length === 0) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const transferRepository = AppDataSource.getRepository(Transfer);
  let currentDate = new Date();
  const targetTime = new Date(currentDate.setHours(currentDate.getHours() - 24)).toISOString()
  const transferCount = await transferRepository.findAndCountBy({ application: application.name, time:  MoreThan(targetTime)})
  //@ts-ignore
  if (transferCount[1] + transfers.length > allowedApplicationsMap[application.name].maxDropCount) {
    console.error('Transfer limit reached for application:', application);
    return res.status(429).json({ error: 'Daily Drop limit for your application has been reached. Please wait 24hrs an try again.' });
  }

  try {    
    const savedTransfers = await transferRepository.save(transfers.map((transfer: any) => ({
      sender: DROP_WALLET_NAME,
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

const port = 3000;
app.listen(port, () => {
  console.log(`Drops API is running on http://localhost:${port}`);
});