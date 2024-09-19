import supertest from 'supertest';
import { expect } from 'chai';
import { app } from '../../src/api.js';

describe('POST /transfer', () => {
  it('should successfully create transfers and return jobId', async () => {
    const response = await supertest(app)
      .post('/transfer')
      .set('authorization', 'private_key_for_app1234')
      .send([
        { receiver: 'user1', memo: 'test memo' },
        { receiver: 'user2', memo: 'test memo 2' }
      ]);

    expect(response.status).to.equal(200);
    expect(response.body).to.have.property('jobId');
  });

  it('should return 400 if invalid request body', async () => {
    const res = await supertest(app)
      .post('/transfer')
      .set('authorization', 'private_key_for_app1234')
      .send({});
    expect(res.status).to.equal(400);
    expect(res.body).to.have.property('error', 'Invalid request body');
  });
});

describe('GET /transfers', () => {
    it('should return 200 with the transfers details', async () => {
      const res = await supertest(app)
        .get('/transfers');
      expect(res.status).to.equal(200);
    });
  });
  