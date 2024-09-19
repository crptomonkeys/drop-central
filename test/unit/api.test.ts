import { expect } from 'chai';
import sinon from 'sinon';
import { AppDataSource, Transfer, app } from '../../src/api.js';
import supertest from 'supertest';

let sandbox: sinon.SinonSandbox;

beforeEach(() => {
sandbox = sinon.createSandbox();
});

afterEach(() => {
sandbox.restore();
});

describe('POST /transfer', () => {

  it('should return 401 if authorization header is missing', async () => {
    const res = await supertest(app)
      .post('/transfer')
      .send([{ receiver: 'user1', memo: 'test memo' }]);
    expect(res.status).to.equal(401);
    expect(res.body).to.have.property('error', 'Authorization header is missing');
  });

  it('should return 403 if unauthorized', async () => {
    const res = await supertest(app)
      .post('/transfer')
      .set('authorization', 'invalid-key')
      .send([{ receiver: 'user1', memo: 'test memo' }]);
    expect(res.status).to.equal(403);
  });

  it('should return 429 if transfer limit is reached', async () => {
    sandbox.stub(AppDataSource.getRepository(Transfer), 'findAndCountBy').resolves([[], 50]);

    const res = await supertest(app)
      .post('/transfer')
      .set('authorization', 'private_key_for_app1234')
      .send([{ receiver: 'user1', memo: 'test memo' }]);

    expect(res.status).to.equal(429);
  });
});

describe('DELETE /transfer/:id', () => {
    it('should return 401 if authorization header is missing', async () => {
        const res = await supertest(app)
        .delete('/transfer/123');
        expect(res.status).to.equal(401);
        expect(res.body).to.have.property('error', 'Authorization header is missing');
    });

    it('should return 404 if transfer not found', async () => {
        sandbox.stub(AppDataSource.getRepository(Transfer), 'findOneBy').resolves(null);

        const res = await supertest(app)
        .delete('/transfer/123')
        .set('authorization', 'private_key_for_app1234');

        expect(res.status).to.equal(404);
        expect(res.body).to.have.property('error', 'Transfer not found or already processed');
    });
});
  
