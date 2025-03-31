/*!
 * Copyright (c) 2021-2025 Digital Bazaar, Inc. All rights reserved.
 */
export const mockData = {};

const now = Date.now();

export const mockRecord1 = {
  meta: {
    created: now,
    updated: now
  },
  client: {
    id: 'c1d87160-f519-43cd-99b0-18a56370a3dd',
    sequence: 0,
    allowedScopes: ['read:/test-authorize-request'],
    secretHash: 'fepHTCljXBM3nb-tXlkkB_jD3KwdMwOqc_VmmBpuTfQ'
  }
};

export const mockRecord2 = {
  meta: {
    created: now,
    updated: now
  },
  client: {
    id: '30ce98f4-aeca-4499-a4f1-62a2285ba68c',
    sequence: 0,
    allowedScopes: [],
    secretHash: 'd4mA8sbohUNR5oDY4KCfUatXoKbX_tB5pVxyBLCyGZM'
  }
};
