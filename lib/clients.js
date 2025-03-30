/*!
 * Copyright (c) 2020-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as database from '@bedrock/mongodb';
import assert from 'assert-plus';

const {util: {BedrockError}} = bedrock;

// exported to enable business-rule-specific indexes and other capabilities
export const COLLECTION_NAME = 'basic-authz-server-storage-client';

bedrock.events.on('bedrock-mongodb.ready', async () => {
  await database.openCollections([COLLECTION_NAME]);

  const indexes = [{
    collection: COLLECTION_NAME,
    fields: {'client.id': 1},
    options: {unique: true}
  }];

  await database.createIndexes(indexes);
});

/**
 * Retrieves a client record (if it exists).
 *
 * @param {object} options - Options to use.
 * @param {string} [options.id] - The ID of the client.
 * @param {boolean} [options.explain=false] - Set to true to return database
 *   query explain information instead of executing database queries.
 *
 * @returns {Promise<object | ExplainObject>} Resolves with the cache entry
 *   database record or an ExplainObject if `explain=true`.
 */
export async function get({id, explain = false} = {}) {
  assert.string(id, 'id');

  const query = {'client.id': id};
  const collection = database.collections[COLLECTION_NAME];
  const projection = {_id: 0};

  if(explain) {
    // 'find().limit(1)' is used here because 'findOne()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query, {projection}).limit(1);
    return cursor.explain('executionStats');
  }

  const record = await collection.findOne(query, {projection});
  if(!record) {
    const details = {
      httpStatusCode: 404,
      public: true
    };
    throw new BedrockError('Client record not found.', {
      name: 'NotFoundError',
      details
    });
  }
  return record;
}

/**
 * Inserts a client record into the database, provided that it is not a
 * duplicate.
 *
 * @param {object} options - Options to use.
 * @param {object} options.client - The client info to insert; must have
 *   `id` set and `sequence` set to `0`.
 *
 * @returns {Promise<object>} An object with the client record.
 */
export async function insert({client} = {}) {
  assert.object(client, 'client');
  assert.string(client.id, 'client.id');
  assert.number(client.sequence, 'client.sequence');
  if(client.sequence !== 0) {
    throw new BedrockError(
      'Could not insert client record. Initial "sequence" must be "0".', {
        name: 'InvalidStateError',
        details: {
          httpStatusCode: 409,
          public: true
        }
      });
  }

  const now = Date.now();
  const collection = database.collections[COLLECTION_NAME];
  const meta = {created: now, updated: now};
  const record = {client, meta};

  try {
    await collection.insertOne({...record});
    return record;
  } catch(cause) {
    if(!database.isDuplicateError(cause)) {
      throw cause;
    }
    throw new BedrockError('Duplicate client record.', {
      name: 'DuplicateError',
      details: {
        public: true,
        httpStatusCode: 409
      },
      cause
    });
  }
}

/**
 * Retrieves all client records matching the given query.
 *
 * @param {object} options - The options to use.
 * @param {object} options.query - The optional query to use (default: {}).
 * @param {object} [options.options={}] - Query options (eg: 'sort', 'limit').
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 *
 * @returns {Promise<Array | ExplainObject>} Resolves with the records that
 *   matched the query or returns an ExplainObject if `explain=true`.
 */
export async function find({query = {}, options = {}, explain = false} = {}) {
  const collection = database.collections[COLLECTION_NAME];

  if(explain) {
    const cursor = await collection.find(query, options);
    return cursor.explain('executionStats');
  }

  const records = await collection.find(query, options).toArray();
  return records;
}

/**
 * Retrieves a count of all client records matching the given query.
 *
 * @param {object} options - The options to use.
 * @param {object} options.query - The optional query to use (default: {}).
 * @param {object} [options.options={}] - Query options (eg: 'sort', 'limit').
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 *
 * @returns {Promise<Array | ExplainObject>} Resolves with the records that
 *   matched the query or returns an ExplainObject if `explain=true`.
 */
export async function count({query = {}, options = {}, explain = false} = {}) {
  const collection = database.collections[COLLECTION_NAME];

  if(explain) {
    // 'find()' is used here because 'countDocuments()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query, options);
    return cursor.explain('executionStats');
  }

  return collection.countDocuments(query, options);
}

/**
 * Updates (replaces) a client record if the client's `sequence` is one
 * greater than the existing record.
 *
 * @param {object} options - The options to use.
 * @param {object} options.client - The new client info with `id`
 *   and `sequence` minimally set.
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 *
 * @returns {Promise<boolean | ExplainObject>} Resolves with `true` on update
 *   success or an ExplainObject if `explain=true`.
 */
export async function update({client, explain = false} = {}) {
  assert.object(client, 'client');
  assert.string(client.id, 'client.id');
  assert.number(client.sequence, 'client.sequence');

  // build update
  const now = Date.now();
  const update = {};
  update.$set = {client, 'meta.updated': now};

  const collection = database.collections[COLLECTION_NAME];
  const query = {
    'client.id': client.id,
    'client.sequence': client.sequence - 1
  };

  if(explain) {
    // 'find().limit(1)' is used here because 'updateOne()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query).limit(1);
    return cursor.explain('executionStats');
  }

  const result = await collection.updateOne(query, update);
  if(result.modifiedCount > 0) {
    // document modified: success;
    return true;
  }

  throw new BedrockError(
    'Could not update client record. ' +
    'Sequence does not match existing record.', {
      name: 'InvalidStateError',
      details: {
        httpStatusCode: 409,
        public: true,
        expected: client.sequence - 1
      }
    });
}

/**
 * An object containing information on the query plan.
 *
 * @typedef {object} ExplainObject
 */
