import { expect } from 'chai';
import { DataSource } from 'typeorm';
import { Transfer } from '../../src/api.js';
import { mockRepositoryMethods, restoreRepositoryMethods, mockTransfers } from '../mocks/typeormMock.js';
import sinon from 'sinon';

const mockDataSource = new DataSource({ type: 'postgres' } as any);
const transferRepository = mockDataSource.getRepository(Transfer);

describe('Transfer Model Tests', () => {
  let sandbox: sinon.SinonSandbox;

  before(() => {
    sandbox = mockRepositoryMethods(transferRepository); 
  });

  after(() => {
    restoreRepositoryMethods(sandbox); 
  });

  it('should return all transfers', async () => {
    const transfers = await transferRepository.find();
    expect(transfers).to.be.an('array').with.length(2);
    expect(transfers[0]).to.have.property('sender', 'user1');
  });

  it('should find a transfer by id', async () => {
    const transfer = await transferRepository.findOne({ where: { id: '1' } });
    expect(transfer).to.have.property('id', '1');
    expect(transfer).to.have.property('receiver', 'user2');
  });

  it('should create a new transfer', async () => {
    const newTransfer = {
      jobId: 'job_3',
      sender: 'user5',
      receiver: 'user6',
      assetId: 'asset_789',
      memo: 'Test new transfer',
      application: 'app3',
      status: 'Pending',
      time: new Date().toISOString(),
      chainTxId: 'chainTx_3',
    };

    const createdTransfer = await transferRepository.save(newTransfer);
    expect(createdTransfer).to.have.property('id');
    expect(createdTransfer).to.have.property('sender', 'user5');
  });

  it('should update a transfer status', async () => {
    const updateData = { status: 'Completed' };
    const result = await transferRepository.update('1', updateData);
    
    expect(result).to.have.property('affected', 1);

    const updatedTransfer = await transferRepository.findOne({ where: { id: '1' } });
    expect(updatedTransfer).to.have.property('status', 'Completed');
  });

  it('should delete a transfer', async () => {
    const result = await transferRepository.delete('2');
    expect(result).to.have.property('affected', 1);

    const transfer = await transferRepository.findOne({ where: { id: '2' } });
    expect(transfer).to.be.null;
  });
});
