const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const { expect } = chai;
const app = require('../src/server');

chai.use(chaiHttp);

describe('Batch Export Endpoint', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('POST /api/v1/export/batch', () => {
    it('should return 400 for empty taskIds array', (done) => {
      chai.request(app)
        .post('/api/v1/export/batch')
        .send({ taskIds: [], filter: 'eu' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.false;
          expect(res.body.error.code).to.equal('INVALID_REQUEST');
          done();
        });
    });

    it('should return 400 for invalid filter parameter', (done) => {
      chai.request(app)
        .post('/api/v1/export/batch')
        .send({ taskIds: ['task1', 'task2'], filter: 'invalid' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.false;
          expect(res.body.error.code).to.equal('INVALID_FILTER');
          done();
        });
    });

    it('should return 404 for non-existent task', (done) => {
      // Mock the database to return null for a task
      const taskDBStub = sandbox.stub(require('../src/models/database').taskDB, 'getById');
      taskDBStub.withArgs('nonexistent-task').resolves(null);
      
      chai.request(app)
        .post('/api/v1/export/batch')
        .send({ taskIds: ['nonexistent-task'], filter: 'eu' })
        .end((err, res) => {
          expect(res).to.have.status(404);
          expect(res.body.success).to.be.false;
          expect(res.body.error.code).to.equal('TASK_NOT_FOUND');
          done();
        });
    });

    it('should return 400 when no data available for export', (done) => {
      // Mock the database to return a task with no results
      const taskDBStub = sandbox.stub(require('../src/models/database').taskDB, 'getById');
      taskDBStub.withArgs('task-with-no-results').resolves({
        _id: 'task-with-no-results',
        results: []
      });
      
      chai.request(app)
        .post('/api/v1/export/batch')
        .send({ taskIds: ['task-with-no-results'], filter: 'eu' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body.success).to.be.false;
          expect(res.body.error.code).to.equal('NO_DATA');
          done();
        });
    });
  });
});
