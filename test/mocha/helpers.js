/*
 * Copyright (c) 2019-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as database from '@bedrock/mongodb';
import {
  _createOAuth2AccessToken, OAUTH2_ISSUER
} from '@bedrock/basic-authz-server/lib/http/oauth2.js';
import {clients} from '@bedrock/basic-authz-server-storage';
import {httpClient} from '@digitalbazaar/http-client';
import {httpsAgent} from '@bedrock/https-agent';

export async function cleanDatabase() {
  await database.collections[clients.COLLECTION_NAME].deleteMany({});
}

export async function insertRecord({record, collectionName}) {
  const collection = database.collections[collectionName];
  await collection.insertOne(record);
}

export async function createOAuth2AccessToken({
  action, target, audience, exp, iss, nbf, typ = 'at+jwt'
}) {
  const {
    issuer,
    keyPair: {privateKey, publicKeyJwk: {alg, kid}}
  } = OAUTH2_ISSUER;
  audience = audience ?? bedrock.config.server.baseUri;
  iss = iss ?? issuer;
  const scope = `${action}:${target}`;
  const {accessToken} = await _createOAuth2AccessToken({
    privateKey, alg, kid, audience, scope, exp, iss, nbf, typ
  });
  return accessToken;
}

export async function doOAuth2Request({url, json, accessToken}) {
  const method = json === undefined ? 'get' : 'post';
  return httpClient[method](url, {
    agent: httpsAgent,
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    json
  });
}

export async function requestOAuth2AccessToken({
  url, clientId, secret, requestedScopes
}) {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: requestedScopes.join(' ')
  });
  const credentials = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const headers = {
    accept: 'application/json',
    authorization: `Basic ${credentials}`
  };
  return httpClient.post(url, {agent: httpsAgent, body, headers});
}
