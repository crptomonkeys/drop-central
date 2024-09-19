import sinon from 'sinon';
import { Repository } from 'typeorm';
import { Transfer } from '../../src/api.js'; 

export const mockTransfers = [
  {
    id: '1',
    jobId: 'job_1',
    sender: 'user1',
    receiver: 'user2',
    assetId: 'asset_123',
    memo: 'Test transfer 1',
    application: 'app1',
    status: 'Pending',
    time: new Date().toISOString(),
    chainTxId: 'chainTx_1',
  },
  {
    id: '2',
    jobId: 'job_2',
    sender: 'user3',
    receiver: 'user4',
    assetId: 'asset_456',
    memo: 'Test transfer 2',
    application: 'app2',
    status: 'Completed',
    time: new Date().toISOString(),
    chainTxId: 'chainTx_2',
  }
];

export function mockRepositoryMethods(transferRepository: Repository<Transfer>) {
  const sandbox = sinon.createSandbox();

  sandbox.stub(transferRepository, 'find').resolves(mockTransfers as any);
  sandbox.stub(transferRepository, 'findOne').callsFake(async (query: any) => {
    const transfer = mockTransfers.find(t => t.id === query.where.id);
    return transfer ? Promise.resolve(transfer) : Promise.resolve(null);
  });

  sandbox.stub(transferRepository, 'save').callsFake(async (newTransfer: any) => {
    const createdTransfer = { id: `${Math.floor(Math.random() * 1000)}`, ...newTransfer };
    mockTransfers.push(createdTransfer);
    return Promise.resolve(createdTransfer);
  });

  sandbox.stub(transferRepository, 'update').callsFake(async (id: any, updateData: any) => {
    const transfer = mockTransfers.find(t => t.id === id);
    if (transfer) {
      Object.assign(transfer, updateData);
      return Promise.resolve({ affected: 1, raw: {}, generatedMaps: [updateData] });
    }
    return Promise.resolve({ affected: 0, raw: {}, generatedMaps: [] });
  });

  sandbox.stub(transferRepository, 'delete').callsFake(async (id: any) => {
    const index = mockTransfers.findIndex(t => t.id === id);
    if (index > -1) {
      mockTransfers.splice(index, 1);
      return Promise.resolve({ affected: 1, raw: {} });
    }
    return Promise.resolve({ affected: 0, raw: {} });
  });

  return sandbox;
}

export function restoreRepositoryMethods(sandbox: sinon.SinonSandbox) {
  sandbox.restore();
}
