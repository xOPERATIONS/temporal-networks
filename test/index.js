const { expect } = require('chai');
const wasm = require('../pkg');

describe('temporal-networks', () => {
  it('should exist', () => {
    expect(wasm).to.be.ok;
  })
})
