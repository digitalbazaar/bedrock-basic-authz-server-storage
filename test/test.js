/*!
 * Copyright (c) 2024-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import {
  addOAuth2AuthzServer, getOAuth2ClientFromConfig, middleware
} from '@bedrock/basic-authz-server';
import {cleanDatabase} from './mocha/helpers.js';
import {clients} from '@bedrock/basic-authz-server-storage';
import '@bedrock/https-agent';
import '@bedrock/express';

// insert client for use below
bedrock.events.on('bedrock.ready', async () => {
  await cleanDatabase();
  const client = {
    id: '5f4e027b-efb1-4bf4-b741-69d16338e47e',
    sequence: 0,
    requestableScopes: ['read:/test-authorize-request'],
    secretHash: 'wkueZ4zwWnw6J1xV3jtEfSqnE7yJutgcWL-sQb7OnZ8'
  };
  await clients.insert({client});
});

// add OAuth2 authz server routes
bedrock.events.on('bedrock-express.configure.routes', app => {
  addOAuth2AuthzServer({
    app,
    async getOAuth2Client({clientId} = {}) {
      // first try `getOAuth2ClientFromConfig`
      try {
        const client = await getOAuth2ClientFromConfig({clientId});
        return client;
      } catch(e) {}

      // fetch via `clients` API
      const record = await clients.get({id: clientId});
      return record.client;
    }
  });

  // add middleware test routes
  app.post(
    '/test-authorize-request',
    middleware.authorizeRequest(), (req, res) => {
      res.json({success: true});
    });
  app.get(
    '/test-authorize-request',
    middleware.authorizeRequest(), (req, res) => {
      res.json({success: true});
    });
});

import '@bedrock/test';
bedrock.start();
