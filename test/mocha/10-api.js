/*!
 * Copyright (c) 2024-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as helpers from './helpers.js';
import {mockRecord1, mockRecord2} from './mock.data.js';
import {clients} from '@bedrock/basic-authz-server-storage';
import crypto from 'node:crypto';

describe('API', () => {
  describe('insert()', () => {
    it('should insert a record', async () => {
      const id = crypto.randomUUID();
      const record1 = await clients.insert({
        client: {
          id,
          sequence: 0
        }
      });
      const record2 = await clients.get({id});
      record1.should.eql(record2);
    });

    it('should error when no "client" is passed', async () => {
      let err;
      try {
        await clients.insert();
      } catch(e) {
        err = e;
      }
      err.message.should.include('client (object) is required');
    });

    it('should error when no "client.id" is passed', async () => {
      let err;
      try {
        await clients.insert({
          client: {}
        });
      } catch(e) {
        err = e;
      }
      err.message.should.include('client.id (string) is required');
    });

    it('should error when no "client.sequence" is passed', async () => {
      let err;
      try {
        const id = crypto.randomUUID();
        await clients.insert({
          client: {
            id
          }
        });
      } catch(e) {
        err = e;
      }
      err.message.should.include('client.sequence (number) is required');
    });

    it('should error when wrong "sequence" is passed', async () => {
      let err;
      try {
        const id = crypto.randomUUID();
        await clients.insert({
          client: {
            id,
            sequence: 1
          }
        });
      } catch(e) {
        err = e;
      }
      err.name.should.equal('InvalidStateError');
    });
  });

  describe('get()', () => {
    it('should get a record', async () => {
      const id = crypto.randomUUID();
      const record1 = await clients.insert({
        client: {
          id,
          sequence: 0
        }
      });
      const record2 = await clients.get({id});
      record1.should.eql(record2);
    });

    it('should error when no "id" is passed', async () => {
      let err;
      try {
        await clients.get();
      } catch(e) {
        err = e;
      }
      err.message.should.include('id (string) is required');
    });

    it('should get not found error', async () => {
      let err;
      try {
        await clients.get({
          id: crypto.randomUUID()
        });
      } catch(e) {
        err = e;
      }
      err.name.should.equal('NotFoundError');
    });
  });

  describe('update()', () => {
    it('should update a record', async () => {
      const id = crypto.randomUUID();
      const record1 = await clients.insert({
        client: {
          id,
          sequence: 0
        }
      });

      // now update
      await clients.update({
        client: {
          id,
          sequence: 1
        }
      });
      const record2 = await clients.get({id});
      record1.should.not.eql(record2);
      const expectedRecord2 = {
        ...record2,
        client: {...record1.client, sequence: 1}
      };
      record2.should.eql(expectedRecord2);

      // should fetch the same record again
      const record3 = await clients.get({id});
      record2.should.eql(record3);
    });

    it('should error when no "client" is passed', async () => {
      let err;
      try {
        await clients.update();
      } catch(e) {
        err = e;
      }
      err.message.should.include('client (object) is required');
    });

    it('should error when no "client.id" is passed', async () => {
      let err;
      try {
        await clients.update({
          client: {}
        });
      } catch(e) {
        err = e;
      }
      err.message.should.include('client.id (string) is required');
    });

    it('should error when no "client.sequence" is passed', async () => {
      let err;
      try {
        const id = crypto.randomUUID();
        await clients.update({
          client: {
            id
          }
        });
      } catch(e) {
        err = e;
      }
      err.message.should.include('client.sequence (number) is required');
    });

    it('should error when wrong "sequence" is passed', async () => {
      let err;
      try {
        const id = crypto.randomUUID();
        await clients.insert({
          client: {
            id,
            sequence: 0
          }
        });
        await clients.update({
          client: {
            id,
            sequence: 2
          }
        });
      } catch(e) {
        err = e;
      }
      err.name.should.equal('InvalidStateError');
    });
  });
});

describe('integration w/basic-authz-server', () => {
  const target = '/test-authorize-request';
  let clients;
  let url;
  before(() => {
    ({clients} = bedrock.config['basic-authz-server'].authorization.oauth2);
    url = `${bedrock.config.server.baseUri}/openid/token`;
  });

  it('succeeds when requesting one authorized scope', async () => {
    let err;
    let result;
    try {
      result = await helpers.requestOAuth2AccessToken({
        url,
        clientId: clients.authorizedClient.id,
        secret: clients.authorizedClient.id,
        requestedScopes: [`read:${target}`]
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.data.access_token.should.be.a('string');
  });
  it('succeeds when requesting all authorized scopes', async () => {
    let err;
    let result;
    try {
      result = await helpers.requestOAuth2AccessToken({
        url,
        clientId: clients.authorizedClient.id,
        secret: clients.authorizedClient.id,
        requestedScopes: [`read:${target}`, `write:${target}`]
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.data.access_token.should.be.a('string');
  });
  it('fails when requesting an unauthorized scope', async () => {
    let err;
    let result;
    try {
      result = await helpers.requestOAuth2AccessToken({
        url,
        clientId: clients.authorizedClient.id,
        secret: clients.authorizedClient.id,
        requestedScopes: [`read:/`]
      });
    } catch(e) {
      err = e;
    }
    should.exist(err);
    should.not.exist(result);
    err.status.should.equal(403);
    err.data.error.should.equal('not_allowed_error');
  });
  it('fails when requesting and no scopes are authorized', async () => {
    let err;
    let result;
    try {
      result = await helpers.requestOAuth2AccessToken({
        url,
        clientId: clients.unauthorizedClient.id,
        secret: clients.unauthorizedClient.id,
        requestedScopes: [`read:${target}`]
      });
    } catch(e) {
      err = e;
    }
    should.exist(err);
    should.not.exist(result);
    err.status.should.equal(403);
    err.data.error.should.equal('not_allowed_error');
  });
  it('succeeds when using requested token', async () => {
    const {
      data: {access_token: accessToken}
    } = await helpers.requestOAuth2AccessToken({
      url,
      clientId: clients.authorizedClient.id,
      secret: clients.authorizedClient.id,
      requestedScopes: [`read:${target}`]
    });
    let err;
    let result;
    try {
      result = await helpers.doOAuth2Request({
        url: `${bedrock.config.server.baseUri}${target}`,
        accessToken
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.data.should.deep.equal({success: true});
  });
  it('succeeds using database to fetch client', async () => {
    const customClientId = '5f4e027b-efb1-4bf4-b741-69d16338e47e';
    const {
      data: {access_token: accessToken}
    } = await helpers.requestOAuth2AccessToken({
      url,
      clientId: customClientId,
      secret: customClientId,
      requestedScopes: [`read:${target}`]
    });
    let err;
    let result;
    try {
      result = await helpers.doOAuth2Request({
        url: `${bedrock.config.server.baseUri}${target}`,
        accessToken
      });
    } catch(e) {
      err = e;
    }
    assertNoError(err);
    should.exist(result);
    result.data.should.deep.equal({success: true});
  });
  it('fails when client is not found in database', async () => {
    let err;
    let result;
    try {
      result = await helpers.requestOAuth2AccessToken({
        url,
        clientId: 'does-not-exist',
        secret: 'does-not-exist',
        requestedScopes: [`read:${target}`]
      });
    } catch(e) {
      err = e;
    }
    should.exist(err);
    should.not.exist(result);
    err.status.should.equal(403);
    err.data.error.should.equal('not_allowed_error');
  });
});

describe('Client Record Index Tests', function() {
  beforeEach(async () => {
    await helpers.cleanDatabase();

    const collectionName = clients.COLLECTION_NAME;
    await helpers.insertRecord({record: mockRecord1, collectionName});
    // second record is inserted here in order to do proper assertions for
    // 'nReturned', 'totalKeysExamined' and 'totalDocsExamined'.
    await helpers.insertRecord({record: mockRecord2, collectionName});
  });
  it('is properly indexed for query of ' +
    `'client.id' in get()`, async function() {
    const {id} = mockRecord1.client;
    const {executionStats} = await clients.get({
      id, explain: true
    });
    executionStats.nReturned.should.equal(1);
    executionStats.totalKeysExamined.should.equal(1);
    executionStats.totalDocsExamined.should.equal(1);
    executionStats.executionStages.inputStage.inputStage.inputStage.stage
      .should.equal('IXSCAN');
    executionStats.executionStages.inputStage.inputStage.inputStage
      .keyPattern.should.eql({'client.id': 1});
  });
  it('is properly indexed for query of ' +
    `'client.audience' in find()`, async function() {
    const {executionStats} = await clients.find({
      query: {'client.audience': mockRecord1.client.audience},
      options: {
        projection: {_id: 0, 'client.audience': 1}
      },
      explain: true
    });
    executionStats.nReturned.should.equal(1);
    executionStats.totalKeysExamined.should.equal(1);
    executionStats.totalDocsExamined.should.equal(0);
    executionStats.executionStages.inputStage.stage
      .should.equal('IXSCAN');
    executionStats.executionStages.inputStage
      .keyPattern.should.eql({'client.audience': 1});
  });
});
